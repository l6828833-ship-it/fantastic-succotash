import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { attributeReferral } from "./referral";
import { isEmailConfigured, sendEmail } from "./email";
import { ENV } from "./env";
import { sdk } from "./sdk";

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

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

async function issueSession(req: Request, res: Response, openId: string, name: string) {
  const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

function generateCode(): string {
  return String(randomInt(100000, 1000000)); // 6 digits
}

async function emailOtp(to: string, code: string, purpose: "signup" | "reset") {
  const intro = purpose === "signup"
    ? "Use this code to verify your email and finish creating your account:"
    : "Use this code to reset your password:";
  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827;">` +
    `<p style="font-size:15px;">${intro}</p>` +
    `<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>` +
    `<p style="font-size:13px;color:#6b7280;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p></div>`;
  await sendEmail({ to, subject: purpose === "signup" ? "Your verification code" : "Your password reset code", html, text: `${intro}\n\n${code}\n\nThis code expires in 10 minutes.` });
  if (!ENV.isProduction) console.log(`[Auth] OTP for ${to} (${purpose}): ${code}`);
}


export function registerLocalAuthRoutes(app: Express) {
  // ── Sign-up step 1: validate, email a 6-digit code, stash the pending account.
  app.post("/api/auth/signup/request", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string; name?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();

      if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid email address." }); return; }
      if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }
      if (!isEmailConfigured()) { res.status(500).json({ error: "Email is not configured on the server, so codes can't be sent." }); return; }

      const existing = (await db.getUserByEmail(email)) ?? (await db.getUserByOpenId(`email:${email}`));
      if (existing) { res.status(409).json({ error: "An account with this email already exists. Try signing in." }); return; }

      const code = generateCode();
      const passwordHash = await hashPassword(password);
      await db.createOtp({
        email, purpose: "signup", code,
        name: name || email.split("@")[0],
        passwordHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
      await emailOtp(email, code, "signup");
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] signup/request failed", error);
      res.status(500).json({ error: "Could not send your code. Please try again." });
    }
  });

  // ── Sign-up step 2: verify the code, create the account, sign in.
  app.post("/api/auth/signup/verify", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; code?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim();

      const otp = await db.getActiveOtp(email, "signup");
      if (!otp || !otp.passwordHash) { res.status(400).json({ error: "No pending sign-up found. Please request a new code." }); return; }
      if (new Date(otp.expiresAt).getTime() < Date.now()) { res.status(400).json({ error: "That code has expired. Please request a new one." }); return; }
      if (otp.attempts >= OTP_MAX_ATTEMPTS) { res.status(429).json({ error: "Too many attempts. Please request a new code." }); return; }
      if (code !== otp.code) { await db.incrementOtpAttempts(otp.id); res.status(400).json({ error: "Incorrect code. Please try again." }); return; }

      await db.consumeOtp(otp.id);
      const openId = `email:${email}`;
      if (await db.getUserByEmail(email)) { res.status(409).json({ error: "Account already exists. Please sign in." }); return; }
      const user = await db.createUser({ openId, email, name: otp.name || email.split("@")[0], loginMethod: "password", passwordHash: otp.passwordHash, lastSignedIn: new Date() });
      if (!user) { res.status(500).json({ error: "Could not create your account. Please try again." }); return; }

      await attributeReferral({ cookieHeader: req.headers.cookie, userId: user.id, name: user.name, email });
      res.clearCookie("cbp_ref", { path: "/" });
      await issueSession(req, res, openId, user.name ?? email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] signup/verify failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });


  // ── Sign-in with email + password.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!EMAIL_RE.test(email) || !password) { res.status(400).json({ error: "Enter your email and password." }); return; }

      const user = await db.getUserByEmail(email);
      if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
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

  // ── Password reset step 1: email a code (don't reveal whether the user exists).
  app.post("/api/auth/reset/request", async (req: Request, res: Response) => {
    try {
      const email = String((req.body ?? {}).email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid email address." }); return; }
      const user = await db.getUserByEmail(email);
      if (user && user.passwordHash && isEmailConfigured()) {
        const code = generateCode();
        await db.createOtp({ email, purpose: "reset", code, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
        await emailOtp(email, code, "reset");
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] reset/request failed", error);
      res.json({ ok: true });
    }
  });

  // ── Password reset step 2: verify the code + set a new password, then sign in.
  app.post("/api/auth/reset/verify", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; code?: string; password?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim();
      const password = String(body.password ?? "");
      if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters." }); return; }

      const otp = await db.getActiveOtp(email, "reset");
      if (!otp) { res.status(400).json({ error: "No reset request found. Please request a new code." }); return; }
      if (new Date(otp.expiresAt).getTime() < Date.now()) { res.status(400).json({ error: "That code has expired. Please request a new one." }); return; }
      if (otp.attempts >= OTP_MAX_ATTEMPTS) { res.status(429).json({ error: "Too many attempts. Please request a new code." }); return; }
      if (code !== otp.code) { await db.incrementOtpAttempts(otp.id); res.status(400).json({ error: "Incorrect code. Please try again." }); return; }

      const user = await db.getUserByEmail(email);
      if (!user) { res.status(400).json({ error: "Account not found." }); return; }
      await db.setUserPassword(user.id, await hashPassword(password));
      await db.consumeOtp(otp.id);
      await issueSession(req, res, user.openId, user.name ?? email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] reset/verify failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
}
