import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  isStripeConfigured,
  isCryptomusConfigured,
  isPurchasablePlan,
  createStripeCheckout,
  createCryptomusInvoice,
  cancelStripeSubscription,
  PURCHASABLE_PLANS,
} from "./_core/billing";
import { requestBaseUrl, isEmailConfigured } from "./_core/email";
import { invokeLLM, type Message as LLMMessage } from "./_core/llm";
import { ENV } from "./_core/env";
import {
  brandedEmail,
  escapeHtml,
  getWorkspaceEmailBranding,
  isEmailConfigured,
  readableBrandColor,
  sendBulkEmails,
  sendEmail,
  ticketPortalUrl,
  ticketReplyAddress,
  requestBaseUrl,
  personalize,
  renderCampaignHtml,
  unsubscribeUrl,
} from "./_core/email";
import { storagePut } from "./storage";
import { creditReferralForUpgrade } from "./_core/referral";
import * as db from "./db";

// Email a customer when a human agent replies to their conversation/ticket from
// the dashboard. Only fires for ticket-linked conversations with a known
// customer email, and includes the reply-by-link portal so they can respond.
// Best-effort: never throws.
async function emailCustomerReply(conversationId: number, content: string, baseUrl: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const conv = await db.getConversationById(conversationId);
    if (!conv) return;
    const ticket = await db.getTicketByConversation(conversationId);
    let email = conv.visitorEmail ?? null;
    let name = conv.visitorName ?? null;
    if (ticket?.contactId) {
      const c = await db.getContactById(ticket.contactId);
      if (c?.email) { email = c.email; name = c.name ?? name; }
    }
    // Only email ticket-linked conversations (avoid spamming live web chats).
    if (!ticket || !email) return;

    const { brand, replyTo: wsReplyTo } = await getWorkspaceEmailBranding(conv.workspaceId);
    const ticketReply = ticketReplyAddress(ticket.id);
    const replyTo = ticketReply || wsReplyTo;
    const portalUrl = ticketPortalUrl(baseUrl, ticket.id);
    const btnColor = readableBrandColor(brand.color);
    const portalBtn = portalUrl
      ? `<p style="margin:18px 0 4px;"><a href="${portalUrl}" style="background-color:${btnColor};color:#ffffff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View &amp; reply</a></p>`
      : "";
    const replyLine = ticketReply
      ? `<p style="color:#6b7280;">You can also reply directly to this email.</p>`
      : "";
    const safe = escapeHtml(content).replace(/\n/g, "<br>");
    await sendEmail({
      to: email,
      replyTo,
      subject: `Re: ${ticket.title}`,
      html: brandedEmail({
        title: "You have a new reply",
        bodyHtml: `<p>Hi ${name || "there"},</p><p>${safe}</p>${portalBtn}${replyLine}`,
        brand,
      }),
      text: `Hi ${name || "there"},\n\n${content}${portalUrl ? `\n\nView & reply: ${portalUrl}` : ""}`,
    });
  } catch (e) {
    console.error("[Inbox] customer reply email failed", e);
  }
}

// ─── Workspace Router ─────────────────────────────────────────────────────────
const workspaceRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    let workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) {
      await db.createWorkspace({ userId: ctx.user.id });
      workspace = await db.getWorkspaceByUserId(ctx.user.id);
    }
    return workspace;
  }),
  update: protectedProcedure
    .input(z.object({
      companyName: z.string().optional(),
      companyWebsite: z.string().optional(),
      industry: z.string().optional(),
      companySize: z.string().optional(),
      features: z.array(z.string()).optional(),
      plan: z.string().optional(),
      supportOnline: z.boolean().optional(),
      onboardingCompleted: z.boolean().optional(),
      onboardingStep: z.number().optional(),
      // Email branding
      emailBrandName: z.string().max(255).optional().nullable(),
      emailLogoUrl: z.string().max(2048).optional().nullable(),
      emailBrandColor: z.string().max(32).optional().nullable(),
      supportEmail: z.string().max(320).optional().nullable(),
      emailSignature: z.string().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      let workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) {
        await db.createWorkspace({ userId: ctx.user.id });
        workspace = await db.getWorkspaceByUserId(ctx.user.id);
      }
      // Email branding is a paid (Pro+) feature — never persist those fields on
      // a plan that doesn't include it (defense in depth alongside the apply
      // gate in getWorkspaceEmailBranding).
      const planForFeatures = input.plan ?? workspace!.plan;
      if (!db.planHasFeature(planForFeatures, "emailBranding")) {
        delete input.emailBrandName;
        delete input.emailLogoUrl;
        delete input.emailBrandColor;
        delete input.supportEmail;
        delete input.emailSignature;
      }
      await db.updateWorkspace(workspace!.id, input);
      // If this update upgraded the plan to a paid tier, credit the referring
      // affiliate for the sale (no-op for free plans or non-referred workspaces).
      if (input.plan) {
        await creditReferralForUpgrade({ workspaceId: workspace!.id, plan: input.plan });
      }
      return db.getWorkspaceByUserId(ctx.user.id);
    }),
});

// ─── Agent Router ─────────────────────────────────────────────────────────────
const agentRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getAgentsByWorkspace(workspace.id);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const agent = await db.getAgentById(input.id);
    if (!agent) throw new TRPCError({ code: "NOT_FOUND" });
    return agent;
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      tone: z.enum(["formal", "friendly", "professional", "casual", "empathetic"]).optional(),
      language: z.string().optional(),
      responseStyle: z.enum(["conservative", "balanced", "creative"]).optional(),
      handoffMode: z.enum(["ai_only", "ai_first_human_escalation", "human_only"]).optional(),
      welcomeMessage: z.string().optional(),
      systemPrompt: z.string().optional(),
      fallbackMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
      // Enforce the plan's agent limit.
      const agentLimit = db.agentLimitForPlan(workspace.plan);
      if (Number.isFinite(agentLimit)) {
        const count = await db.countAgentsByWorkspace(workspace.id);
        if (count >= agentLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your plan allows up to ${agentLimit} agent${agentLimit === 1 ? "" : "s"}. Upgrade to add more.`,
          });
        }
      }
      // Human handoff / live inbox is a paid (Starter+) feature — keep lower
      // plans on AI-only handoff.
      if (input.handoffMode && input.handoffMode !== "ai_only" && !db.planHasFeature(workspace.plan, "humanHandoff")) {
        input.handoffMode = "ai_only";
      }
      return db.createAgent({ ...input, workspaceId: workspace.id });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      avatarUrl: z.string().optional().nullable(),
      tone: z.enum(["formal", "friendly", "professional", "casual", "empathetic"]).optional(),
      language: z.string().optional(),
      responseStyle: z.enum(["conservative", "balanced", "creative"]).optional(),
      maxResponseLength: z.enum(["short", "medium", "long"]).optional(),
      typingDelay: z.number().optional(),
      systemPrompt: z.string().optional().nullable(),
      fallbackMessage: z.string().optional().nullable(),
      welcomeMessage: z.string().optional().nullable(),
      handoffMode: z.enum(["ai_only", "ai_first_human_escalation", "human_only"]).optional(),
      humanAvailability: z.enum(["auto", "online", "offline"]).optional(),
      escalationTriggers: z.array(z.string()).optional(),
      escalationMessage: z.string().optional().nullable(),
      workingHoursEnabled: z.boolean().optional(),
      workingHours: z.any().optional(),
      offlineMessage: z.string().optional().nullable(),
      leadCaptureEnabled: z.boolean().optional(),
      leadCaptureFields: z.array(z.string()).optional(),
      widgetColor: z.string().optional(),
      widgetPosition: z.enum(["bottom-right", "bottom-left"]).optional(),
      widgetSize: z.enum(["compact", "standard", "large"]).optional(),
      widgetTheme: z.enum(["light", "dark"]).optional(),
      widgetFont: z.string().optional(),
      ticketMode: z.enum(["off", "always", "ai_fallback"]).optional(),
      ticketDelaySeconds: z.number().int().min(0).max(86400).optional(),
      launcherIconUrl: z.string().optional().nullable(),
      brandLogoUrl: z.string().optional().nullable(),
      customCss: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Human handoff / live inbox is a paid (Starter+) feature.
      if (data.handoffMode && data.handoffMode !== "ai_only") {
        const ws = await db.getWorkspaceByUserId(ctx.user.id);
        if (!db.planHasFeature(ws?.plan, "humanHandoff")) {
          data.handoffMode = "ai_only";
        }
      }
      return db.updateAgent(id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteAgent(input.id);
    return { success: true };
  }),
});

// ─── Knowledge Router ─────────────────────────────────────────────────────────
// Strip an HTML document down to readable plain text for knowledge ingestion.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .trim();
}

const knowledgeRouter = router({
  listArticles: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getArticlesByWorkspace(workspace.id);
  }),
  createArticle: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      agentId: z.number().optional(),
      imageUrl: z.string().optional(),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
      return db.createArticle({ ...input, workspaceId: workspace.id });
    }),
  updateArticle: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      agentId: z.number().optional().nullable(),
      imageUrl: z.string().optional().nullable(),
      status: z.enum(["indexing", "ready", "failed"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateArticle(id, data);
    }),
  importFromUrl: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      agentId: z.number().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
      // "Learn from website URL" is a paid (Starter+) feature.
      if (!db.planHasFeature(workspace.plan, "learnFromWebsite")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Learning from a website URL is available on the Starter plan and above. Upgrade to use it.",
        });
      }
      let html = "";
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(input.url, {
          signal: controller.signal,
          headers: { "User-Agent": "ChatBotPro-KnowledgeBot/1.0" },
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        html = await resp.text();
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not fetch that URL. Make sure it is public and reachable." });
      }
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const pageTitle = (titleMatch?.[1] || new URL(input.url).hostname).trim().slice(0, 200);
      const text = htmlToText(html).slice(0, 12000);
      if (text.length < 20) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No readable text was found on that page." });
      }
      return db.createArticle({
        workspaceId: workspace.id,
        agentId: input.agentId,
        title: pageTitle,
        content: text,
        category: input.category ?? "website",
        sourceUrl: input.url,
        status: "ready",
      });
    }),
  deleteArticle: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteArticle(input.id);
    return { success: true };
  }),
  listQA: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getQAPairsByWorkspace(workspace.id);
  }),
  createQA: protectedProcedure
    .input(z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      category: z.string().optional(),
      agentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
      return db.createQAPair({ ...input, workspaceId: workspace.id });
    }),
  updateQA: protectedProcedure
    .input(z.object({
      id: z.number(),
      question: z.string().optional(),
      answer: z.string().optional(),
      category: z.string().optional(),
      agentId: z.number().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateQAPair(id, data);
    }),
  deleteQA: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteQAPair(input.id);
    return { success: true };
  }),
});

// ─── Inbox Router ─────────────────────────────────────────────────────────────
const inboxRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) return [];
      return db.getConversationsByWorkspace(workspace.id, input.status);
    }),
  getConversation: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getConversationById(input.id);
  }),
  createConversation: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(),
      visitorName: z.string().optional(),
      visitorEmail: z.string().optional(),
      channel: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
      const conv = await db.createConversation({ ...input, workspaceId: workspace.id, visitorId: `visitor_${Date.now()}` });
      // Notify
      await db.createNotification({
        workspaceId: workspace.id,
        userId: ctx.user.id,
        type: "new_conversation",
        title: "New Conversation",
        body: `New conversation from ${input.visitorName ?? "visitor"}`,
        relatedId: conv?.id,
        relatedType: "conversation",
      });
      return conv;
    }),
  updateConversation: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["open", "pending", "resolved"]).optional(),
      assignedUserId: z.number().optional().nullable(),
      handoffMode: z.enum(["ai", "human"]).optional(),
      isEscalated: z.boolean().optional(),
      csatScore: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const conv = await db.updateConversation(id, data);
      if (data.isEscalated) {
        const workspace = await db.getWorkspaceByUserId(ctx.user.id);
        if (workspace) {
          await db.createNotification({
            workspaceId: workspace.id,
            userId: ctx.user.id,
            type: "escalation",
            title: "Conversation Escalated",
            body: `Conversation #${id} has been escalated to a human agent`,
            relatedId: id,
            relatedType: "conversation",
          });
          // Auto-convert the escalated conversation into a ticket so nothing is
          // lost, unless one already exists for it.
          const existingTicket = await db.getTicketByConversation(id);
          if (!existingTicket) {
            // Link the customer/contact (by the conversation's visitor email) so
            // the ticket shows who it's for.
            let contactId: number | undefined;
            const vEmail = conv?.visitorEmail?.trim();
            if (vEmail) {
              const existingContact = await db.findContactByEmail(workspace.id, vEmail);
              contactId = existingContact
                ? existingContact.id
                : (await db.createContact({ workspaceId: workspace.id, name: conv?.visitorName ?? null, email: vEmail, channel: "web", lastSeenAt: new Date() }))?.id;
            }
            await db.createTicket({
              workspaceId: workspace.id,
              conversationId: id,
              contactId,
              title: `Escalated: ${conv?.visitorName ?? conv?.visitorEmail ?? `conversation #${id}`}`,
              description: "This conversation was escalated to a human agent.",
              status: "open",
              priority: "high",
            });
          }
        }
      }
      return conv;
    }),
  getMessages: protectedProcedure.input(z.object({ conversationId: z.number() })).query(async ({ input }) => {
    return db.getMessagesByConversation(input.conversationId);
  }),
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1),
      role: z.enum(["user", "agent", "system", "note"]),
      isInternal: z.boolean().optional(),
      attachmentUrl: z.string().optional(),
      attachmentType: z.string().optional(),
      attachmentName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const msg = await db.createMessage(input);
      // Email the customer when a human agent posts a public reply.
      if (input.role === "agent" && !input.isInternal) {
        await emailCustomerReply(input.conversationId, input.content, requestBaseUrl(ctx.req));
      }
      return msg;
    }),
  suggestReply: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      agentId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const msgs = await db.getMessagesByConversation(input.conversationId);
      const agent = input.agentId ? await db.getAgentById(input.agentId) : null;
      const systemPrompt = agent?.systemPrompt ?? "You are a helpful customer support agent. Suggest a professional reply to the latest customer message.";
      const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = msgs.slice(-10).map((m) => ({
        role: (m.role === "agent" ? "assistant" : m.role === "note" ? "system" : "user") as "user" | "assistant" | "system",
        content: m.content,
      }));
      const response = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [
          { role: "system" as const, content: `${systemPrompt}\n\nSuggest a concise, helpful reply to the last customer message. Return only the reply text.` },
          ...history.map(m => ({ role: m.role, content: String(m.content) })),
        ] as LLMMessage[],
      });
      return { suggestion: response.choices[0]?.message?.content ?? "" };
    }),
});

// ─── Tickets Router ───────────────────────────────────────────────────────────
const ticketsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) return [];
      return db.getTicketsByWorkspace(workspace.id, input.status);
    }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getTicketById(input.id);
  }),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      conversationId: z.number().optional(),
      assignedUserId: z.number().optional(),
      tags: z.array(z.string()).optional(),
      contactId: z.number().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });

      // Resolve or create the contact (customer) this ticket is for.
      let contact = input.contactId ? await db.getContactById(input.contactId) : undefined;
      const email = input.contactEmail?.trim();
      if (!contact && email) {
        contact = await db.findContactByEmail(workspace.id, email);
        if (!contact) {
          contact = await db.createContact({
            workspaceId: workspace.id,
            name: input.contactName?.trim() || email,
            email,
            channel: "web",
            lastSeenAt: new Date(),
          });
        }
      }

      // Spin up a conversation so the ticket is immediately replyable.
      let conversationId = input.conversationId ?? null;
      if (!conversationId && contact) {
        const conv = await db.createConversation({
          workspaceId: workspace.id,
          visitorId: `contact_${contact.id}`,
          visitorName: contact.name ?? undefined,
          visitorEmail: contact.email ?? undefined,
          channel: contact.channel ?? "web",
        });
        conversationId = conv?.id ?? null;
        // Seed the thread with the original request as the customer's first message.
        if (conversationId && input.description) {
          await db.createMessage({ conversationId, role: "user", content: input.description });
        }
      }

      const ticket = await db.createTicket({
        workspaceId: workspace.id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        tags: input.tags,
        assignedUserId: input.assignedUserId,
        conversationId: conversationId ?? undefined,
        contactId: contact?.id ?? undefined,
      });

      await db.createNotification({
        workspaceId: workspace.id,
        userId: ctx.user.id,
        type: "new_ticket",
        title: "New Ticket Created",
        body: `Ticket: ${input.title}`,
        relatedId: ticket?.id,
        relatedType: "ticket",
      });

      // Email the customer a branded confirmation (best-effort; never blocks).
      if (contact?.email && isEmailConfigured()) {
        try {
          const who = contact.name || "there";
          const { brand, replyTo: wsReplyTo } = await getWorkspaceEmailBranding(workspace.id);
          const ticketReply = ticket?.id ? ticketReplyAddress(ticket.id) : null;
          const replyTo = ticketReply || wsReplyTo;
          const portalUrl = ticket?.id ? ticketPortalUrl(requestBaseUrl(ctx.req), ticket.id) : null;
          const btnColor = readableBrandColor(brand.color);
          const portalBtn = portalUrl
            ? `<p style="margin:18px 0 4px;"><a href="${portalUrl}" style="background-color:${btnColor};color:#ffffff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View &amp; reply to your ticket</a></p>`
            : "";
          const replyLine = ticketReply
            ? `<p style="color:#6b7280;">Or reply directly to this email — your message will be added to this ticket.</p>`
            : "";
          await sendEmail({
            to: contact.email,
            replyTo,
            subject: `We received your request: ${input.title}`,
            html: brandedEmail({
              title: "We've got your request",
              bodyHtml:
                `<p>Hi ${who},</p>` +
                `<p>Thanks for reaching out. We've created a support ticket for you and our team will get back to you soon.</p>` +
                `<p style="color:#6b7280;"><strong>Subject:</strong> ${input.title}</p>` +
                (input.description ? `<p style="color:#6b7280;"><strong>Details:</strong> ${input.description}</p>` : "") +
                portalBtn + replyLine,
              brand,
            }),
            text: `Hi ${who},\n\nThanks for reaching out. We've created a support ticket ("${input.title}") and our team will get back to you soon.${portalUrl ? `\n\nView & reply to your ticket: ${portalUrl}` : ""}`,
          });
        } catch (e) {
          console.error("[Tickets] confirmation email failed", e);
        }
      }
      return ticket;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["open", "in-progress", "closed"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      assignedUserId: z.number().optional().nullable(),
      conversationId: z.number().optional().nullable(),
      contactId: z.number().optional().nullable(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateTicket(id, data);
    }),
  byContact: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => db.getTicketsByContact(input.contactId)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteTicket(input.id);
    return { success: true };
  }),
  getNotes: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input }) => db.getNotesByTicket(input.ticketId)),
  addNote: protectedProcedure
    .input(z.object({ ticketId: z.number(), content: z.string().min(1), isInternal: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.createTicketNote({ ...input, userId: ctx.user.id });
    }),
  deleteNote: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTicketNote(input.id);
      return { success: true };
    }),
});
// ─── Canned Responses (Quick Replies) Router ──────────────────────────────────
const cannedResponsesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getCannedResponsesByWorkspace(workspace.id);
  }),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      category: z.string().optional(),
      shortcut: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
      return db.createCannedResponse({ ...input, workspaceId: workspace.id });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      shortcut: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateCannedResponse(id, data);
    }),
  use: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.incrementCannedResponseUsage(input.id);
      return { success: true };
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteCannedResponse(input.id);
    return { success: true };
  }),
});

// ─── Contacts Router ──────────────────────────────────────────────────────────
const contactsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getContactsByWorkspace(workspace.id);
  }),
  stats: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return { total: 0, subscribed: 0, active30d: 0, openTickets: 0, plan: "free", limit: 30 };
    const stats = await db.getContactStats(workspace.id);
    const limit = db.contactLimitForPlan(workspace.plan);
    return { ...stats, plan: workspace.plan ?? "free", limit: Number.isFinite(limit) ? limit : null };
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getContactById(input.id);
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      channel: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      subscribed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
      const limit = db.contactLimitForPlan(workspace.plan);
      if (Number.isFinite(limit)) {
        const count = await db.countContactsByWorkspace(workspace.id);
        if (count >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your plan's limit of ${limit} contacts. Upgrade your plan or remove some contacts to add more.`,
          });
        }
      }
      return db.createContact({ ...input, workspaceId: workspace.id, lastSeenAt: new Date() });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      company: z.string().optional().nullable(),
      channel: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional().nullable(),
      subscribed: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateContact(id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteContact(input.id);
    return { success: true };
  }),
});

// ─── Team Router ──────────────────────────────────────────────────────────────
const teamRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getTeamMembersByWorkspace(workspace.id);
  }),
  // Seat usage for the current workspace so the UI can show "X of Y seats used"
  // and disable the invite form when the plan limit is reached.
  seats: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return { used: 1, limit: db.teamSeatLimitForPlan("free"), plan: "free" };
    const members = await db.countTeamMembersByWorkspace(workspace.id);
    const limit = db.teamSeatLimitForPlan(workspace.plan);
    // +1 for the owner, who always occupies a seat but isn't a team_members row.
    return { used: members + 1, limit: Number.isFinite(limit) ? limit : null, plan: workspace.plan ?? "free" };
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.enum(["admin", "agent"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });

      const email = input.email.trim().toLowerCase();

      // Can't invite yourself — the owner already has full access.
      if (ctx.user.email && email === ctx.user.email.trim().toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You're the workspace owner — no need to invite yourself." });
      }

      // No duplicate members within the same workspace.
      const existing = await db.findTeamMemberByEmail(workspace.id, email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `${email} is already on your team.` });
      }

      // Enforce the plan's seat limit (owner counts as one seat).
      const limit = db.teamSeatLimitForPlan(workspace.plan);
      if (Number.isFinite(limit)) {
        const used = (await db.countTeamMembersByWorkspace(workspace.id)) + 1;
        if (used >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your ${workspace.plan ?? "current"} plan allows ${limit} team seats. Upgrade your plan to invite more teammates.`,
          });
        }
      }

      return db.createTeamMember({ name: input.name.trim(), email, role: input.role ?? "agent", workspaceId: workspace.id, status: "invited" });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      role: z.enum(["owner", "admin", "agent"]).optional(),
      status: z.enum(["active", "invited"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateTeamMember(id, data);
    }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteTeamMember(input.id);
    return { success: true };
  }),
});

// ─── Campaigns Router ─────────────────────────────────────────────────────────
const campaignsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getCampaignsByWorkspace(workspace.id);
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getCampaignById(input.id);
  }),
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["broadcast", "drip"]).optional(),
      subject: z.string().optional(),
      message: z.string().min(1),
      agentId: z.number().optional(),
      targetUrlPattern: z.string().optional(),
      triggerDelay: z.number().optional(),
      scheduledAt: z.date().optional(),
      targetSegment: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
      return db.createCampaign({ ...input, workspaceId: workspace.id });
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().optional(),
      status: z.enum(["draft", "scheduled", "running", "completed", "paused"]).optional(),
      scheduledAt: z.date().optional().nullable(),
      targetUrlPattern: z.string().optional(),
      triggerDelay: z.number().optional(),
      sentCount: z.number().optional(),
      openCount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const campaign = await db.updateCampaign(id, data);
      if (data.status === "completed") {
        const workspace = await db.getWorkspaceByUserId(ctx.user.id);
        if (workspace) {
          await db.createNotification({
            workspaceId: workspace.id,
            userId: ctx.user.id,
            type: "campaign_complete",
            title: "Campaign Completed",
            body: `Campaign "${campaign?.name}" has finished sending`,
            relatedId: id,
            relatedType: "campaign",
          });
        }
      }
      return campaign;
    }),
  send: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) throw new TRPCError({ code: "BAD_REQUEST" });
    const campaign = await db.getCampaignById(input.id);
    if (!campaign || campaign.workspaceId !== workspace.id) throw new TRPCError({ code: "NOT_FOUND" });
    if (!isEmailConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Email sending is not configured. Set SMTP_HOST, EMAIL_FROM and SMTP credentials in your environment, then redeploy.",
      });
    }
    if (campaign.status === "running") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This campaign is already sending." });
    }

    const recipients = await db.getSubscribedContactsByWorkspace(workspace.id);
    if (recipients.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No subscribed contacts with an email address to send to." });
    }

    // Resolve an absolute base URL for unsubscribe links.
    const proto = String(ctx.req.headers["x-forwarded-proto"] ?? "https").split(",")[0];
    const host = ctx.req.headers["x-forwarded-host"] ?? ctx.req.headers.host;
    const baseUrl = ENV.appBaseUrl || (host ? `${proto}://${host}` : "");

    const subject = (campaign.subject && campaign.subject.trim()) || campaign.name;
    const bodyTemplate = campaign.message;
    const workspaceId = workspace.id;
    const userId = ctx.user.id;
    const replyTo = workspace.supportEmail || undefined;

    await db.updateCampaign(campaign.id, { status: "running", sentCount: 0 });

    // Send in the background so the request returns immediately; progress is
    // persisted to sentCount as batches complete.
    void (async () => {
      try {
        const result = await sendBulkEmails(
          recipients,
          (contact) => {
            const unsub = unsubscribeUrl(baseUrl, workspaceId, contact.id);
            const body = personalize(bodyTemplate, { name: contact.name, email: contact.email });
            return {
              to: contact.email as string,
              replyTo,
              subject: personalize(subject, { name: contact.name, email: contact.email }),
              html: renderCampaignHtml(body, unsub),
              text: `${body}\n\nUnsubscribe: ${unsub}`,
            };
          },
          {
            concurrency: 5,
            delayMs: 300,
            onProgress: async (sent) => { await db.updateCampaign(campaign.id, { sentCount: sent }); },
          },
        );
        await db.updateCampaign(campaign.id, { status: "completed", sentCount: result.sent });
        await db.createNotification({
          workspaceId,
          userId,
          type: "campaign_complete",
          title: "Campaign Completed",
          body: `"${campaign.name}" was sent to ${result.sent} contact(s)${result.failed ? `, ${result.failed} failed` : ""}.`,
          relatedId: campaign.id,
          relatedType: "campaign",
        });
      } catch (error) {
        console.error("[Campaign] background send failed", error);
        await db.updateCampaign(campaign.id, { status: "paused" });
      }
    })();

    return { recipients: recipients.length };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteCampaign(input.id);
    return { success: true };
  }),
});

// ─── Search Router ────────────────────────────────────────────────────────────
const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ q: z.string() }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      if (q.length < 2) return [];
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) return [];
      return db.searchWorkspace(workspace.id, q);
    }),
});

// ─── Analytics Router ─────────────────────────────────────────────────────────
const analyticsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return { total: 0, resolved: 0, escalated: 0, avgCsat: 0 };
    return db.getAnalyticsSummary(workspace.id);
  }),
  conversationsByDay: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getConversationsByDay(workspace.id);
  }),
  agentPerformance: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getAgentPerformance(workspace.id);
  }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────
const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return [];
    return db.getNotificationsByWorkspace(workspace.id, ctx.user.id);
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.markNotificationRead(input.id);
    return { success: true };
  }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) return { success: false };
    await db.markAllNotificationsRead(workspace.id, ctx.user.id);
    return { success: true };
  }),
});

// ─── Playground Router ────────────────────────────────────────────────────────
const playgroundRouter = router({
  getSession: protectedProcedure.input(z.object({ agentId: z.number() })).query(async ({ ctx, input }) => {
    return db.getOrCreatePlaygroundSession(input.agentId, ctx.user.id);
  }),
  sendMessage: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      message: z.string().min(1),
      model: z.string().optional(),
      answerGuidance: z.enum(["conservative", "balanced", "creative"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const agent = await db.getAgentById(input.agentId);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND" });

      const session = await db.getOrCreatePlaygroundSession(input.agentId, ctx.user.id);
      const currentMessages = (session?.messages ?? []) as Array<{ role: string; content: string }>;

      const guidance = input.answerGuidance ?? session?.answerGuidance ?? "balanced";
      const guidanceInstructions = {
        conservative: "Only answer from your knowledge base. If unsure, say you don't know.",
        balanced: "Answer from your knowledge base when possible, but use general knowledge when needed.",
        creative: "Use your full knowledge to provide comprehensive, creative answers.",
      };

      const systemPrompt = [
        agent.systemPrompt ?? `You are ${agent.name}, a helpful AI assistant.`,
        `Tone: ${agent.tone ?? "professional"}`,
        `Language: ${agent.language ?? "English"}`,
        `Response length: ${agent.maxResponseLength ?? "medium"}`,
        `Answer guidance: ${guidanceInstructions[guidance as keyof typeof guidanceInstructions]}`,
      ].join("\n");

      const updatedMessages = [...currentMessages, { role: "user", content: input.message }];

      const response = await invokeLLM({
        model: input.model ?? session?.model ?? "gpt-4o-mini",
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...updatedMessages.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
        ] as LLMMessage[],
      });

      const assistantReply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't generate a response.";
      const finalMessages = [...updatedMessages, { role: "assistant", content: assistantReply }];

      await db.updatePlaygroundSession(session!.id, {
        messages: finalMessages as Array<{ role: string; content: string }>,
        model: input.model ?? session?.model,
        answerGuidance: guidance,
      });

      return { reply: assistantReply, messages: finalMessages };
    }),
  resetSession: protectedProcedure.input(z.object({ agentId: z.number() })).mutation(async ({ ctx, input }) => {
    const session = await db.getOrCreatePlaygroundSession(input.agentId, ctx.user.id);
    await db.updatePlaygroundSession(session!.id, { messages: [] });
    return { success: true };
  }),
  updateSettings: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      model: z.string().optional(),
      answerGuidance: z.enum(["conservative", "balanced", "creative"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await db.getOrCreatePlaygroundSession(input.agentId, ctx.user.id);
      return db.updatePlaygroundSession(session!.id, { model: input.model, answerGuidance: input.answerGuidance });
    }),
  listModels: protectedProcedure.query(async () => {
    try {
      const { listLLMModels } = await import("./_core/llm");
      const result = await listLLMModels();
      return result.data?.map((m: { id: string }) => m.id) ?? ["gpt-4o-mini", "gpt-4o"];
    } catch {
      return ["gpt-4o-mini", "gpt-4o"];
    }
  }),
});

// ─── File Upload Router ───────────────────────────────────────────────────────
const uploadRouter = router({
  getUploadUrl: protectedProcedure
    .input(z.object({
      filename: z.string(),
      contentType: z.string(),
      folder: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Return a signed upload endpoint
      const key = `${input.folder ?? "uploads"}/${ctx.user.id}/${Date.now()}_${input.filename}`;
      return { key, uploadEndpoint: `/api/upload?key=${encodeURIComponent(key)}` };
    }),
});

// ─── Affiliate Router ─────────────────────────────────────────────────────────
const genAffiliateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

// Minimum withdrawal amount an affiliate can request.
const MIN_WITHDRAWAL_CENTS = 2500;

// Shared balance computation for an affiliate. Earnings = commission rate
// applied to the (non-cancelled) referral revenue, plus any manual admin
// adjustment. Anything not rejected (pending/approved/paid) is reserved against
// the available balance so it can't be requested twice.
async function computeAffiliate(affiliate: { id: number; adjustmentCents?: number | null }) {
  const refs = await db.getReferralsByAffiliate(affiliate.id);
  const referralCount = refs.length;
  const activeReferrals = refs.filter((r) => r.status === "active").length;
  const rate = db.commissionRateForReferrals(referralCount);
  const revenueCents = refs.filter((r) => r.status !== "cancelled").reduce((s, r) => s + (r.amount ?? 0), 0);
  const earningsCents = Math.round((revenueCents * rate) / 100);
  const adjustmentCents = affiliate.adjustmentCents ?? 0;
  const payouts = await db.getPayoutsByAffiliate(affiliate.id);
  const reservedCents = payouts.filter((p) => p.status !== "rejected").reduce((s, p) => s + (p.amountCents ?? 0), 0);
  const paidCents = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amountCents ?? 0), 0);
  // In-flight = requested but not yet paid (pending + approved). Excludes paid so
  // it isn't double-counted against the separate "paid out" figure.
  const pendingCents = Math.max(0, reservedCents - paidCents);
  const availableCents = Math.max(0, earningsCents + adjustmentCents - reservedCents);
  return { referralCount, activeReferrals, rate, revenueCents, earningsCents, adjustmentCents, reservedCents, pendingCents, paidCents, availableCents };
}

const affiliateRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    let affiliate = await db.getAffiliateByUserId(ctx.user.id);
    if (!affiliate) {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      try {
        affiliate = await db.createAffiliate({
          userId: ctx.user.id,
          workspaceId: workspace?.id ?? null,
          code: genAffiliateCode(),
        });
      } catch {
        // A concurrent request may have created it first.
        affiliate = await db.getAffiliateByUserId(ctx.user.id);
      }
    }
    if (!affiliate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create affiliate account" });

    const b = await computeAffiliate(affiliate);
    const nextTier = db.AFFILIATE_TIERS.find((t) => b.referralCount < t.min) ?? null;

    return {
      code: affiliate.code,
      referralCount: b.referralCount,
      activeReferrals: b.activeReferrals,
      rate: b.rate,
      earningsCents: b.earningsCents,
      adjustmentCents: b.adjustmentCents,
      reservedCents: b.reservedCents,
      pendingCents: b.pendingCents,
      paidCents: b.paidCents,
      availableCents: b.availableCents,
      minWithdrawalCents: MIN_WITHDRAWAL_CENTS,
      tiers: db.AFFILIATE_TIERS,
      nextTier: nextTier ? { rate: nextTier.rate, min: nextTier.min, remaining: nextTier.min - b.referralCount } : null,
    };
  }),
  listReferrals: protectedProcedure.query(async ({ ctx }) => {
    const affiliate = await db.getAffiliateByUserId(ctx.user.id);
    if (!affiliate) return [];
    return db.getReferralsByAffiliate(affiliate.id);
  }),
  payouts: protectedProcedure.query(async ({ ctx }) => {
    const affiliate = await db.getAffiliateByUserId(ctx.user.id);
    if (!affiliate) return [];
    return db.getPayoutsByAffiliate(affiliate.id);
  }),
  requestWithdrawal: protectedProcedure
    .input(z.object({
      amountCents: z.number().int().positive(),
      method: z.enum(["paypal", "bank", "wise", "crypto"]),
      details: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const affiliate = await db.getAffiliateByUserId(ctx.user.id);
      if (!affiliate) throw new TRPCError({ code: "NOT_FOUND", message: "No affiliate account found" });
      if (input.amountCents < MIN_WITHDRAWAL_CENTS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The minimum withdrawal is $25." });
      }
      const b = await computeAffiliate(affiliate);
      if (input.amountCents > b.availableCents) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Amount exceeds your available balance." });
      }
      return db.createPayoutRequest({
        affiliateId: affiliate.id,
        userId: ctx.user.id,
        amountCents: input.amountCents,
        method: input.method,
        details: input.details ?? {},
        status: "pending",
      });
    }),
});

// ─── Admin Router (platform super-admin; role === "admin") ────────────────────
const adminRouter = router({
  stats: adminProcedure.query(async () => db.getPlatformStats()),
  users: adminProcedure.query(async () => db.getAllUsers()),
  workspaces: adminProcedure.query(async () => db.getAllWorkspaces()),
  setUserRole: adminProcedure
    .input(z.object({ id: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => db.updateUserRole(input.id, input.role)),
  setWorkspacePlan: adminProcedure
    .input(z.object({ id: z.number(), plan: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateWorkspace(input.id, { plan: input.plan });
      // Credit the referring affiliate for the sale (no-op for free plans or
      // when the workspace wasn't referred).
      await creditReferralForUpgrade({ workspaceId: input.id, plan: input.plan });
      return { success: true };
    }),
  // ─── Affiliate management ───────────────────────────────────────────────────
  affiliates: adminProcedure.query(async () => {
    const [list, allUsers] = await Promise.all([db.getAllAffiliates(), db.getAllUsers()]);
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const out = [];
    for (const aff of list) {
      const b = await computeAffiliate(aff);
      const owner = userMap.get(aff.userId);
      out.push({
        id: aff.id,
        userId: aff.userId,
        code: aff.code,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        referralCount: b.referralCount,
        activeReferrals: b.activeReferrals,
        rate: b.rate,
        earningsCents: b.earningsCents,
        adjustmentCents: b.adjustmentCents,
        reservedCents: b.reservedCents,
        paidCents: b.paidCents,
        availableCents: b.availableCents,
      });
    }
    return out;
  }),
  payouts: adminProcedure.query(async () => {
    const [list, affs, allUsers] = await Promise.all([db.getAllPayouts(), db.getAllAffiliates(), db.getAllUsers()]);
    const affMap = new Map(affs.map((a) => [a.id, a]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    return list.map((p) => {
      const aff = affMap.get(p.affiliateId);
      const owner = aff ? userMap.get(aff.userId) : undefined;
      return { ...p, affiliateCode: aff?.code ?? null, ownerEmail: owner?.email ?? null, ownerName: owner?.name ?? null };
    });
  }),
  setPayoutStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "approved", "paid", "rejected"]), adminNote: z.string().optional() }))
    .mutation(async ({ input }) => db.updatePayoutStatus(input.id, input.status, input.adminNote ?? null)),
  setAffiliateAdjustment: adminProcedure
    .input(z.object({ id: z.number(), amountCents: z.number().int() }))
    .mutation(async ({ input }) => db.updateAffiliateAdjustment(input.id, input.amountCents)),
  // Users brought in by a specific affiliate (their referred sign-ups).
  affiliateReferrals: adminProcedure
    .input(z.object({ affiliateId: z.number() }))
    .query(async ({ input }) => db.getReferralsByAffiliate(input.affiliateId)),

  // ─── Billing log: every payment/transaction across all workspaces ───────────
  payments: adminProcedure.query(async () => {
    const [pays, allWs, allUsers] = await Promise.all([db.getAllPayments(), db.getAllWorkspaces(), db.getAllUsers()]);
    const wsMap = new Map(allWs.map((w) => [w.id, w]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    return pays.map((p) => {
      const ws = wsMap.get(p.workspaceId);
      const owner = ws ? userMap.get(ws.userId) : undefined;
      return {
        ...p,
        workspaceName: ws?.companyName ?? null,
        ownerEmail: owner?.email ?? null,
      };
    });
  }),

  // ─── Per-workspace usage vs plan limits (null limit = unlimited) ────────────
  usage: adminProcedure.query(async () => {
    const [allWs, allUsers, counts] = await Promise.all([
      db.getAllWorkspaces(),
      db.getAllUsers(),
      db.getUsageCountsByWorkspace(),
    ]);
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const lim = (n: number) => (Number.isFinite(n) ? n : null);
    return allWs.map((w) => {
      const owner = userMap.get(w.userId);
      const plan = w.plan ?? "free";
      return {
        workspaceId: w.id,
        workspaceName: w.companyName ?? null,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.name ?? null,
        plan,
        aiConversations: { used: counts.aiConversations.get(w.id) ?? 0, limit: lim(db.conversationLimitForPlan(plan)) },
        contacts: { used: counts.contacts.get(w.id) ?? 0, limit: lim(db.contactLimitForPlan(plan)) },
        agents: { used: counts.agents.get(w.id) ?? 0, limit: lim(db.agentLimitForPlan(plan)) },
        seats: { used: (counts.seats.get(w.id) ?? 0) + 1, limit: lim(db.teamSeatLimitForPlan(plan)) },
        tickets: { used: counts.tickets.get(w.id) ?? 0, limit: lim(db.ticketLimitForPlan(plan)) },
      };
    });
  }),

  // ─── Activity log: recent platform events (signups + billing) ───────────────
  activity: adminProcedure.query(async () => {
    const [recentUsers, pays, allWs] = await Promise.all([
      db.getAllUsers(100),
      db.getAllPayments(100),
      db.getAllWorkspaces(),
    ]);
    const wsMap = new Map(allWs.map((w) => [w.id, w]));
    const userMap = new Map(recentUsers.map((u) => [u.id, u]));
    type Item = { type: string; title: string; detail: string; at: string | Date };
    const items: Item[] = [];
    for (const u of recentUsers) {
      items.push({ type: "signup", title: "New sign-up", detail: u.email ?? u.name ?? `user #${u.id}`, at: u.createdAt });
    }
    for (const p of pays) {
      const ws = wsMap.get(p.workspaceId);
      const owner = ws ? userMap.get(ws.userId) : undefined;
      items.push({
        type: `payment_${p.status ?? "pending"}`,
        title: `Payment ${p.status ?? "pending"}`,
        detail: `${owner?.email ?? ws?.companyName ?? `workspace #${p.workspaceId}`} · ${p.plan} · ${p.provider} · $${((p.amountCents ?? 0) / 100).toFixed(2)}`,
        at: p.createdAt,
      });
    }
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items.slice(0, 120);
  }),

  // ─── Revenue / MRR summary ──────────────────────────────────────────────────
  revenue: adminProcedure.query(async () => {
    const [allWs, pays] = await Promise.all([db.getAllWorkspaces(), db.getAllPayments(1000)]);
    const paidPlans = ["starter", "pro", "business"];
    let mrrCents = 0;
    let activePaid = 0;
    const planCounts: Record<string, number> = {};
    for (const w of allWs) {
      const plan = w.plan ?? "free";
      planCounts[plan] = (planCounts[plan] ?? 0) + 1;
      const normalized = plan === "growth" ? "pro" : plan;
      if (paidPlans.includes(normalized)) {
        mrrCents += db.planPriceCents(plan);
        activePaid++;
      }
    }
    const paid = pays.filter((p) => p.status === "paid");
    const collectedAllTimeCents = paid.reduce((s, p) => s + (p.amountCents ?? 0), 0);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const collectedThisMonthCents = paid
      .filter((p) => new Date(p.createdAt as unknown as string) >= monthStart)
      .reduce((s, p) => s + (p.amountCents ?? 0), 0);
    return { mrrCents, activePaid, collectedAllTimeCents, collectedThisMonthCents, planCounts };
  }),

  // ─── System health: which integrations are configured ──────────────────────
  health: adminProcedure.query(() => ({
    stripe: isStripeConfigured(),
    cryptomus: isCryptomusConfigured(),
    email: isEmailConfigured(),
  })),
});

// ─── Billing Router ───────────────────────────────────────────────────────────
const billingRouter = router({
  // Which payment methods are available (so the UI only shows configured ones).
  config: publicProcedure.query(() => ({
    stripe: isStripeConfigured(),
    cryptomus: isCryptomusConfigured(),
    plans: PURCHASABLE_PLANS,
  })),
  // Current-month usage vs the plan's limits, for the billing page meters.
  // A null limit means "unlimited". Human conversations are not counted (they
  // are unlimited on every plan) — only AI conversations count toward the cap.
  usage: protectedProcedure.query(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    const plan = workspace?.plan ?? "free";
    const toLimit = (n: number) => (Number.isFinite(n) ? n : null);
    if (!workspace) {
      return {
        plan,
        aiConversations: { used: 0, limit: db.conversationLimitForPlan(plan) },
        contacts: { used: 0, limit: db.contactLimitForPlan(plan) },
        agents: { used: 0, limit: db.agentLimitForPlan(plan) },
        seats: { used: 1, limit: toLimit(db.teamSeatLimitForPlan(plan)) },
        tickets: { used: 0, limit: toLimit(db.ticketLimitForPlan(plan)) },
      };
    }
    const [aiConversations, contacts, agents, members, tickets] = await Promise.all([
      db.countAiConversationsThisMonth(workspace.id),
      db.countContactsByWorkspace(workspace.id),
      db.countAgentsByWorkspace(workspace.id),
      db.countTeamMembersByWorkspace(workspace.id),
      db.countTicketsThisMonth(workspace.id),
    ]);
    return {
      plan,
      aiConversations: { used: aiConversations, limit: toLimit(db.conversationLimitForPlan(plan)) },
      contacts: { used: contacts, limit: toLimit(db.contactLimitForPlan(plan)) },
      agents: { used: agents, limit: toLimit(db.agentLimitForPlan(plan)) },
      // +1 for the owner, who always occupies a seat.
      seats: { used: members + 1, limit: toLimit(db.teamSeatLimitForPlan(plan)) },
      tickets: { used: tickets, limit: toLimit(db.ticketLimitForPlan(plan)) },
    };
  }),
  // Start a checkout for the chosen plan + provider; returns a redirect URL.
  createCheckout: protectedProcedure
    .input(z.object({
      plan: z.enum(["starter", "pro", "business"]),
      provider: z.enum(["stripe", "cryptomus"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await db.getWorkspaceByUserId(ctx.user.id);
      if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
      if (!isPurchasablePlan(input.plan)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This plan is not purchasable" });
      }
      const baseUrl = requestBaseUrl(ctx.req);
      try {
        if (input.provider === "stripe") {
          if (!isStripeConfigured()) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Card payments are not configured yet." });
          }
          const { url } = await createStripeCheckout({
            workspaceId: workspace.id,
            plan: input.plan,
            baseUrl,
            email: ctx.user.email,
          });
          return { url };
        }
        if (!isCryptomusConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crypto payments are not configured yet." });
        }
        const { url } = await createCryptomusInvoice({
          workspaceId: workspace.id,
          plan: input.plan,
          baseUrl,
        });
        return { url };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[Billing] checkout failed", err);
        // Surface the underlying provider/config error (e.g. a Stripe key
        // mistake or a Cryptomus API message) so the issue is actionable,
        // instead of masking everything behind a generic message.
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Could not start checkout. Please try again.";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
  // Cancel the current subscription — stops auto-renewal. The plan stays active
  // until the end of the billing period, then a webhook downgrades to free.
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const workspace = await db.getWorkspaceByUserId(ctx.user.id);
    if (!workspace) throw new TRPCError({ code: "BAD_REQUEST", message: "No workspace found" });
    if (!workspace.stripeSubscriptionId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active auto-renewing subscription to cancel. Crypto plans are one-time and don't renew.",
      });
    }
    try {
      await cancelStripeSubscription(workspace.stripeSubscriptionId);
      await db.updateWorkspace(workspace.id, { subscriptionCancelAtPeriodEnd: true });
      return { success: true };
    } catch (err) {
      console.error("[Billing] cancel failed", err);
      const message = err instanceof Error && err.message ? err.message : "Could not cancel the subscription.";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: workspaceRouter,
  agent: agentRouter,
  knowledge: knowledgeRouter,
  inbox: inboxRouter,
  tickets: ticketsRouter,
  cannedResponses: cannedResponsesRouter,
  contacts: contactsRouter,
  team: teamRouter,
  campaigns: campaignsRouter,
  analytics: analyticsRouter,
  search: searchRouter,
  notifications: notificationsRouter,
  playground: playgroundRouter,
  upload: uploadRouter,
  affiliate: affiliateRouter,
  admin: adminRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
