-- ───────────────────────────────────────────────────────────────────────────
-- Supabase / PostgreSQL schema for fantastic-succotash
--
-- One-time setup: open Supabase -> SQL Editor -> New query, paste this whole
-- file, and click "Run". This creates every table the app needs.
--
-- Column names are camelCase (quoted) to match the Drizzle schema exactly.
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "openId" varchar(64) NOT NULL UNIQUE,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "passwordHash" text,
  "role" text NOT NULL DEFAULT 'user',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSignedIn" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "companyName" varchar(255),
  "companyWebsite" varchar(512),
  "industry" varchar(128),
  "companySize" varchar(64),
  "features" jsonb,
  "plan" varchar(64) DEFAULT 'starter',
  "onboardingCompleted" boolean DEFAULT false,
  "onboardingStep" integer DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "avatarUrl" text,
  "tone" text DEFAULT 'professional',
  "language" varchar(64) DEFAULT 'English',
  "responseStyle" text DEFAULT 'balanced',
  "maxResponseLength" text DEFAULT 'medium',
  "typingDelay" integer DEFAULT 0,
  "systemPrompt" text,
  "fallbackMessage" text,
  "welcomeMessage" text,
  "handoffMode" text DEFAULT 'ai_only',
  "escalationTriggers" jsonb,
  "escalationMessage" text,
  "workingHoursEnabled" boolean DEFAULT false,
  "workingHours" jsonb,
  "offlineMessage" text,
  "leadCaptureEnabled" boolean DEFAULT false,
  "leadCaptureFields" jsonb,
  "widgetColor" varchar(32) DEFAULT '#6366f1',
  "widgetPosition" text DEFAULT 'bottom-right',
  "widgetSize" text DEFAULT 'standard',
  "widgetTheme" text DEFAULT 'light',
  "widgetFont" varchar(128) DEFAULT 'Inter',
  "launcherIconUrl" text,
  "brandLogoUrl" text,
  "customCss" text,
  "isActive" boolean DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "knowledge_articles" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "agentId" integer,
  "title" varchar(512) NOT NULL,
  "content" text,
  "category" varchar(128),
  "tags" jsonb,
  "imageUrl" text,
  "status" text DEFAULT 'ready',
  "sourceUrl" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "qa_pairs" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "agentId" integer,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" varchar(128),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "agentId" integer,
  "assignedUserId" integer,
  "visitorId" varchar(128),
  "visitorName" varchar(255),
  "visitorEmail" varchar(320),
  "visitorLocation" varchar(255),
  "status" text DEFAULT 'open',
  "handoffMode" text DEFAULT 'ai',
  "isEscalated" boolean DEFAULT false,
  "csatScore" integer,
  "channel" varchar(64) DEFAULT 'web',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY,
  "conversationId" integer NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "attachmentUrl" text,
  "attachmentType" varchar(64),
  "attachmentName" varchar(255),
  "isInternal" boolean DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "conversationId" integer,
  "contactId" integer,
  "assignedUserId" integer,
  "title" varchar(512) NOT NULL,
  "description" text,
  "status" text DEFAULT 'open',
  "priority" text DEFAULT 'medium',
  "tags" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ticketNotes" (
  "id" serial PRIMARY KEY,
  "ticketId" integer NOT NULL,
  "userId" integer NOT NULL,
  "content" text NOT NULL,
  "isInternal" boolean DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "canned_responses" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "category" varchar(128) DEFAULT 'General',
  "shortcut" varchar(64),
  "usageCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "agentId" integer,
  "name" varchar(255) NOT NULL,
  "type" text DEFAULT 'broadcast',
  "subject" varchar(512),
  "message" text NOT NULL,
  "targetSegment" jsonb,
  "targetUrlPattern" varchar(512),
  "triggerDelay" integer DEFAULT 0,
  "scheduledAt" timestamptz,
  "status" text DEFAULT 'draft',
  "sentCount" integer DEFAULT 0,
  "openCount" integer DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "userId" integer,
  "type" text NOT NULL,
  "title" varchar(512) NOT NULL,
  "body" text,
  "isRead" boolean DEFAULT false,
  "relatedId" integer,
  "relatedType" varchar(64),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "agentId" integer,
  "conversationId" integer,
  "eventType" varchar(128) NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playground_sessions" (
  "id" serial PRIMARY KEY,
  "agentId" integer NOT NULL,
  "userId" integer NOT NULL,
  "messages" jsonb,
  "model" varchar(128) DEFAULT 'gpt-4o-mini',
  "answerGuidance" text DEFAULT 'balanced',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS "contacts" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "name" varchar(255),
  "email" varchar(320),
  "phone" varchar(64),
  "company" varchar(255),
  "channel" varchar(64) DEFAULT 'web',
  "tags" jsonb,
  "notes" text,
  "subscribed" boolean DEFAULT true,
  "lastSeenAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_members" (
  "id" serial PRIMARY KEY,
  "workspaceId" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(320) NOT NULL,
  "role" text DEFAULT 'agent',
  "status" text DEFAULT 'invited',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);


-- Migrations for existing databases (safe to run repeatedly).
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "contactId" integer;
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "adjustmentCents" integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS "payout_requests" (
  "id" serial PRIMARY KEY,
  "affiliateId" integer NOT NULL,
  "userId" integer,
  "amountCents" integer NOT NULL,
  "method" text NOT NULL,
  "details" jsonb,
  "status" text DEFAULT 'pending',
  "adminNote" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "processedAt" timestamptz
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" text;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "ticketMode" text DEFAULT 'off';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "subject" varchar(512);

CREATE TABLE IF NOT EXISTS "affiliates" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL UNIQUE,
  "workspaceId" integer,
  "code" varchar(32) NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY,
  "affiliateId" integer NOT NULL,
  "referredName" varchar(255),
  "referredEmail" varchar(320),
  "plan" varchar(64) DEFAULT 'starter',
  "amount" integer DEFAULT 0,
  "status" text DEFAULT 'pending',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
