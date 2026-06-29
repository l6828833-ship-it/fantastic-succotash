import { scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { sdk } from "./sdk";

/**
 * REST endpoints used by the Chatrico WordPress plugin (and any other
 * server-to-server integration). The plugin authenticates with email/password,
 * receives a long-lived bearer token (the same stateless JWT the web app uses),
 * and then reads its workspace plan + usage + agents from /api/plugin/me.
 *
 * These are plain Express routes (not tRPC) so a PHP client can call them with
 * simple JSON. Calls are server-to-server, so cookies/CORS are not involved.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;

// Same scrypt scheme as localAuth.ts (`salt:hexDerivedKey`).
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await scrypt(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Turn Infinity (unlimited) into null so JSON stays valid and the client can
// render "Unlimited".
const toLimit = (n: number): number | null => (Number.isFinite(n) ? n : null);

/**
 * Build the snapshot the plugin needs: account, plan, usage-vs-limits and the
 * workspace's agents. Mirrors the web app's billing.usage query.
 */
async function buildAccountSnapshot(user: User) {
  const workspace = await db.getWorkspaceByUserId(user.id);
  const plan = db.normalizePlan(workspace?.plan ?? "free");

  const account = {
    name: user.name ?? "",
    email: user.email ?? "",
  };

  if (!workspace) {
    return {
      account,
      plan,
      usage: {
        aiConversations: { used: 0, limit: toLimit(db.conversationLimitForPlan(plan)) },
        contacts: { used: 0, limit: toLimit(db.contactLimitForPlan(plan)) },
        agents: { used: 0, limit: toLimit(db.agentLimitForPlan(plan)) },
        seats: { used: 1, limit: toLimit(db.teamSeatLimitForPlan(plan)) },
        tickets: { used: 0, limit: toLimit(db.ticketLimitForPlan(plan)) },
      },
      agents: [] as Array<{ id: number; name: string; isActive: boolean; widgetColor: string | null }>,
    };
  }

  const [aiConversations, contacts, agentCount, members, tickets, agentRows] = await Promise.all([
    db.countAiConversationsThisMonth(workspace.id),
    db.countContactsByWorkspace(workspace.id),
    db.countAgentsByWorkspace(workspace.id),
    db.countTeamMembersByWorkspace(workspace.id),
    db.countTicketsThisMonth(workspace.id),
    db.getAgentsByWorkspace(workspace.id),
  ]);

  return {
    account,
    plan,
    usage: {
      aiConversations: { used: aiConversations, limit: toLimit(db.conversationLimitForPlan(plan)) },
      contacts: { used: contacts, limit: toLimit(db.contactLimitForPlan(plan)) },
      agents: { used: agentCount, limit: toLimit(db.agentLimitForPlan(plan)) },
      seats: { used: members + 1, limit: toLimit(db.teamSeatLimitForPlan(plan)) },
      tickets: { used: tickets, limit: toLimit(db.ticketLimitForPlan(plan)) },
    },
    agents: agentRows.map((a) => ({
      id: a.id,
      name: a.name,
      isActive: a.isActive ?? true,
      widgetColor: a.widgetColor ?? null,
    })),
  };
}

export function registerPluginRoutes(app: Express) {
  // Allow simple cross-origin use too (harmless; PHP calls are server-side).
  const setCors = (res: Response) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  };

  app.options("/api/plugin/*", (_req, res) => {
    setCors(res);
    res.sendStatus(204);
  });

  // ── Login: email + password → bearer token + account snapshot ───────────────
  app.post("/api/plugin/login", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      if (!EMAIL_RE.test(email) || !password) {
        res.status(400).json({ error: "Enter your email and password." });
        return;
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      if (!user.passwordHash) {
        res.status(409).json({ error: "This account uses GitHub sign-in. Set a password from chatrico.com first, then log in here." });
        return;
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      if ((user as { suspended?: boolean }).suspended) {
        res.status(403).json({ error: "This account is suspended. Please contact support." });
        return;
      }

      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? email, expiresInMs: ONE_YEAR_MS });
      const snapshot = await buildAccountSnapshot(user);
      res.json({ token, ...snapshot });
    } catch (error) {
      console.error("[Plugin] login failed", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── Me: bearer token → account snapshot (plan, usage, agents) ───────────────
  app.get("/api/plugin/me", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const user = await sdk.authenticateRequest(req);
      const snapshot = await buildAccountSnapshot(user);
      res.json(snapshot);
    } catch {
      res.status(401).json({ error: "Not authenticated. Please log in again." });
    }
  });
}
