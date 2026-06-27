import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Timestamps stored as timezone-aware values, returned to the app as JS Dates
// (matching the previous MySQL behaviour).
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: text("role").$type<"user" | "admin">().default("user").notNull(),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: ts("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }),
  companyWebsite: varchar("companyWebsite", { length: 512 }),
  industry: varchar("industry", { length: 128 }),
  companySize: varchar("companySize", { length: 64 }),
  features: jsonb("features").$type<string[]>(),
  plan: varchar("plan", { length: 64 }).default("starter"),
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  onboardingStep: integer("onboardingStep").default(1),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Workspace = typeof workspaces.$inferSelect;

// ─── AI Agents ────────────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatarUrl"),
  tone: text("tone").$type<"formal" | "friendly" | "professional" | "casual" | "empathetic">().default("professional"),
  language: varchar("language", { length: 64 }).default("English"),
  responseStyle: text("responseStyle").$type<"conservative" | "balanced" | "creative">().default("balanced"),
  maxResponseLength: text("maxResponseLength").$type<"short" | "medium" | "long">().default("medium"),
  typingDelay: integer("typingDelay").default(0),
  systemPrompt: text("systemPrompt"),
  fallbackMessage: text("fallbackMessage"),
  welcomeMessage: text("welcomeMessage"),
  handoffMode: text("handoffMode").$type<"ai_only" | "ai_first_human_escalation" | "human_only">().default("ai_only"),
  escalationTriggers: jsonb("escalationTriggers").$type<string[]>(),
  escalationMessage: text("escalationMessage"),
  workingHoursEnabled: boolean("workingHoursEnabled").default(false),
  workingHours: jsonb("workingHours").$type<Record<string, { start: string; end: string; enabled: boolean }>>(),
  offlineMessage: text("offlineMessage"),
  leadCaptureEnabled: boolean("leadCaptureEnabled").default(false),
  leadCaptureFields: jsonb("leadCaptureFields").$type<string[]>(),
  widgetColor: varchar("widgetColor", { length: 32 }).default("#6366f1"),
  widgetPosition: text("widgetPosition").$type<"bottom-right" | "bottom-left">().default("bottom-right"),
  widgetSize: text("widgetSize").$type<"compact" | "standard" | "large">().default("standard"),
  widgetTheme: text("widgetTheme").$type<"light" | "dark">().default("light"),
  widgetFont: varchar("widgetFont", { length: 128 }).default("Inter"),
  launcherIconUrl: text("launcherIconUrl"),
  brandLogoUrl: text("brandLogoUrl"),
  customCss: text("customCss"),
  isActive: boolean("isActive").default(true),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Agent = typeof agents.$inferSelect;

// ─── Knowledge Base Articles ──────────────────────────────────────────────────
export const knowledgeArticles = pgTable("knowledge_articles", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: integer("agentId"),
  title: varchar("title", { length: 512 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 128 }),
  tags: jsonb("tags").$type<string[]>(),
  imageUrl: text("imageUrl"),
  status: text("status").$type<"indexing" | "ready" | "failed">().default("ready"),
  sourceUrl: text("sourceUrl"),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;

// ─── Q&A Pairs ────────────────────────────────────────────────────────────────
export const qaPairs = pgTable("qa_pairs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: integer("agentId"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 128 }),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type QAPair = typeof qaPairs.$inferSelect;

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: integer("agentId"),
  assignedUserId: integer("assignedUserId"),
  visitorId: varchar("visitorId", { length: 128 }),
  visitorName: varchar("visitorName", { length: 255 }),
  visitorEmail: varchar("visitorEmail", { length: 320 }),
  visitorLocation: varchar("visitorLocation", { length: 255 }),
  status: text("status").$type<"open" | "pending" | "resolved">().default("open"),
  handoffMode: text("handoffMode").$type<"ai" | "human">().default("ai"),
  isEscalated: boolean("isEscalated").default(false),
  csatScore: integer("csatScore"),
  channel: varchar("channel", { length: 64 }).default("web"),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Conversation = typeof conversations.$inferSelect;

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  role: text("role").$type<"user" | "agent" | "system" | "note">().notNull(),
  content: text("content").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentType: varchar("attachmentType", { length: 64 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  isInternal: boolean("isInternal").default(false),
  createdAt: ts("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  conversationId: integer("conversationId"),
  contactId: integer("contactId"),
  assignedUserId: integer("assignedUserId"),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  status: text("status").$type<"open" | "in-progress" | "closed">().default("open"),
  priority: text("priority").$type<"low" | "medium" | "high" | "urgent">().default("medium"),
  tags: jsonb("tags").$type<string[]>(),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Ticket = typeof tickets.$inferSelect;

// ─── Ticket Notes ─────────────────────────────────────────────────────────────
export const ticketNotes = pgTable("ticketNotes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull(),
  userId: integer("userId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(true),
  createdAt: ts("createdAt").defaultNow().notNull(),
});

export type TicketNote = typeof ticketNotes.$inferSelect;
export type InsertTicketNote = typeof ticketNotes.$inferInsert;

// ─── Canned Responses (Quick Replies) ─────────────────────────────────────────
export const cannedResponses = pgTable("canned_responses", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 128 }).default("General"),
  shortcut: varchar("shortcut", { length: 64 }),
  usageCount: integer("usageCount").default(0).notNull(),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CannedResponse = typeof cannedResponses.$inferSelect;
export type InsertCannedResponse = typeof cannedResponses.$inferInsert;

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: integer("agentId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: text("type").$type<"broadcast" | "drip">().default("broadcast"),
  subject: varchar("subject", { length: 512 }),
  message: text("message").notNull(),
  targetSegment: jsonb("targetSegment").$type<Record<string, string>>(),
  targetUrlPattern: varchar("targetUrlPattern", { length: 512 }),
  triggerDelay: integer("triggerDelay").default(0),
  scheduledAt: ts("scheduledAt"),
  status: text("status").$type<"draft" | "scheduled" | "running" | "completed" | "paused">().default("draft"),
  sentCount: integer("sentCount").default(0),
  openCount: integer("openCount").default(0),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Campaign = typeof campaigns.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId"),
  type: text("type").$type<"escalation" | "new_ticket" | "campaign_complete" | "new_conversation" | "system">().notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  isRead: boolean("isRead").default(false),
  relatedId: integer("relatedId"),
  relatedType: varchar("relatedType", { length: 64 }),
  createdAt: ts("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Analytics Events ─────────────────────────────────────────────────────────
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: integer("agentId"),
  conversationId: integer("conversationId"),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: ts("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// ─── Playground Sessions ──────────────────────────────────────────────────────
export const playgroundSessions = pgTable("playground_sessions", {
  id: serial("id").primaryKey(),
  agentId: integer("agentId").notNull(),
  userId: integer("userId").notNull(),
  messages: jsonb("messages").$type<Array<{ role: string; content: string }>>(),
  model: varchar("model", { length: 128 }).default("gpt-4o-mini"),
  answerGuidance: text("answerGuidance").$type<"conservative" | "balanced" | "creative">().default("balanced"),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PlaygroundSession = typeof playgroundSessions.$inferSelect;


// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  company: varchar("company", { length: 255 }),
  channel: varchar("channel", { length: 64 }).default("web"),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  subscribed: boolean("subscribed").default(true),
  lastSeenAt: ts("lastSeenAt"),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// ─── Team Members ─────────────────────────────────────────────────────────────
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: text("role").$type<"owner" | "admin" | "agent">().default("agent"),
  status: text("status").$type<"active" | "invited">().default("invited"),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// ─── Affiliates ───────────────────────────────────────────────────────────────
export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  workspaceId: integer("workspaceId"),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdAt: ts("createdAt").defaultNow().notNull(),
  updatedAt: ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Affiliate = typeof affiliates.$inferSelect;

// ─── Referrals ──────────────────────────────────────────────────────────────--
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliateId").notNull(),
  referredName: varchar("referredName", { length: 255 }),
  referredEmail: varchar("referredEmail", { length: 320 }),
  plan: varchar("plan", { length: 64 }).default("starter"),
  // Attributed monthly revenue from this referral, stored in cents.
  amount: integer("amount").default(0),
  status: text("status").$type<"pending" | "active" | "cancelled">().default("pending"),
  createdAt: ts("createdAt").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
