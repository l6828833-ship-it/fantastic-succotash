import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { readFileSync } from "fs";
import path from "path";
import {
  InsertUser,
  affiliates,
  agents,
  adminLogs,
  analyticsEvents,
  appSettings,
  authOtps,
  cannedResponses,
  campaigns,
  contacts,
  conversations,
  knowledgeArticles,
  messages,
  notifications,
  payoutRequests,
  payments,
  playgroundSessions,
  qaPairs,
  referrals,
  supportMessages,
  teamMembers,
  ticketNotes,
  tickets,
  users,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      // Supabase (and most managed Postgres) require TLS. Allow opting out via
      // ?sslmode=disable for local development.
      const disableSsl = /sslmode=disable/i.test(url);
      _client = postgres(url, {
        // The Supabase transaction pooler (port 6543) does not support prepared
        // statements; disabling them keeps both pooler and direct connections working.
        prepare: false,
        ssl: disableSsl ? false : "require",
        max: 5,
      });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Apply the idempotent SQL in supabase/init.sql on startup so schema changes
// (new tables / columns) are picked up by a normal deploy — no manual "run the
// SQL in Supabase" step. The file is safe to re-run: every statement uses
// IF NOT EXISTS, so existing data is untouched. Each statement runs
// independently and failures are tolerated, so one bad statement can never
// block the rest or crash the server.
export async function runMigrations(): Promise<{ ok: number; failed: number } | null> {
  if (!process.env.DATABASE_URL) {
    console.warn("[Migrate] DATABASE_URL not set; skipping migrations");
    return null;
  }
  await getDb(); // initialize the shared client
  if (!_client) {
    console.warn("[Migrate] No database client available; skipping migrations");
    return null;
  }
  // process.cwd() is the app root (/app in the Docker image, repo root locally).
  const candidates = [
    path.join(process.cwd(), "supabase", "init.sql"),
    path.join(process.cwd(), "..", "supabase", "init.sql"),
  ];
  let sqlText = "";
  for (const candidate of candidates) {
    try {
      sqlText = readFileSync(candidate, "utf8");
      if (sqlText) break;
    } catch {
      // try the next candidate path
    }
  }
  if (!sqlText) {
    console.warn("[Migrate] supabase/init.sql not found; skipping migrations");
    return null;
  }
  // Drop full-line comments, then split into individual statements. init.sql
  // contains plain DDL only (no functions/strings with semicolons), so a simple
  // ";" split is safe.
  const statements = sqlText
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let ok = 0;
  let failed = 0;
  for (const stmt of statements) {
    try {
      await _client.unsafe(stmt);
      ok++;
    } catch (error) {
      failed++;
      console.warn("[Migrate] statement skipped:", (error as Error).message);
    }
  }
  console.log(`[Migrate] Applied supabase/init.sql (${ok} statements ok, ${failed} skipped)`);
  return { ok, failed };
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createUser(data: typeof users.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(users).values(data).returning();
  return row;
}

// Update an existing user's password hash (used by the reset-password flow).
export async function updateUserPassword(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .update(users)
    .set({ passwordHash, lastSignedIn: new Date() })
    .where(eq(users.openId, openId))
    .returning();
  return row;
}

// ─── Auth OTP codes ───────────────────────────────────────────────────────────
export async function createAuthOtp(data: typeof authOtps.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Only one active code per email+purpose: clear any previous ones first.
  await db.delete(authOtps).where(and(eq(authOtps.email, data.email), eq(authOtps.purpose, data.purpose ?? "signup")));
  const [row] = await db.insert(authOtps).values(data).returning();
  return row;
}

export async function getLatestAuthOtp(email: string, purpose: "signup" | "reset") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(authOtps)
    .where(and(eq(authOtps.email, email), eq(authOtps.purpose, purpose)))
    .orderBy(desc(authOtps.createdAt))
    .limit(1);
  return result[0];
}

export async function bumpAuthOtpAttempts(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(authOtps).set({ attempts: sql`${authOtps.attempts} + 1` }).where(eq(authOtps.id, id));
}

export async function deleteAuthOtp(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authOtps).where(eq(authOtps.id, id));
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
export async function getWorkspaceByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).limit(1);
  return result[0];
}

export async function getWorkspaceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return result[0];
}

export async function createWorkspace(data: { userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(workspaces).values({ userId: data.userId }).returning();
  return row;
}

export async function updateWorkspace(id: number, data: Partial<typeof workspaces.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(workspaces).set(data).where(eq(workspaces.id, id));
}

// ─── Agents ───────────────────────────────────────────────────────────────────
export async function getAgentsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).where(eq(agents.workspaceId, workspaceId)).orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return result[0];
}

// Generate an unguessable public token for an agent (used in the embed/widget).
export function newAgentPublicId(): string {
  return randomBytes(16).toString("hex"); // 32 hex chars
}

// Look up an agent by its public token (the id used in the embed code).
export async function getAgentByPublicId(publicId: string) {
  const db = await getDb();
  if (!db || !publicId) return undefined;
  const result = await db.select().from(agents).where(eq(agents.publicId, publicId)).limit(1);
  return result[0];
}

export async function createAgent(data: typeof agents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(agents).values({ ...data, publicId: data.publicId ?? newAgentPublicId() }).returning();
  return row;
}

export async function updateAgent(id: number, data: Partial<typeof agents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
  return row;
}

export async function deleteAgent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(agents).where(eq(agents.id, id));
}

// ─── Knowledge Articles ───────────────────────────────────────────────────────
export async function getArticlesByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeArticles).where(eq(knowledgeArticles.workspaceId, workspaceId)).orderBy(desc(knowledgeArticles.createdAt));
}

export async function getArticleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id)).limit(1);
  return result[0];
}

// Articles available to a specific agent: those assigned to it, plus shared
// articles (agentId IS NULL) that apply to every agent in the workspace.
export async function getArticlesByAgent(workspaceId: number, agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(knowledgeArticles)
    .where(and(eq(knowledgeArticles.workspaceId, workspaceId), or(eq(knowledgeArticles.agentId, agentId), isNull(knowledgeArticles.agentId))))
    .orderBy(desc(knowledgeArticles.createdAt));
}

export async function createArticle(data: typeof knowledgeArticles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(knowledgeArticles).values(data).returning();
  return row;
}

export async function updateArticle(id: number, data: Partial<typeof knowledgeArticles.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(knowledgeArticles).set(data).where(eq(knowledgeArticles.id, id)).returning();
  return row;
}

export async function deleteArticle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
}

// ─── Q&A Pairs ────────────────────────────────────────────────────────────────
export async function getQAPairsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(qaPairs).where(eq(qaPairs.workspaceId, workspaceId)).orderBy(desc(qaPairs.createdAt));
}

// Q&A pairs available to a specific agent: those assigned to it, plus shared
// pairs (agentId IS NULL) that apply to every agent in the workspace.
export async function getQAPairsByAgent(workspaceId: number, agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(qaPairs)
    .where(and(eq(qaPairs.workspaceId, workspaceId), or(eq(qaPairs.agentId, agentId), isNull(qaPairs.agentId))))
    .orderBy(desc(qaPairs.createdAt));
}

export async function createQAPair(data: typeof qaPairs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(qaPairs).values(data).returning();
  return row;
}

export async function updateQAPair(id: number, data: Partial<typeof qaPairs.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(qaPairs).set(data).where(eq(qaPairs.id, id)).returning();
  return row;
}

export async function deleteQAPair(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(qaPairs).where(eq(qaPairs.id, id));
}

// ─── Conversations ────────────────────────────────────────────────────────────
export async function getConversationsByWorkspace(workspaceId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(conversations.workspaceId, workspaceId)];
  if (status) conditions.push(eq(conversations.status, status as "open" | "pending" | "resolved"));
  return db.select().from(conversations).where(and(...conditions)).orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

export async function createConversation(data: typeof conversations.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(conversations).values(data).returning();
  return row;
}

export async function updateConversation(id: number, data: Partial<typeof conversations.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(conversations).set(data).where(eq(conversations.id, id)).returning();
  return row;
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function getMessagesByConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

export async function createMessage(data: typeof messages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(messages).values(data).returning();
  return row;
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
export async function getTicketsByWorkspace(workspaceId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tickets.workspaceId, workspaceId)];
  if (status) conditions.push(eq(tickets.status, status as "open" | "in-progress" | "closed"));
  const rows = await db
    .select()
    .from(tickets)
    .leftJoin(contacts, eq(tickets.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt));
  return rows.map((r) => ({ ...r.tickets, contactName: r.contacts?.name ?? null, contactEmail: r.contacts?.email ?? null }));
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(tickets)
    .leftJoin(contacts, eq(tickets.contactId, contacts.id))
    .where(eq(tickets.id, id))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.tickets, contactName: r.contacts?.name ?? null, contactEmail: r.contacts?.email ?? null } : undefined;
}

export async function getTicketsByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tickets).where(eq(tickets.contactId, contactId)).orderBy(desc(tickets.createdAt));
}

export async function getTicketByConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tickets).where(eq(tickets.conversationId, conversationId)).limit(1);
  return result[0];
}

export async function createTicket(data: typeof tickets.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(tickets).values(data).returning();
  return row;
}

export async function updateTicket(id: number, data: Partial<typeof tickets.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(tickets).set(data).where(eq(tickets.id, id)).returning();
  return row;
}

export async function deleteTicket(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(tickets).where(eq(tickets.id, id));
}

// ─── Ticket Notes ────────────────────────────────────────────────────────────────
export async function getNotesByTicket(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketNotes).where(eq(ticketNotes.ticketId, ticketId)).orderBy(ticketNotes.createdAt);
}

export async function createTicketNote(data: typeof ticketNotes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [note] = await db.insert(ticketNotes).values(data).returning();
  return note ?? null;
}

export async function deleteTicketNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(ticketNotes).where(eq(ticketNotes.id, id));
}

// ─── Canned Responses (Quick Replies) ─────────────────────────────────────────
const DEFAULT_CANNED_RESPONSES: Array<{ title: string; content: string; category: string; shortcut: string }> = [
  {
    title: "Greeting",
    content: "Hi {{name}}, thanks for reaching out! My name is here to help. How can I assist you today?",
    category: "Greetings",
    shortcut: "/hi",
  },
  {
    title: "Acknowledge & investigate",
    content: "Thanks for the details, {{name}}. I'm looking into this for you right now and will get back to you shortly.",
    category: "General",
    shortcut: "/look",
  },
  {
    title: "Ask for more info",
    content: "To help me resolve this faster, could you please share a bit more detail (such as your account email, order number, or a screenshot of the issue)?",
    category: "General",
    shortcut: "/info",
  },
  {
    title: "Apologize for the inconvenience",
    content: "I'm really sorry for the inconvenience this has caused, {{name}}. Let's get this sorted out for you as quickly as possible.",
    category: "General",
    shortcut: "/sorry",
  },
  {
    title: "Issue resolved",
    content: "Glad I could help, {{name}}! I'll go ahead and mark this as resolved. Feel free to reach out anytime if you need anything else.",
    category: "Closing",
    shortcut: "/done",
  },
  {
    title: "Closing & follow-up",
    content: "Is there anything else I can help you with today? If not, have a wonderful day!",
    category: "Closing",
    shortcut: "/bye",
  },
];

export async function getCannedResponsesByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  const existing = await db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.workspaceId, workspaceId))
    .orderBy(desc(cannedResponses.usageCount), desc(cannedResponses.updatedAt));
  if (existing.length > 0) return existing;

  // Seed sensible defaults the first time a workspace opens quick replies.
  await db.insert(cannedResponses).values(
    DEFAULT_CANNED_RESPONSES.map((r) => ({ ...r, workspaceId }))
  );
  return db
    .select()
    .from(cannedResponses)
    .where(eq(cannedResponses.workspaceId, workspaceId))
    .orderBy(desc(cannedResponses.usageCount), desc(cannedResponses.updatedAt));
}

export async function getCannedResponseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cannedResponses).where(eq(cannedResponses.id, id)).limit(1);
  return result[0];
}

export async function createCannedResponse(data: typeof cannedResponses.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(cannedResponses).values(data).returning();
  return row;
}

export async function updateCannedResponse(id: number, data: Partial<typeof cannedResponses.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(cannedResponses).set(data).where(eq(cannedResponses.id, id)).returning();
  return row;
}

export async function incrementCannedResponseUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(cannedResponses)
    .set({ usageCount: sql`${cannedResponses.usageCount} + 1` })
    .where(eq(cannedResponses.id, id));
}

export async function deleteCannedResponse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(cannedResponses).where(eq(cannedResponses.id, id));
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function getCampaignsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).where(eq(campaigns.workspaceId, workspaceId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0];
}

export async function createCampaign(data: typeof campaigns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(campaigns).values(data).returning();
  return row;
}

export async function updateCampaign(id: number, data: Partial<typeof campaigns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning();
  return row;
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotificationsByWorkspace(workspaceId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.workspaceId, workspaceId)];
  if (userId) conditions.push(eq(notifications.userId, userId));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

// Count conversations in a given status (e.g. "open") for the Inbox badge.
export async function countConversationsByStatus(workspaceId: number, status: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.status, status as "open" | "pending" | "resolved")));
  return Number(result[0]?.count ?? 0);
}

// Count UNREAD open conversations (never opened by an agent, lastReadAt null) —
// this is what the Inbox badge shows, so it clears as the agent opens chats.
export async function countUnreadConversations(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.status, "open"), isNull(conversations.lastReadAt)));
  return Number(result[0]?.count ?? 0);
}

// Mark a conversation as read (agent opened it) so it stops counting as unread.
export async function markConversationRead(conversationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ lastReadAt: new Date() }).where(eq(conversations.id, conversationId));
}

// Flag a conversation as unread again (e.g. a new visitor message arrived).
export async function markConversationUnread(conversationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ lastReadAt: null }).where(eq(conversations.id, conversationId));
}

// Count tickets in a given status (e.g. "open") for the Tickets badge.
export async function countTicketsByStatus(workspaceId: number, status: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.status, status as "open" | "pending" | "resolved" | "closed")));
  return Number(result[0]?.count ?? 0);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(workspaceId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, userId)));
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalyticsSummary(workspaceId: number) {
  const db = await getDb();
  if (!db) return { total: 0, resolved: 0, escalated: 0, avgCsat: 0 };

  // Single round-trip with conditional aggregation instead of 4 separate
  // COUNT queries (each of which was a separate network round-trip).
  const rows = await db
    .select({
      total: sql<number>`count(*)`,
      resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
      escalated: sql<number>`count(*) filter (where ${conversations.isEscalated} = true)`,
      avgCsat: sql<number>`coalesce(avg(${conversations.csatScore}), 0)`,
    })
    .from(conversations)
    .where(eq(conversations.workspaceId, workspaceId));
  const r = rows[0];

  return {
    total: Number(r?.total ?? 0),
    resolved: Number(r?.resolved ?? 0),
    escalated: Number(r?.escalated ?? 0),
    avgCsat: Number(r?.avgCsat ?? 0),
  };
}

export async function getConversationsByDay(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      date: sql<string>`(${conversations.createdAt})::date`,
      count: sql<number>`count(*)`,
    })
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), sql`${conversations.createdAt} >= NOW() - INTERVAL '30 days'`))
    .groupBy(sql`(${conversations.createdAt})::date`)
    .orderBy(sql`(${conversations.createdAt})::date`);
  return result;
}

export async function getAgentPerformance(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  const agentList = await db.select().from(agents).where(eq(agents.workspaceId, workspaceId));
  const performance = await Promise.all(
    agentList.map(async (agent) => {
      const total = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.agentId, agent.id)));
      const resolved = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.agentId, agent.id), eq(conversations.status, "resolved")));
      const escalated = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.agentId, agent.id), eq(conversations.isEscalated, true)));
      return {
        agent,
        total: Number(total[0]?.count ?? 0),
        resolved: Number(resolved[0]?.count ?? 0),
        escalated: Number(escalated[0]?.count ?? 0),
      };
    })
  );
  return performance;
}

// ─── Playground Sessions ──────────────────────────────────────────────────────
export async function getOrCreatePlaygroundSession(agentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(playgroundSessions).where(and(eq(playgroundSessions.agentId, agentId), eq(playgroundSessions.userId, userId))).limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db.insert(playgroundSessions).values({ agentId, userId, messages: [] }).returning();
  return row;
}

export async function updatePlaygroundSession(id: number, data: Partial<typeof playgroundSessions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(playgroundSessions).set(data).where(eq(playgroundSessions.id, id)).returning();
  return row;
}


// ─── Contacts ─────────────────────────────────────────────────────────────────
export async function getContactsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId)).orderBy(desc(contacts.updatedAt));
}

// Legacy alias: the "growth" plan was renamed to "pro". Normalize any old
// stored/legacy value so it still resolves to the right limits and price.
export function normalizePlan(plan?: string | null): string {
  if (!plan) return "free";
  return plan === "growth" ? "pro" : plan;
}

// Plan tiers in ascending order, for boolean feature gating.
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3, enterprise: 4 };

// Minimum plan required for each gated (boolean) feature. Keep in sync with the
// pricing/comparison tables shown to users.
export const FEATURE_MIN_PLAN: Record<string, string> = {
  learnFromWebsite: "starter",
  premiumIcons: "starter",
  removeBranding: "starter",
  humanHandoff: "starter",
  emailBranding: "pro",
  csvExport: "pro",
};

// True when the given plan includes the named feature (tier >= the minimum).
export function planHasFeature(plan: string | null | undefined, feature: string): boolean {
  const min = FEATURE_MIN_PLAN[feature];
  if (!min) return true; // unknown feature → not gated
  return (PLAN_RANK[normalizePlan(plan)] ?? 0) >= (PLAN_RANK[min] ?? 99);
}

// Per-plan contact storage limits. Use Infinity for "unlimited". Keep plan ids
// in sync with CONVERSATION_LIMITS / TEAM_SEAT_LIMITS / AGENT_LIMITS /
// PLAN_PRICE_CENTS and the public plan lists.
export const CONTACT_LIMITS: Record<string, number> = {
  free: 30,
  starter: 1000,
  pro: 5000,
  business: 25000,
  enterprise: Number.POSITIVE_INFINITY,
};

export function contactLimitForPlan(plan?: string | null): number {
  return CONTACT_LIMITS[normalizePlan(plan)] ?? CONTACT_LIMITS.free;
}

// Per-plan monthly AI-conversation limits. A conversation is one visitor chat
// thread. Only AI-handled threads count toward this cap — once a conversation
// is escalated to a human it no longer counts, so human conversations are
// effectively UNLIMITED on every plan. Counted per calendar month.
export const CONVERSATION_LIMITS: Record<string, number> = {
  free: 50,
  starter: 1000,
  pro: 6000,
  business: 20000,
  enterprise: Number.POSITIVE_INFINITY,
};

export function conversationLimitForPlan(plan?: string | null): number {
  return CONVERSATION_LIMITS[normalizePlan(plan)] ?? CONVERSATION_LIMITS.free;
}

// Per-plan monthly support-ticket creation limits. Free includes 30 tickets/mo
// (create & respond); all paid plans are unlimited. Use Infinity for unlimited.
export const TICKET_LIMITS: Record<string, number> = {
  free: 30,
  starter: Number.POSITIVE_INFINITY,
  pro: Number.POSITIVE_INFINITY,
  business: Number.POSITIVE_INFINITY,
  enterprise: Number.POSITIVE_INFINITY,
};

export function ticketLimitForPlan(plan?: string | null): number {
  return TICKET_LIMITS[normalizePlan(plan)] ?? TICKET_LIMITS.free;
}

// Per-plan limit on how many AI agents a workspace can create.
export const AGENT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  pro: 5,
  business: 15,
  enterprise: Number.POSITIVE_INFINITY,
};

export function agentLimitForPlan(plan?: string | null): number {
  return AGENT_LIMITS[normalizePlan(plan)] ?? AGENT_LIMITS.free;
}

// Count conversations created in the current calendar month for a workspace.
export async function countConversationsThisMonth(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), gte(conversations.createdAt, startOfMonth)));
  return Number(result[0]?.count ?? 0);
}

// Count AI-handled conversations this month (excludes any thread escalated to a
// human). This is what the monthly plan cap is measured against, so human
// conversations never count and are effectively unlimited on every plan.
export async function countAiConversationsThisMonth(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        gte(conversations.createdAt, startOfMonth),
        eq(conversations.isEscalated, false),
      ),
    );
  return Number(result[0]?.count ?? 0);
}

// Count support tickets created in the current calendar month for a workspace
// (for the monthly ticket-limit enforcement).
export async function countTicketsThisMonth(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(tickets)
    .where(and(eq(tickets.workspaceId, workspaceId), gte(tickets.createdAt, startOfMonth)));
  return Number(result[0]?.count ?? 0);
}

// Count AI agents owned by a workspace (for plan agent-limit enforcement).
export async function countAgentsByWorkspace(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId));
  return Number(result[0]?.count ?? 0);
}

export async function countContactsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.workspaceId, workspaceId));
  return Number(result[0]?.count ?? 0);
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result[0];
}

export async function findContactByEmail(workspaceId: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.email, email)))
    .limit(1);
  return result[0];
}

// Subscribed contacts that have an email address — the audience for an email
// campaign broadcast.
export async function getSubscribedContactsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.subscribed, true)));
  return rows.filter((c) => !!c.email && c.email.trim().length > 0);
}

export async function createContact(data: typeof contacts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(contacts).values(data).returning();
  return row;
}

export async function updateContact(id: number, data: Partial<typeof contacts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
  return row;
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(contacts).where(eq(contacts.id, id));
}

export async function getContactStats(workspaceId: number) {
  const db = await getDb();
  if (!db) return { total: 0, subscribed: 0, active30d: 0, openTickets: 0 };

  const total = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(eq(contacts.workspaceId, workspaceId));
  const subscribed = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.subscribed, true)));
  const active = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), sql`${contacts.lastSeenAt} >= NOW() - INTERVAL '30 days'`));
  const openTickets = await db.select({ count: sql<number>`count(*)` }).from(tickets).where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.status, "open")));

  return {
    total: Number(total[0]?.count ?? 0),
    subscribed: Number(subscribed[0]?.count ?? 0),
    active30d: Number(active[0]?.count ?? 0),
    openTickets: Number(openTickets[0]?.count ?? 0),
  };
}

// ─── Team Members ─────────────────────────────────────────────────────────────

// Seat limits per plan. The workspace owner counts as one seat, so the number
// of additional team_members allowed is (limit - 1). Keep plan ids in sync with
// CONTACT_LIMITS / the Onboarding plan list.
export const TEAM_SEAT_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  pro: 10,
  business: 25,
  enterprise: Number.POSITIVE_INFINITY,
};

export function teamSeatLimitForPlan(plan?: string | null): number {
  return TEAM_SEAT_LIMITS[normalizePlan(plan)] ?? TEAM_SEAT_LIMITS.free;
}

export async function getTeamMembersByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers).where(eq(teamMembers.workspaceId, workspaceId)).orderBy(desc(teamMembers.createdAt));
}

export async function findTeamMemberByEmail(workspaceId: number, email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.workspaceId, workspaceId), ilike(teamMembers.email, email)))
    .limit(1);
  return result[0];
}

export async function countTeamMembersByWorkspace(workspaceId: number) {
  const rows = await getTeamMembersByWorkspace(workspaceId);
  return rows.length;
}

export async function createTeamMember(data: typeof teamMembers.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(teamMembers).values(data).returning();
  return row;
}

export async function updateTeamMember(id: number, data: Partial<typeof teamMembers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
  return row;
}

export async function deleteTeamMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}

// Look up a pending invite by its one-time token.
export async function getTeamMemberByInviteToken(token: string) {
  const db = await getDb();
  if (!db || !token) return undefined;
  const result = await db.select().from(teamMembers).where(eq(teamMembers.inviteToken, token)).limit(1);
  return result[0];
}

// Approve an invite: mark active, stamp acceptedAt, and clear the token.
export async function acceptTeamMemberInvite(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .update(teamMembers)
    .set({ status: "active", acceptedAt: new Date(), inviteToken: null })
    .where(eq(teamMembers.id, id))
    .returning();
  return row;
}


// ─── Affiliates / Referrals ─────────────────────────────────────────────────--
// Tiered commission rates based on the affiliate's number of referrals.
export const AFFILIATE_TIERS: Array<{ label: string; min: number; rate: number }> = [
  { label: "1–10 referrals", min: 1, rate: 10 },
  { label: "10–20 referrals", min: 10, rate: 20 },
  { label: "20–100 referrals", min: 20, rate: 25 },
  { label: "100–1000 referrals", min: 100, rate: 30 },
];

export function commissionRateForReferrals(count: number): number {
  let rate = 0;
  for (const tier of AFFILIATE_TIERS) {
    if (count >= tier.min) rate = tier.rate;
  }
  return rate;
}

// Monthly sale value (in cents) used as the commission base when a referred
// workspace upgrades to a paid plan. Free tiers are 0 (no commission).
// "enterprise" is custom-priced, so it stays 0 here and can be credited
// manually by an admin. Keep the plan ids in sync with CONTACT_LIMITS / the
// Onboarding plan list.
export const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  starter: 999,
  pro: 4900,
  business: 12900,
  enterprise: 0,
};

export function planPriceCents(plan?: string | null): number {
  if (!plan) return 0;
  return PLAN_PRICE_CENTS[normalizePlan(plan)] ?? 0;
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export async function createPayment(data: typeof payments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.insert(payments).values(data).returning();
  return rows[0];
}

export async function getPaymentByExternalId(externalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(payments).where(eq(payments.externalId, externalId)).limit(1);
  return rows[0];
}

export async function updatePayment(id: number, data: Partial<typeof payments.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payments).set({ ...data, updatedAt: new Date() }).where(eq(payments.id, id));
}

// All payments across the platform (billing log), newest first.
export async function getAllPayments(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).orderBy(desc(payments.createdAt)).limit(limit);
}

export async function getAffiliateByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  return result[0];
}

export async function getAffiliateByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(affiliates).where(eq(affiliates.code, code)).limit(1);
  return result[0];
}

export async function createAffiliate(data: typeof affiliates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(affiliates).values(data).returning();
  return row;
}

export async function getReferralsByAffiliate(affiliateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(referrals).where(eq(referrals.affiliateId, affiliateId)).orderBy(desc(referrals.createdAt));
}

export async function createReferral(data: typeof referrals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(referrals).values(data).returning();
  return row;
}

// Find the most recent referral attributed to a given referred email. Used to
// credit the referring affiliate when that person later upgrades their plan.
export async function getReferralByEmail(email: string) {
  const db = await getDb();
  if (!db || !email) return undefined;
  const result = await db
    .select()
    .from(referrals)
    .where(ilike(referrals.referredEmail, email))
    .orderBy(desc(referrals.createdAt))
    .limit(1);
  return result[0];
}

export async function updateReferral(id: number, data: Partial<typeof referrals.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
  return row;
}


// ─── Global search ──────────────────────────────────────────────────────────-
export interface SearchResult {
  type: "agent" | "contact" | "article" | "qa" | "conversation" | "campaign";
  id: number;
  title: string;
  subtitle: string;
}

// Workspace-scoped fuzzy search across the main entities, used by the dashboard
// live search. Each entity is capped so the dropdown stays fast and small.
export async function searchWorkspace(workspaceId: number, q: string): Promise<SearchResult[]> {
  const database = await getDb();
  if (!database) return [];
  const term = `%${q}%`;
  const out: SearchResult[] = [];

  const agentRows = await database.select().from(agents)
    .where(and(eq(agents.workspaceId, workspaceId), ilike(agents.name, term))).limit(5);
  for (const a of agentRows) out.push({ type: "agent", id: a.id, title: a.name, subtitle: "AI Agent" });

  const contactRows = await database.select().from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), or(ilike(contacts.name, term), ilike(contacts.email, term), ilike(contacts.company, term)))).limit(5);
  for (const c of contactRows) out.push({ type: "contact", id: c.id, title: c.name ?? c.email ?? "Contact", subtitle: c.email ?? "Contact" });

  const articleRows = await database.select().from(knowledgeArticles)
    .where(and(eq(knowledgeArticles.workspaceId, workspaceId), or(ilike(knowledgeArticles.title, term), ilike(knowledgeArticles.content, term)))).limit(5);
  for (const a of articleRows) out.push({ type: "article", id: a.id, title: a.title, subtitle: "Knowledge article" });

  const qaRows = await database.select().from(qaPairs)
    .where(and(eq(qaPairs.workspaceId, workspaceId), or(ilike(qaPairs.question, term), ilike(qaPairs.answer, term)))).limit(5);
  for (const qa of qaRows) out.push({ type: "qa", id: qa.id, title: qa.question, subtitle: "Q&A pair" });

  const convRows = await database.select().from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), or(ilike(conversations.visitorName, term), ilike(conversations.visitorEmail, term)))).limit(5);
  for (const c of convRows) out.push({ type: "conversation", id: c.id, title: c.visitorName ?? c.visitorEmail ?? `Conversation #${c.id}`, subtitle: "Conversation" });

  const campaignRows = await database.select().from(campaigns)
    .where(and(eq(campaigns.workspaceId, workspaceId), or(ilike(campaigns.name, term), ilike(campaigns.subject, term)))).limit(5);
  for (const c of campaignRows) out.push({ type: "campaign", id: c.id, title: c.name, subtitle: "Campaign" });

  return out;
}


// ─── Platform admin (super-admin across all workspaces) ───────────────────────
export async function getAllUsers(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
  return row;
}

export async function getAllWorkspaces(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaces).orderBy(desc(workspaces.createdAt)).limit(limit);
}

export async function getPlatformStats() {
  const db = await getDb();
  const empty = { users: 0, workspaces: 0, agents: 0, conversations: 0, tickets: 0, contacts: 0 };
  if (!db) return empty;
  const one = async (table: typeof users | typeof workspaces | typeof agents | typeof conversations | typeof tickets | typeof contacts) => {
    const r = await db.select({ c: sql<number>`count(*)` }).from(table);
    return Number(r[0]?.c ?? 0);
  };
  const [u, w, a, c, t, ct] = await Promise.all([
    one(users), one(workspaces), one(agents), one(conversations), one(tickets), one(contacts),
  ]);
  return { users: u, workspaces: w, agents: a, conversations: c, tickets: t, contacts: ct };
}

// Per-workspace usage counts for the admin usage view. Uses GROUP BY so it's a
// handful of queries regardless of how many workspaces exist.
export async function getUsageCountsByWorkspace() {
  const empty = {
    agents: new Map<number, number>(),
    contacts: new Map<number, number>(),
    aiConversations: new Map<number, number>(),
    tickets: new Map<number, number>(),
    seats: new Map<number, number>(),
  };
  const db = await getDb();
  if (!db) return empty;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toMap = (rows: Array<{ wid: number | null; c: number }>) =>
    new Map(rows.map((r) => [Number(r.wid), Number(r.c)]));
  const [ag, ct, convo, tk, tm] = await Promise.all([
    db.select({ wid: agents.workspaceId, c: sql<number>`count(*)` }).from(agents).groupBy(agents.workspaceId),
    db.select({ wid: contacts.workspaceId, c: sql<number>`count(*)` }).from(contacts).groupBy(contacts.workspaceId),
    db.select({ wid: conversations.workspaceId, c: sql<number>`count(*)` }).from(conversations)
      .where(and(gte(conversations.createdAt, monthStart), eq(conversations.isEscalated, false)))
      .groupBy(conversations.workspaceId),
    db.select({ wid: tickets.workspaceId, c: sql<number>`count(*)` }).from(tickets)
      .where(gte(tickets.createdAt, monthStart)).groupBy(tickets.workspaceId),
    db.select({ wid: teamMembers.workspaceId, c: sql<number>`count(*)` }).from(teamMembers).groupBy(teamMembers.workspaceId),
  ]);
  return {
    agents: toMap(ag),
    contacts: toMap(ct),
    aiConversations: toMap(convo),
    tickets: toMap(tk),
    seats: toMap(tm),
  };
}

// ─── Admin: suspend / delete / audit log / settings / growth ──────────────────
export async function setUserSuspended(id: number, suspended: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(users).set({ suspended }).where(eq(users.id, id)).returning();
  return row;
}

// Record a user's IP: always update lastIp; set signupIp only the first time.
export async function setUserIp(userId: number, ip: string) {
  const db = await getDb();
  if (!db || !ip) return;
  try {
    await db.update(users)
      .set({ lastIp: ip, signupIp: sql`COALESCE(${users.signupIp}, ${ip})` })
      .where(eq(users.id, userId));
  } catch (e) {
    console.error("[Auth] failed to record IP", e);
  }
}

// Delete a workspace and all of its data. Destructive and irreversible.
export async function deleteWorkspaceCascade(workspaceId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const convs = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.workspaceId, workspaceId));
  const convIds = convs.map((c) => c.id);
  const ags = await db.select({ id: agents.id }).from(agents).where(eq(agents.workspaceId, workspaceId));
  const agentIds = ags.map((a) => a.id);
  const tks = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.workspaceId, workspaceId));
  const ticketIds = tks.map((t) => t.id);
  if (convIds.length) await db.delete(messages).where(inArray(messages.conversationId, convIds));
  if (agentIds.length) await db.delete(playgroundSessions).where(inArray(playgroundSessions.agentId, agentIds));
  if (ticketIds.length) await db.delete(ticketNotes).where(inArray(ticketNotes.ticketId, ticketIds));
  await db.delete(conversations).where(eq(conversations.workspaceId, workspaceId));
  await db.delete(tickets).where(eq(tickets.workspaceId, workspaceId));
  await db.delete(contacts).where(eq(contacts.workspaceId, workspaceId));
  await db.delete(teamMembers).where(eq(teamMembers.workspaceId, workspaceId));
  await db.delete(knowledgeArticles).where(eq(knowledgeArticles.workspaceId, workspaceId));
  await db.delete(qaPairs).where(eq(qaPairs.workspaceId, workspaceId));
  await db.delete(campaigns).where(eq(campaigns.workspaceId, workspaceId));
  await db.delete(cannedResponses).where(eq(cannedResponses.workspaceId, workspaceId));
  await db.delete(notifications).where(eq(notifications.workspaceId, workspaceId));
  await db.delete(payments).where(eq(payments.workspaceId, workspaceId));
  await db.delete(analyticsEvents).where(eq(analyticsEvents.workspaceId, workspaceId));
  await db.delete(agents).where(eq(agents.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

// Delete a user, their workspace(s) and all related data. Destructive.
export async function deleteUserCascade(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const wss = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.userId, userId));
  for (const w of wss) await deleteWorkspaceCascade(w.id);
  await db.delete(affiliates).where(eq(affiliates.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function refundPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, id)).returning();
  return row;
}

export async function createAdminLog(data: typeof adminLogs.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(adminLogs).values(data);
  } catch (e) {
    console.error("[AdminLog] failed to record", e);
  }
}

export async function getAdminLogs(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit);
}

// ─── Support messages (user → platform admin) ─────────────────────────────────
export async function createSupportMessage(data: typeof supportMessages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(supportMessages).values(data).returning();
  return row;
}

export async function getSupportMessagesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(desc(supportMessages.createdAt));
}

export async function getAllSupportMessages(limit = 300) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt)).limit(limit);
}

export async function getSupportMessageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(supportMessages).where(eq(supportMessages.id, id)).limit(1);
  return r[0];
}

export async function updateSupportMessage(id: number, data: Partial<typeof supportMessages.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(supportMessages).set(data).where(eq(supportMessages.id, id));
}

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return r[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({
    target: appSettings.key,
    set: { value, updatedAt: new Date() },
  });
}

// New sign-ups per day over the last 30 days (for the admin growth chart).
export async function getSignupsByDay() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ date: sql<string>`(${users.createdAt})::date`, count: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.createdAt} >= NOW() - INTERVAL '30 days'`)
    .groupBy(sql`(${users.createdAt})::date`)
    .orderBy(sql`(${users.createdAt})::date`);
}

// Paid revenue (cents) per day over the last 30 days (for the growth chart).
export async function getRevenueByDay() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ date: sql<string>`(${payments.createdAt})::date`, cents: sql<number>`coalesce(sum(${payments.amountCents}),0)` })
    .from(payments)
    .where(and(eq(payments.status, "paid"), sql`${payments.createdAt} >= NOW() - INTERVAL '30 days'`))
    .groupBy(sql`(${payments.createdAt})::date`)
    .orderBy(sql`(${payments.createdAt})::date`);
}

// ─── Affiliate payouts / withdrawals ──────────────────────────────────────────
export async function getAffiliateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1);
  return result[0];
}

export async function getAllAffiliates(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliates).orderBy(desc(affiliates.createdAt)).limit(limit);
}

export async function updateAffiliateAdjustment(id: number, adjustmentCents: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(affiliates).set({ adjustmentCents }).where(eq(affiliates.id, id)).returning();
  return row;
}

export async function createPayoutRequest(data: typeof payoutRequests.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(payoutRequests).values(data).returning();
  return row;
}

export async function getPayoutsByAffiliate(affiliateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payoutRequests).where(eq(payoutRequests.affiliateId, affiliateId)).orderBy(desc(payoutRequests.createdAt));
}

export async function getAllPayouts(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payoutRequests).orderBy(desc(payoutRequests.createdAt)).limit(limit);
}

export async function updatePayoutStatus(id: number, status: "pending" | "approved" | "paid" | "rejected", adminNote?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.update(payoutRequests)
    .set({ status, adminNote: adminNote ?? null, processedAt: new Date() })
    .where(eq(payoutRequests.id, id)).returning();
  return row;
}

// Cents reserved against an affiliate's balance: everything not rejected.
export async function getReservedPayoutCents(affiliateId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(payoutRequests).where(eq(payoutRequests.affiliateId, affiliateId));
  return rows.filter((p) => p.status !== "rejected").reduce((s, p) => s + (p.amountCents ?? 0), 0);
}
