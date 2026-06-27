import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }),
  companyWebsite: varchar("companyWebsite", { length: 512 }),
  industry: varchar("industry", { length: 128 }),
  companySize: varchar("companySize", { length: 64 }),
  features: json("features").$type<string[]>(),
  plan: varchar("plan", { length: 64 }).default("starter"),
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  onboardingStep: int("onboardingStep").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;

// ─── AI Agents ────────────────────────────────────────────────────────────────
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatarUrl"),
  tone: mysqlEnum("tone", ["formal", "friendly", "professional", "casual", "empathetic"]).default("professional"),
  language: varchar("language", { length: 64 }).default("English"),
  responseStyle: mysqlEnum("responseStyle", ["conservative", "balanced", "creative"]).default("balanced"),
  maxResponseLength: mysqlEnum("maxResponseLength", ["short", "medium", "long"]).default("medium"),
  typingDelay: int("typingDelay").default(0),
  systemPrompt: text("systemPrompt"),
  fallbackMessage: text("fallbackMessage"),
  welcomeMessage: text("welcomeMessage"),
  handoffMode: mysqlEnum("handoffMode", ["ai_only", "ai_first_human_escalation", "human_only"]).default("ai_only"),
  escalationTriggers: json("escalationTriggers").$type<string[]>(),
  escalationMessage: text("escalationMessage"),
  workingHoursEnabled: boolean("workingHoursEnabled").default(false),
  workingHours: json("workingHours").$type<Record<string, { start: string; end: string; enabled: boolean }>>(),
  offlineMessage: text("offlineMessage"),
  leadCaptureEnabled: boolean("leadCaptureEnabled").default(false),
  leadCaptureFields: json("leadCaptureFields").$type<string[]>(),
  widgetColor: varchar("widgetColor", { length: 32 }).default("#6366f1"),
  widgetPosition: mysqlEnum("widgetPosition", ["bottom-right", "bottom-left"]).default("bottom-right"),
  widgetSize: mysqlEnum("widgetSize", ["compact", "standard", "large"]).default("standard"),
  widgetTheme: mysqlEnum("widgetTheme", ["light", "dark"]).default("light"),
  widgetFont: varchar("widgetFont", { length: 128 }).default("Inter"),
  launcherIconUrl: text("launcherIconUrl"),
  brandLogoUrl: text("brandLogoUrl"),
  customCss: text("customCss"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;

// ─── Knowledge Base Articles ──────────────────────────────────────────────────
export const knowledgeArticles = mysqlTable("knowledge_articles", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  title: varchar("title", { length: 512 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 128 }),
  tags: json("tags").$type<string[]>(),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("status", ["indexing", "ready", "failed"]).default("ready"),
  sourceUrl: text("sourceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;

// ─── Q&A Pairs ────────────────────────────────────────────────────────────────
export const qaPairs = mysqlTable("qa_pairs", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QAPair = typeof qaPairs.$inferSelect;

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  assignedUserId: int("assignedUserId"),
  visitorId: varchar("visitorId", { length: 128 }),
  visitorName: varchar("visitorName", { length: 255 }),
  visitorEmail: varchar("visitorEmail", { length: 320 }),
  visitorLocation: varchar("visitorLocation", { length: 255 }),
  status: mysqlEnum("status", ["open", "pending", "resolved"]).default("open"),
  handoffMode: mysqlEnum("handoffMode", ["ai", "human"]).default("ai"),
  isEscalated: boolean("isEscalated").default(false),
  csatScore: int("csatScore"),
  channel: varchar("channel", { length: 64 }).default("web"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "agent", "system", "note"]).notNull(),
  content: text("content").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentType: varchar("attachmentType", { length: 64 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  isInternal: boolean("isInternal").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  conversationId: int("conversationId"),
  assignedUserId: int("assignedUserId"),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["open", "in-progress", "closed"]).default("open"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
// ─── Ticket Notes ─────────────────────────────────────────────────────────────
export const ticketNotes = mysqlTable("ticketNotes", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TicketNote = typeof ticketNotes.$inferSelect;
export type InsertTicketNote = typeof ticketNotes.$inferInsert;

// ─── Canned Responses (Quick Replies) ─────────────────────────────────────────
export const cannedResponses = mysqlTable("canned_responses", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 128 }).default("General"),
  shortcut: varchar("shortcut", { length: 64 }),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type InsertCannedResponse = typeof cannedResponses.$inferInsert;
// ─── Campaigns ────────────────────────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["broadcast", "drip"]).default("broadcast"),
  message: text("message").notNull(),
  targetSegment: json("targetSegment").$type<Record<string, string>>(),
  targetUrlPattern: varchar("targetUrlPattern", { length: 512 }),
  triggerDelay: int("triggerDelay").default(0),
  scheduledAt: timestamp("scheduledAt"),
  status: mysqlEnum("status", ["draft", "scheduled", "running", "completed", "paused"]).default("draft"),
  sentCount: int("sentCount").default(0),
  openCount: int("openCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  userId: int("userId"),
  type: mysqlEnum("type", ["escalation", "new_ticket", "campaign_complete", "new_conversation", "system"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  isRead: boolean("isRead").default(false),
  relatedId: int("relatedId"),
  relatedType: varchar("relatedType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Analytics Events ─────────────────────────────────────────────────────────
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  conversationId: int("conversationId"),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// ─── Playground Sessions ──────────────────────────────────────────────────────
export const playgroundSessions = mysqlTable("playground_sessions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  userId: int("userId").notNull(),
  messages: json("messages").$type<Array<{ role: string; content: string }>>(),
  model: varchar("model", { length: 128 }).default("gpt-4o-mini"),
  answerGuidance: mysqlEnum("answerGuidance", ["conservative", "balanced", "creative"]).default("balanced"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlaygroundSession = typeof playgroundSessions.$inferSelect;
