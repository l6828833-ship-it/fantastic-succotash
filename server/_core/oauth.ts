import { randomBytes } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

const STATE_COOKIE = "gh_oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const OAUTH_SCOPE = "read:user user:email";

type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url?: string;
};

type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/** Resolve the public base URL of this deployment (scheme + host). */
function getBaseUrl(req: Request): string {
  if (ENV.appBaseUrl) return ENV.appBaseUrl.replace(/\/+$/, "");

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)
      ?.split(",")[0]
      ?.trim() || req.protocol || "http";

  const forwardedHost = req.headers["x-forwarded-host"];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.trim() ||
    req.headers.host ||
    "localhost";

  return `${proto}://${host}`;
}

function getRedirectUri(req: Request): string {
  return `${getBaseUrl(req)}/api/oauth/callback`;
}

function renderError(res: Response, status: number, title: string, detail: string) {
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
        `<style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e5e7eb;` +
        `display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}` +
        `.card{max-width:480px;text-align:center}h1{font-size:18px;margin:0 0 8px}` +
        `p{font-size:14px;color:#9ca3af;line-height:1.5}a{color:#818cf8}</style></head>` +
        `<body><div class="card"><h1>${title}</h1><p>${detail}</p>` +
        `<p><a href="/">Return home</a></p></div></body></html>`
    );
}

function stateCookieOptions(req: Request) {
  const base = getSessionCookieOptions(req);
  // The callback is a top-level navigation from github.com, so "lax" lets the
  // state cookie ride along while still providing CSRF protection.
  return { ...base, sameSite: "lax" as const, maxAge: STATE_MAX_AGE_MS };
}

async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "fantastic-succotash",
      },
    });
    if (!res.ok) return null;
    const emails = (await res.json()) as GithubEmail[];
    if (!Array.isArray(emails)) return null;
    const primary = emails.find((e) => e.primary && e.verified);
    const verified = emails.find((e) => e.verified);
    return primary?.email ?? verified?.email ?? emails[0]?.email ?? null;
  } catch {
    return null;
  }
}

export function registerOAuthRoutes(app: Express) {
  // Step 1: kick off the GitHub OAuth flow.
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    if (!ENV.githubClientId) {
      renderError(
        res,
        500,
        "Login is not configured",
        "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set on the server. " +
          "Create a GitHub OAuth App and set these environment variables, then redeploy."
      );
      return;
    }

    const state = randomBytes(16).toString("hex");
    res.cookie(STATE_COOKIE, state, stateCookieOptions(req));

    const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
    authorizeUrl.searchParams.set("client_id", ENV.githubClientId);
    authorizeUrl.searchParams.set("redirect_uri", getRedirectUri(req));
    authorizeUrl.searchParams.set("scope", OAUTH_SCOPE);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("allow_signup", "true");

    res.redirect(302, authorizeUrl.toString());
  });

  // Step 2: GitHub redirects back here with a code.
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      renderError(res, 400, "Sign-in failed", "Missing authorization code or state. Please try again.");
      return;
    }

    // CSRF: the state returned by GitHub must match the one we stored.
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { ...getSessionCookieOptions(req), sameSite: "lax" });
    if (!expectedState || expectedState !== state) {
      renderError(res, 400, "Sign-in failed", "Invalid or expired login state. Please try signing in again.");
      return;
    }

    if (!ENV.githubClientId || !ENV.githubClientSecret) {
      renderError(res, 500, "Login is not configured", "GitHub OAuth credentials are not set on the server.");
      return;
    }

    try {
      // Exchange the code for an access token.
      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "fantastic-succotash",
        },
        body: JSON.stringify({
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: getRedirectUri(req),
        }),
      });

      const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        console.error("[OAuth] Token exchange failed:", tokenData.error ?? tokenData);
        renderError(res, 502, "Sign-in failed", "Could not complete the GitHub token exchange. Please try again.");
        return;
      }

      // Fetch the GitHub profile.
      const userRes = await fetch(GITHUB_USER_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "fantastic-succotash",
        },
      });
      if (!userRes.ok) {
        renderError(res, 502, "Sign-in failed", "Could not fetch your GitHub profile. Please try again.");
        return;
      }
      const ghUser = (await userRes.json()) as GithubUser;
      const email = ghUser.email ?? (await fetchPrimaryEmail(accessToken));

      const openId = `github:${ghUser.id}`;
      const isOwner =
        (ENV.ownerGithubLogin && ghUser.login === ENV.ownerGithubLogin) ||
        (ENV.ownerOpenId && openId === ENV.ownerOpenId);

      await db.upsertUser({
        openId,
        name: ghUser.name || ghUser.login,
        email: email ?? null,
        loginMethod: "github",
        role: isOwner ? "admin" : undefined,
        lastSignedIn: new Date(),
      });

      // Issue our own signed session cookie.
      const sessionToken = await sdk.createSessionToken(openId, {
        name: ghUser.name || ghUser.login,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] GitHub callback failed", error);
      renderError(res, 500, "Sign-in failed", "An unexpected error occurred during sign-in. Please try again.");
    }
  });
}
