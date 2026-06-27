import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser,
  affiliates,
  agents,
  cannedResponses,
  campaigns,
  contacts,
  conversations,
  knowledgeArticles,
  messages,
  notifications,
  playgroundSessions,
  qaPairs,
  referrals,
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

export async function createUser(data: typeof users.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(users).values(data).returning();
  return row;
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

export async function createAgent(data: typeof agents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(agents).values(data).returning();
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
  return db.select().from(tickets).where(and(...conditions)).orderBy(desc(tickets.createdAt));
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return result[0];
}

export async function getTicketsByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tickets).where(eq(tickets.contactId, contactId)).orderBy(desc(tickets.createdAt));
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

  const total = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(eq(conversations.workspaceId, workspaceId));
  const resolved = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.status, "resolved")));
  const escalated = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.isEscalated, true)));
  const csatResult = await db.select({ avg: sql<number>`avg(${conversations.csatScore})` }).from(conversations).where(and(eq(conversations.workspaceId, workspaceId)));

  return {
    total: Number(total[0]?.count ?? 0),
    resolved: Number(resolved[0]?.count ?? 0),
    escalated: Number(escalated[0]?.count ?? 0),
    avgCsat: Number(csatResult[0]?.avg ?? 0),
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

// Per-plan contact storage limits. The free "starter" plan stores up to 100
// contacts; higher plans store more. Use Infinity for "unlimited".
export const CONTACT_LIMITS: Record<string, number> = {
  starter: 100,
  free: 100,
  growth: 5000,
  enterprise: Number.POSITIVE_INFINITY,
};

export function contactLimitForPlan(plan?: string | null): number {
  if (!plan) return CONTACT_LIMITS.starter;
  return CONTACT_LIMITS[plan] ?? CONTACT_LIMITS.starter;
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
export async function getTeamMembersByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers).where(eq(teamMembers.workspaceId, workspaceId)).orderBy(desc(teamMembers.createdAt));
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
  return {
    users: await one(users),
    workspaces: await one(workspaces),
    agents: await one(agents),
    conversations: await one(conversations),
    tickets: await one(tickets),
    contacts: await one(contacts),
  };
}
