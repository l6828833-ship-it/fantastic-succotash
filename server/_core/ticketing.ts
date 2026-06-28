import * as db from "../db";
import { brandedEmail, getWorkspaceEmailBranding, isEmailConfigured, readableBrandColor, sendEmail, ticketPortalUrl, ticketReplyAddress } from "./email";

export interface CreateCustomerTicketInput {
  workspaceId: number;
  subject: string;
  message: string;
  name?: string | null;
  email?: string | null;
  conversationId?: number | null;
  channel?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  sendConfirmation?: boolean;
  baseUrl?: string;
}

/**
 * Create a support ticket on behalf of a customer (from the widget, an inbound
 * email, or an auto-escalation). Resolves/creates the contact, ensures a
 * conversation thread exists (seeded with the message), files the ticket,
 * notifies the workspace owner, and optionally emails the customer a branded
 * confirmation. Best-effort: email/notification failures never block the ticket.
 */
export async function createCustomerTicket(input: CreateCustomerTicketInput) {
  const subject = input.subject.trim().slice(0, 200) || "Support request";
  const message = input.message.trim().slice(0, 8000);
  const email = input.email?.trim() || null;
  const name = input.name?.trim() || null;

  // Resolve or create the contact (respecting the plan's contact cap).
  let contactId: number | undefined;
  if (email) {
    const existing = await db.findContactByEmail(input.workspaceId, email);
    if (existing) {
      contactId = existing.id;
    } else {
      const limit = db.contactLimitForPlan((await db.getWorkspaceById(input.workspaceId))?.plan);
      const under = !Number.isFinite(limit) || (await db.countContactsByWorkspace(input.workspaceId)) < limit;
      if (under) {
        const c = await db.createContact({ workspaceId: input.workspaceId, name, email, channel: input.channel ?? "web", lastSeenAt: new Date() });
        contactId = c?.id;
      }
    }
  }


  // Ensure a conversation thread exists, seeded with the customer's message.
  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const conv = await db.createConversation({
      workspaceId: input.workspaceId,
      channel: input.channel ?? "web",
      visitorId: `ticket_${Date.now()}`,
      visitorName: name ?? undefined,
      visitorEmail: email ?? undefined,
    });
    conversationId = conv?.id ?? null;
    if (conversationId) {
      await db.createMessage({ conversationId, role: "user", content: `${subject}\n\n${message}` });
    }
  }

  const ticket = await db.createTicket({
    workspaceId: input.workspaceId,
    conversationId: conversationId ?? undefined,
    contactId,
    title: subject,
    description: message,
    status: "open",
    priority: input.priority ?? "medium",
  });

  // Notify the workspace owner in-app.
  try {
    const workspace = await db.getWorkspaceById(input.workspaceId);
    if (workspace) {
      await db.createNotification({
        workspaceId: input.workspaceId,
        userId: workspace.userId,
        type: "new_ticket",
        title: "New Ticket",
        body: `${name || email || "A customer"}: ${subject}`,
        relatedId: ticket?.id,
        relatedType: "ticket",
      });
    }
  } catch (e) {
    console.error("[Ticketing] notification failed", e);
  }

  // Branded confirmation email to the customer.
  if (input.sendConfirmation && email && isEmailConfigured()) {
    try {
      const { brand, replyTo: wsReplyTo } = await getWorkspaceEmailBranding(input.workspaceId);
      // Per-ticket reply address (threads replies back onto this ticket) when an
      // inbound domain is configured; otherwise fall back to the support email.
      const ticketReply = ticket?.id ? ticketReplyAddress(ticket.id) : null;
      const replyTo = ticketReply || wsReplyTo;
      const portalUrl = ticket?.id ? ticketPortalUrl(input.baseUrl, ticket.id) : null;
      const btnColor = readableBrandColor(brand.color);
      const portalBtn = portalUrl
        ? `<p style="margin:18px 0 4px;"><a href="${portalUrl}" style="background-color:${btnColor};color:#ffffff;padding:11px 18px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View &amp; reply to your ticket</a></p>`
        : "";
      const replyLine = ticketReply
        ? `<p style="color:#6b7280;">Or reply directly to this email — your message will be added to this ticket.</p>`
        : "";
      await sendEmail({
        to: email,
        replyTo,
        subject: `We received your request: ${subject}`,
        html: brandedEmail({
          title: "We've got your request",
          bodyHtml: `<p>Hi ${name || "there"},</p><p>Thanks for reaching out. We've created a support ticket for you and our team will get back to you soon.</p><p style="color:#6b7280;"><strong>Subject:</strong> ${subject}</p>${portalBtn}${replyLine}`,
          brand,
        }),
        text: `Hi ${name || "there"},\n\nThanks for reaching out. We've created a support ticket ("${subject}") and our team will get back to you soon.${portalUrl ? `\n\nView & reply to your ticket: ${portalUrl}` : ""}`,
      });
    } catch (e) {
      console.error("[Ticketing] confirmation email failed", e);
    }
  }

  return { ticketId: ticket?.id ?? null, conversationId };
}
