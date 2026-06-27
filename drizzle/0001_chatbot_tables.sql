CREATE TABLE `workspaces` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `companyName` varchar(255),
  `companyWebsite` varchar(512),
  `industry` varchar(128),
  `companySize` varchar(64),
  `features` json,
  `plan` varchar(64) DEFAULT 'starter',
  `onboardingCompleted` boolean DEFAULT false,
  `onboardingStep` int DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `avatarUrl` text,
  `tone` enum('formal','friendly','professional','casual','empathetic') DEFAULT 'professional',
  `language` varchar(64) DEFAULT 'English',
  `responseStyle` enum('conservative','balanced','creative') DEFAULT 'balanced',
  `maxResponseLength` enum('short','medium','long') DEFAULT 'medium',
  `typingDelay` int DEFAULT 0,
  `systemPrompt` text,
  `fallbackMessage` text,
  `welcomeMessage` text,
  `handoffMode` enum('ai_only','ai_first_human_escalation','human_only') DEFAULT 'ai_only',
  `escalationTriggers` json,
  `escalationMessage` text,
  `workingHoursEnabled` boolean DEFAULT false,
  `workingHours` json,
  `offlineMessage` text,
  `leadCaptureEnabled` boolean DEFAULT false,
  `leadCaptureFields` json,
  `widgetColor` varchar(32) DEFAULT '#6366f1',
  `widgetPosition` enum('bottom-right','bottom-left') DEFAULT 'bottom-right',
  `widgetSize` enum('compact','standard','large') DEFAULT 'standard',
  `widgetTheme` enum('light','dark') DEFAULT 'light',
  `widgetFont` varchar(128) DEFAULT 'Inter',
  `launcherIconUrl` text,
  `brandLogoUrl` text,
  `customCss` text,
  `isActive` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_articles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `agentId` int,
  `title` varchar(512) NOT NULL,
  `content` text,
  `category` varchar(128),
  `tags` json,
  `imageUrl` text,
  `status` enum('indexing','ready','failed') DEFAULT 'ready',
  `sourceUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `knowledge_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qa_pairs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `agentId` int,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `category` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `qa_pairs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `agentId` int,
  `assignedUserId` int,
  `visitorId` varchar(128),
  `visitorName` varchar(255),
  `visitorEmail` varchar(320),
  `visitorLocation` varchar(255),
  `status` enum('open','pending','resolved') DEFAULT 'open',
  `handoffMode` enum('ai','human') DEFAULT 'ai',
  `isEscalated` boolean DEFAULT false,
  `csatScore` int,
  `channel` varchar(64) DEFAULT 'web',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `conversationId` int NOT NULL,
  `role` enum('user','agent','system','note') NOT NULL,
  `content` text NOT NULL,
  `attachmentUrl` text,
  `attachmentType` varchar(64),
  `attachmentName` varchar(255),
  `isInternal` boolean DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `conversationId` int,
  `assignedUserId` int,
  `title` varchar(512) NOT NULL,
  `description` text,
  `status` enum('open','in-progress','closed') DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `tags` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `agentId` int,
  `name` varchar(255) NOT NULL,
  `type` enum('broadcast','drip') DEFAULT 'broadcast',
  `message` text NOT NULL,
  `targetSegment` json,
  `targetUrlPattern` varchar(512),
  `triggerDelay` int DEFAULT 0,
  `scheduledAt` timestamp NULL,
  `status` enum('draft','scheduled','running','completed','paused') DEFAULT 'draft',
  `sentCount` int DEFAULT 0,
  `openCount` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `userId` int,
  `type` enum('escalation','new_ticket','campaign_complete','new_conversation','system') NOT NULL,
  `title` varchar(512) NOT NULL,
  `body` text,
  `isRead` boolean DEFAULT false,
  `relatedId` int,
  `relatedType` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workspaceId` int NOT NULL,
  `agentId` int,
  `conversationId` int,
  `eventType` varchar(128) NOT NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playground_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `agentId` int NOT NULL,
  `userId` int NOT NULL,
  `messages` json,
  `model` varchar(128) DEFAULT 'gpt-4o-mini',
  `answerGuidance` enum('conservative','balanced','creative') DEFAULT 'balanced',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `playground_sessions_id` PRIMARY KEY(`id`)
);
