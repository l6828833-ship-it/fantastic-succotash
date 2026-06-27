# ChatBot SaaS Pro - TODO

## Phase 2: Database Schema & Foundation
- [x] Define full database schema (users, workspaces, agents, conversations, messages, tickets, campaigns, knowledge base, etc.)
- [x] Run migrations via webdev_execute_sql
- [x] Add all server-side db helpers
- [x] Add all tRPC routers (agents, conversations, inbox, tickets, campaigns, knowledge, analytics)
- [x] Set up file upload endpoint with S3 storage
- [x] Set up LLM endpoint for playground and inbox suggestions

## Phase 3: Onboarding Wizard & Layout
- [x] 5-step onboarding wizard (industry, company size, company info, feature selection, plan setup)
- [x] Industry-specific agent defaults
- [x] AppLayout with full sidebar navigation
- [x] Global theme (color palette, fonts, CSS variables)
- [x] Dark mode toggle

## Phase 4: Agent Customization
- [x] Agent creation form (name, avatar, personality, tone, language, response style)
- [x] Fallback messages configuration
- [x] Working hours configuration
- [x] Q&A knowledge pairs editor
- [x] Handoff mode selector: AI Only / AI First then Human Escalation / Human Only
- [x] Escalation triggers and routing rules
- [x] Widget style editor (theme color, position, size, launcher icon, welcome message, font, brand logo)
- [x] Live widget preview panel

## Phase 5: Agent Playground
- [x] In-dashboard test console
- [x] Real LLM responses powered by invokeLLM
- [x] Model selector (GPT-4o-mini, GPT-4o, etc.)
- [x] Answer guidance toggle (Conservative / Balanced / Creative)
- [x] Reset conversation button
- [x] Simulated widget preview alongside playground

## Phase 6: Unified Inbox
- [x] Conversation list with status labels (open, pending, resolved)
- [x] Real-time chat view
- [x] Agent assignment
- [x] Internal notes
- [x] AI-suggested replies via LLM
- [x] Human takeover button
- [x] Escalation notifications

## Phase 7: Ticketing, Campaigns, Knowledge Base
- [x] Ticket creation from conversation
- [x] Ticket list (open, in-progress, closed) with priority and assignee
- [x] Campaign manager (create, target, schedule, track delivery)
- [x] Knowledge base article editor (create, edit, organize)
- [x] FAQ pairs editor

## Phase 8: Analytics, Notifications, File Attachments
- [x] Analytics dashboard (total conversations, resolution rate, handoff rate, CSAT)
- [x] Busiest hours heatmap
- [x] Per-agent performance cards
- [x] In-app notification bell with real popover dropdown (mark read, mark all read)
- [x] Notifications for escalations, new tickets, campaign completions

## Phase 9: Polish & Delivery
- [x] Loading/empty/error states on all pages
- [x] Vitest unit tests (26 tests passing)
- [x] Working hours per-day schedule with individual day toggle and time pickers
- [x] KnowledgeBase Q&A pairs tab fully wired
- [x] Final checkpoint and delivery

## Future Enhancements
- [x] Real-time inbox updates via 5-second polling (refetchInterval on conversations + messages queries)
- [x] File attachment upload UI (full flow: file picker, type/size validation, S3 upload via tRPC, attachment preview chips, send with message)
- [x] Widget embed code generator page (HTML, React, WordPress snippets with copy button)
- [ ] Multi-language UI (future enhancement — requires i18n library + translation files)
- [ ] Stripe billing integration (future enhancement — use webdev_add_feature stripe)

## Bug Fixes & Enhancements (Round 2)
- [x] Fix DialogTitle accessibility error (SheetTitle added to AppLayout mobile nav Sheet)
- [x] Build full Settings page (workspace info, team members, notification prefs, integrations, billing/plan) — /settings route live
- [x] Enhance Ticketing system (split-panel layout, status/priority dropdowns, assignee management, internal notes, tag display, linked conversation, title inline editing)

## Quick Reply Templates (Round 3)
- [ ] Add quick_reply_templates table to schema and migrate
- [ ] Add backend CRUD procedures for quick reply templates
- [ ] Add Quick Reply Templates manager page under Settings
- [ ] Add Quick Reply picker panel in Ticket detail view (search, browse by category, insert)
- [ ] Seed default templates for common support scenarios
