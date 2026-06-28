import crypto from "crypto";
import type { Express, Request, Response } from "express";
import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./env";
import * as db from "../db";

// The email layer is optional: when SMTP env vars are not configured, every
// helper degrades gracefully (isEmailConfigured() === false) so the rest of the
// app keeps working without a mail server.
let _transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(ENV.emailFrom && (ENV.brevoApiKey || ENV.smtpHost));
}

function getTransporter(): Transporter | null {
  if (!ENV.smtpHost || !ENV.emailFrom) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpSecure,
    auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
  });
  return _transporter;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

// Per-workspace email branding applied to transactional emails.
export interface EmailBranding {
  name?: string | null;
  logoUrl?: string | null;
  color?: string | null;
  signature?: string | null;
}

// Only allow safe hex colors in the email HTML (avoids CSS/style injection via
// the brand-color field). Returns null for anything else.
function safeColor(c?: string | null): string | null {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()) ? c.trim() : null;
}

// Resolve a workspace's email branding + reply-to, with sensible fallbacks to
// the platform defaults. Never throws.
export async function getWorkspaceEmailBranding(
  workspaceId: number,
): Promise<{ brand: EmailBranding; replyTo?: string }> {
  try {
    const ws = await db.getWorkspaceById(workspaceId);
    return {
      brand: {
        name: ws?.emailBrandName || ENV.emailFromName || "Chatrico",
        logoUrl: ws?.emailLogoUrl || null,
        color: ws?.emailBrandColor || null,
        signature: ws?.emailSignature || null,
      },
      replyTo: ws?.supportEmail || undefined,
    };
  } catch {
    return { brand: {} };
  }
}

// Send via the Brevo HTTP API. Preferred on hosts that block outbound SMTP
// ports (e.g. Railway), since it's a plain HTTPS request.
async function sendViaBrevo(msg: EmailMessage): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": ENV.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: ENV.emailFrom, name: ENV.emailFromName || "Chatrico" },
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      ...(msg.text ? { textContent: msg.text } : {}),
      ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured (set BREVO_API_KEY + EMAIL_FROM, or SMTP_HOST + EMAIL_FROM)");
  }
  // Prefer the Brevo HTTP API when a key is present; otherwise use SMTP.
  if (ENV.brevoApiKey) {
    await sendViaBrevo(msg);
    return;
  }
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email is not configured (set SMTP_HOST and EMAIL_FROM)");
  const from = ENV.emailFromName ? `"${ENV.emailFromName}" <${ENV.emailFrom}>` : ENV.emailFrom;
  await transporter.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo });
}


// Send to many recipients with bounded concurrency + a delay between batches so
// we stay within typical SMTP provider rate limits. Failures are counted but do
// not abort the whole run. onProgress is invoked after each batch so callers can
// persist progress (e.g. a campaign's sentCount).
export async function sendBulkEmails<T>(
  items: T[],
  render: (item: T) => EmailMessage,
  opts: {
    concurrency?: number;
    delayMs?: number;
    onProgress?: (sent: number, failed: number) => void | Promise<void>;
  } = {},
): Promise<{ sent: number; failed: number }> {
  const concurrency = Math.max(1, opts.concurrency ?? 5);
  const delayMs = opts.delayMs ?? 300;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await sendEmail(render(item));
          sent++;
        } catch (error) {
          failed++;
          console.error("[Email] send failed", error);
        }
      }),
    );
    if (opts.onProgress) await opts.onProgress(sent, failed);
    if (i + concurrency < items.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed };
}


// ─── Helpers: HTML escaping, personalization, list-unsubscribe ────────────────
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A simple branded HTML wrapper used for transactional emails (ticket
// confirmations, etc.). Brand name comes from EMAIL_FROM_NAME.
export function brandedEmail(opts: { title: string; bodyHtml: string; brand?: EmailBranding }): string {
  const b = opts.brand ?? {};
  const name = escapeHtml(b.name || ENV.emailFromName || "Chatrico");
  const color = safeColor(b.color) || "#6366f1";
  const logo = b.logoUrl ? escapeHtml(b.logoUrl) : "";
  const header = logo
    ? `<div style="background:${color};padding:16px 24px;"><img src="${logo}" alt="${name}" style="max-height:34px;max-width:200px;vertical-align:middle;"></div>`
    : `<div style="background:${color};color:#fff;padding:16px 24px;font-weight:700;font-size:16px;">${name}</div>`;
  const signature = b.signature
    ? `<p style="margin:18px 0 0;color:#6b7280;font-size:13px;white-space:pre-line;">${escapeHtml(b.signature)}</p>`
    : "";
  return [
    '<div style="background:#f4f4f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">',
    header,
    '<div style="padding:24px;color:#111827;font-size:15px;line-height:1.6;">',
    `<h2 style="margin:0 0 12px;font-size:18px;">${escapeHtml(opts.title)}</h2>`,
    opts.bodyHtml,
    signature,
    '</div>',
    `<div style="padding:14px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">Sent by ${name}</div>`,
    '</div></div>',
  ].join("");
}

// Replace {{name}} / {{email}} tokens (case-insensitive) in a template.
export function personalize(template: string, vars: { name?: string | null; email?: string | null }): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, vars.name || "there")
    .replace(/\{\{\s*email\s*\}\}/gi, vars.email || "");
}

// Signed token so unsubscribe links can't be trivially enumerated.
export function unsubscribeToken(workspaceId: number, contactId: number): string {
  return crypto
    .createHmac("sha256", ENV.cookieSecret || "chatbotpro-unsub")
    .update(`${workspaceId}.${contactId}`)
    .digest("hex")
    .slice(0, 32);
}

export function unsubscribeUrl(baseUrl: string, workspaceId: number, contactId: number): string {
  const token = unsubscribeToken(workspaceId, contactId);
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/unsubscribe?w=${workspaceId}&c=${contactId}&t=${token}`;
}

// Wrap a plain-text campaign body in a minimal, email-client-friendly HTML
// layout with the required unsubscribe footer.
export function renderCampaignHtml(bodyText: string, unsubUrl: string): string {
  const paragraphs = escapeHtml(bodyText).split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br>"));
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${p}</p>`).join("");
  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;font-size:15px;">',
    body,
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">',
    `<p style="font-size:12px;color:#6b7280;margin:0;">You're receiving this because you subscribed. <a href="${unsubUrl}" style="color:#6b7280;">Unsubscribe</a>.</p>`,
    "</div>",
  ].join("");
}


// ─── Email-to-ticket (inbound reply threading) ───────────────────────────────
// A per-ticket reply address encodes the ticket id + a signed token. Customers
// reply to it and the inbound webhook threads the message back onto the ticket.
export function ticketReplyToken(ticketId: number): string {
  return crypto
    .createHmac("sha256", ENV.cookieSecret || "chatrico-ticket")
    .update(`ticket-reply:${ticketId}`)
    .digest("hex")
    .slice(0, 16);
}

// Returns the per-ticket reply address, or null when no inbound domain is set.
export function ticketReplyAddress(ticketId: number): string | null {
  const domain = ENV.inboundEmailDomain.trim().replace(/^@/, "");
  if (!domain) return null;
  return `ticket-${ticketId}-${ticketReplyToken(ticketId)}@${domain}`;
}

// Validate + decode a "ticket-<id>-<token>@domain" address.
export function parseTicketReplyAddress(addr: string): { ticketId: number } | null {
  const m = /ticket-(\d+)-([a-f0-9]{16})@/i.exec(addr || "");
  if (!m) return null;
  const ticketId = Number(m[1]);
  if (!ticketId || ticketReplyToken(ticketId) !== m[2].toLowerCase()) return null;
  return { ticketId };
}

// Strip quoted history/signatures from an inbound reply so only the new message
// is stored. Best-effort: cuts at common reply separators and quoted lines.
export function stripQuotedReply(raw: string): string {
  if (!raw) return "";
  const lines = String(raw).replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line)) break;
    if (/^\s*>{1,}/.test(line)) break; // start of quoted block
    if (/^\s*From:\s.+/.test(line) && kept.length > 0) break;
    kept.push(line);
  }
  return kept.join("\n").trim().slice(0, 8000);
}

// Collect every recipient address from a tolerant set of inbound payload shapes
// (Brevo Inbound uses To/Cc arrays of { Address }).
function collectInboundAddresses(item: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") out.push(v);
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      const a = o.Address ?? o.address ?? o.email ?? o.Email;
      if (typeof a === "string") out.push(a);
    }
  };
  for (const key of ["To", "to", "Cc", "cc", "recipient", "recipients", "Recipients"]) {
    const val = item[key];
    if (Array.isArray(val)) val.forEach(push);
    else push(val);
  }
  return out;
}

function inboundBodyText(item: Record<string, unknown>): string {
  const cand = item.RawTextBody ?? item.TextBody ?? item.text ?? item.ExtractedMarkdownMessage ?? item.Text ?? "";
  return typeof cand === "string" ? cand : "";
}

// Thread a single inbound email item onto its ticket. Never throws.
async function handleInboundEmailItem(item: Record<string, unknown>): Promise<boolean> {
  try {
    let parsed: { ticketId: number } | null = null;
    for (const addr of collectInboundAddresses(item)) {
      parsed = parseTicketReplyAddress(addr);
      if (parsed) break;
    }
    if (!parsed) return false;

    const ticket = await db.getTicketById(parsed.ticketId);
    if (!ticket) return false;

    const message = stripQuotedReply(inboundBodyText(item));
    if (!message) return false;

    // Ensure the ticket has a conversation thread, then append the reply.
    let conversationId = ticket.conversationId ?? null;
    if (!conversationId) {
      const conv = await db.createConversation({
        workspaceId: ticket.workspaceId,
        channel: "email",
        visitorId: `ticket_${ticket.id}`,
      });
      conversationId = conv?.id ?? null;
      if (conversationId) await db.updateTicket(ticket.id, { conversationId });
    }
    if (conversationId) {
      await db.createMessage({ conversationId, role: "user", content: message });
    }

    // Reopen a closed ticket and notify the workspace owner.
    if (ticket.status === "closed") await db.updateTicket(ticket.id, { status: "open" });
    const ws = await db.getWorkspaceById(ticket.workspaceId);
    if (ws) {
      await db.createNotification({
        workspaceId: ticket.workspaceId,
        userId: ws.userId,
        type: "ticket_reply",
        title: "Customer replied to a ticket",
        body: `${ticket.title}: ${message.slice(0, 120)}`,
        relatedId: ticket.id,
        relatedType: "ticket",
      });
    }
    return true;
  } catch (e) {
    console.error("[Inbound] item handling failed", e);
    return false;
  }
}

function unsubPage(title: string, message?: string): string {
  return [
    "<!doctype html><html><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    `<title>${escapeHtml(title)}</title></head>`,
    "<body style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;\">",
    '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px 36px;max-width:420px;text-align:center;">',
    `<h2 style="margin:0 0 8px;color:#111827;font-size:18px;">${escapeHtml(title)}</h2>`,
    message ? `<p style="margin:0;color:#6b7280;font-size:14px;">${escapeHtml(message)}</p>` : "",
    "</div></body></html>",
  ].join("");
}

export function registerEmailRoutes(app: Express) {
  // Inbound email webhook (email-to-ticket). Point your inbound provider's
  // parse webhook (e.g. Brevo Inbound) at POST /api/inbound/email. We always
  // answer 200 so the provider doesn't retry-storm on a single bad item.
  app.post("/api/inbound/email", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(body.items)
        ? (body.items as Record<string, unknown>[])
        : [body];
      let threaded = 0;
      for (const item of items) {
        if (await handleInboundEmailItem(item)) threaded++;
      }
      res.json({ ok: true, threaded });
    } catch (error) {
      console.error("[Inbound] webhook failed", error);
      res.json({ ok: true });
    }
  });

  // Public one-click unsubscribe target embedded in every campaign email.
  app.get("/api/unsubscribe", async (req: Request, res: Response) => {
    const w = Number(req.query.w);
    const c = Number(req.query.c);
    const t = String(req.query.t ?? "");
    res.type("text/html");
    if (!w || !c || t !== unsubscribeToken(w, c)) {
      res.status(400).send(unsubPage("Invalid link", "This unsubscribe link is invalid or has expired."));
      return;
    }
    try {
      const contact = await db.getContactById(c);
      if (contact && contact.workspaceId === w && contact.subscribed !== false) {
        await db.updateContact(c, { subscribed: false });
      }
      res.send(unsubPage("You've been unsubscribed", "You will no longer receive campaign emails from us."));
    } catch (error) {
      console.error("[Email] unsubscribe failed", error);
      res.status(500).send(unsubPage("Something went wrong", "Please try again later."));
    }
  });
}
