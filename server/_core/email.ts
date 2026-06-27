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
  return Boolean(ENV.brevoApiKey || (ENV.smtpHost && ENV.emailFrom));
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
}

// Send a single email via Brevo's transactional HTTP API. Works on hosts that
// block SMTP ports because it's plain HTTPS.
async function sendViaBrevo(msg: EmailMessage): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": ENV.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: ENV.emailFrom || "no-reply@example.com", name: ENV.emailFromName || undefined },
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  // Prefer the Brevo HTTP API when configured (works behind SMTP-port blocks).
  if (ENV.brevoApiKey) {
    await sendViaBrevo(msg);
    return;
  }
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email is not configured (set BREVO_API_KEY, or SMTP_HOST and EMAIL_FROM)");
  const from = ENV.emailFromName ? `"${ENV.emailFromName}" <${ENV.emailFrom}>` : ENV.emailFrom;
  await transporter.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
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
