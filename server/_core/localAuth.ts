import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { attributeReferral } from "./referral";
import { brandedEmail, isEmailConfigured, sendEmail } from "./email";
import { ENV } from "./env";
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

// OTP config: 6-digit codes, valid for 10 minutes, max 5 verification attempts.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashOtp(code: string): string {
  return createHmac("sha256", ENV.cookieSecret || "chatrico-otp").update(code).digest("hex");
}

function otpMatches(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function issueSession(req: Request, res: Response, openId: string, name: string) {
  const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

// Finalize a verified/created account: attribute any referral, clear the ref
// cookie, and start the session.
async function completeSignup(req: Request, res: Response, user: { id: number; openId: string; name: string | null }, email: string) {
  await attributeReferral({ cookieHeader: req.headers.cookie, userId: user.id, name: user.name, email });
  res.clearCookie("cbp_ref", { path: "/" });
  await issueSession(req, res, user.openId, user.name ?? email);
}


export function registerLocalAuthRoutes(app: Express) {
  // ── Sign-up step 1: request an email verification code ──────────────────────
  // Validates the input, then either (a) emails a 6-digit OTP when email is
  // configured, or (b) falls back to creating the account immediately when no
  // mail provider is set up (so local/dev still works).
  app.post("/api/auth/signup/request", async (req: Request, res: Response) => {
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
      const displayName = name || email.split("@")[0];

      // No mail provider configured → create the account right away (no OTP).
      if (!isEmailConfigured()) {
        const user = await db.createUser({
          openId, email, name: displayName, loginMethod: "password", passwordHash, lastSignedIn: new Date(),
        });
        if (!user) {
          res.status(500).json({ error: "Could not create your account. Please try again." });
          return;
        }
        await completeSignup(req, res, user, email);
        res.json({ success: true, verified: true });
        return;
      }

      // Email configured → generate + email a verification code.
      const code = generateOtp();
      await db.createAuthOtp({
        email,
        codeHash: hashOtp(code),
        purpose: "signup",
        payload: { name: displayName, passwordHash },
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      });

      try {
        await sendEmail({
          to: email,
          subject: "Your Chatrico verification code",
          html: brandedEmail({
            title: "Verify your email",
            bodyHtml:
              `<p>Use this code to finish creating your Chatrico account:</p>` +
              `<div style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#111827;">${code}</div>` +
              `<p style="color:#6b7280;font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
          }),
          text: `Your Chatrico verification code is ${code}. It expires in 10 minutes.`,
        });
      } catch (err) {
        console.error("[Auth] failed to send OTP email", err);
        res.status(502).json({ error: "We couldn't send the verification email. Please try again shortly." });
        return;
      }

      res.json({ success: true, otp: true });
    } catch (error) {
      console.error("[Auth] signup request failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── Sign-up step 2: verify the code and create the account ──────────────────
  app.post("/api/auth/signup/verify", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; code?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim();

      if (!EMAIL_RE.test(email) || !/^\d{4,8}$/.test(code)) {
        res.status(400).json({ error: "Enter the code we emailed you." });
        return;
      }

      const otp = await db.getLatestAuthOtp(email, "signup");
      if (!otp) {
        res.status(400).json({ error: "No active code. Please request a new one." });
        return;
      }
      if (new Date(otp.expiresAt).getTime() < Date.now()) {
        await db.deleteAuthOtp(otp.id);
        res.status(400).json({ error: "This code has expired. Please request a new one." });
        return;
      }
      if ((otp.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
        await db.deleteAuthOtp(otp.id);
        res.status(429).json({ error: "Too many attempts. Please request a new code." });
        return;
      }
      if (!otpMatches(code, otp.codeHash)) {
        await db.bumpAuthOtpAttempts(otp.id);
        res.status(400).json({ error: "That code isn't right. Please try again." });
        return;
      }

      // Code is valid — create the account from the stored payload.
      const openId = `email:${email}`;
      const existing = (await db.getUserByEmail(email)) ?? (await db.getUserByOpenId(openId));
      if (existing) {
        await db.deleteAuthOtp(otp.id);
        res.status(409).json({ error: "An account with this email already exists. Try signing in." });
        return;
      }

      const payload = (otp.payload ?? {}) as { name?: string; passwordHash?: string };
      if (!payload.passwordHash) {
        await db.deleteAuthOtp(otp.id);
        res.status(400).json({ error: "Your sign-up session expired. Please start again." });
        return;
      }

      const user = await db.createUser({
        openId,
        email,
        name: payload.name || email.split("@")[0],
        loginMethod: "password",
        passwordHash: payload.passwordHash,
        lastSignedIn: new Date(),
      });
      if (!user) {
        res.status(500).json({ error: "Could not create your account. Please try again." });
        return;
      }

      await db.deleteAuthOtp(otp.id);
      await completeSignup(req, res, user, email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] signup verify failed", error);
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

  // ── Reset password step 1: request an email verification code ───────────────
  // Always responds with success (even for unknown emails) so the endpoint
  // can't be used to discover which addresses have accounts.
  app.post("/api/auth/reset/request", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string };
      const email = String(body.email ?? "").trim().toLowerCase();

      if (!EMAIL_RE.test(email)) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }

      // Password reset by code requires a configured mail provider.
      if (!isEmailConfigured()) {
        res.status(503).json({ error: "Password reset is unavailable right now. Please contact support." });
        return;
      }

      const user = await db.getUserByEmail(email);
      // Only send a code to real password accounts, but never reveal that.
      if (user && user.passwordHash) {
        const code = generateOtp();
        await db.createAuthOtp({
          email,
          codeHash: hashOtp(code),
          purpose: "reset",
          payload: {},
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        });

        try {
          await sendEmail({
            to: email,
            subject: "Your Chatrico password reset code",
            html: brandedEmail({
              title: "Reset your password",
              bodyHtml:
                `<p>Use this code to reset your Chatrico password:</p>` +
                `<div style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#111827;">${code}</div>` +
                `<p style="color:#6b7280;font-size:13px;">This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email.</p>`,
            }),
            text: `Your Chatrico password reset code is ${code}. It expires in 10 minutes.`,
          });
        } catch (err) {
          console.error("[Auth] failed to send reset email", err);
          res.status(502).json({ error: "We couldn't send the reset email. Please try again shortly." });
          return;
        }
      }

      res.json({ success: true, otp: true });
    } catch (error) {
      console.error("[Auth] reset request failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── Reset password step 2: verify the code and set the new password ─────────
  app.post("/api/auth/reset/verify", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { email?: string; code?: string; password?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").trim();
      const password = String(body.password ?? "");

      if (!EMAIL_RE.test(email) || !/^\d{4,8}$/.test(code)) {
        res.status(400).json({ error: "Enter the code we emailed you." });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters." });
        return;
      }

      const otp = await db.getLatestAuthOtp(email, "reset");
      if (!otp) {
        res.status(400).json({ error: "No active code. Please request a new one." });
        return;
      }
      if (new Date(otp.expiresAt).getTime() < Date.now()) {
        await db.deleteAuthOtp(otp.id);
        res.status(400).json({ error: "This code has expired. Please request a new one." });
        return;
      }
      if ((otp.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
        await db.deleteAuthOtp(otp.id);
        res.status(429).json({ error: "Too many attempts. Please request a new code." });
        return;
      }
      if (!otpMatches(code, otp.codeHash)) {
        await db.bumpAuthOtpAttempts(otp.id);
        res.status(400).json({ error: "That code isn't right. Please try again." });
        return;
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        await db.deleteAuthOtp(otp.id);
        res.status(400).json({ error: "We couldn't find that account. Please sign up instead." });
        return;
      }

      const passwordHash = await hashPassword(password);
      await db.updateUserPassword(user.openId, passwordHash);
      await db.deleteAuthOtp(otp.id);

      // Sign the user straight in after a successful reset.
      await issueSession(req, res, user.openId, user.name ?? email);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] reset verify failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
}
