import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { attributeReferral } from "./referral";
import { sdk } from "./sdk";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await scrypt(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function issueSession(req: Request, res: Response, openId: string, name: string) {
  const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}


export function registerLocalAuthRoutes(app: Express) {
  // Email/password sign-up. Creates a local account and signs the user in.
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string; name?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();

      if (!EMAIL_RE.test(email)) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters." });
        return;
      }

      const openId = `email:${email}`;
      const existing = (await db.getUserByEmail(email)) ?? (await db.getUserByOpenId(openId));
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists. Try signing in." });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await db.createUser({
        openId,
        email,
        name: name || email.split("@")[0],
        loginMethod: "password",
        passwordHash,
        lastSignedIn: new Date(),
      });
      if (!user) {
        res.status(500).json({ error: "Could not create your account. Please try again." });
        return;
      }

      await attributeReferral({ cookieHeader: req.headers.cookie, userId: user.id, name: user.name, email });
      res.clearCookie("cbp_ref", { path: "/" });

      await issueSession(req, res, openId, user.name ?? email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] signup failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });


  // Email/password sign-in.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      if (!EMAIL_RE.test(email) || !password) {
        res.status(400).json({ error: "Enter your email and password." });
        return;
      }

      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      await issueSession(req, res, user.openId, user.name ?? email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] login failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
}
