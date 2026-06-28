import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import * as db from "../db";
import { ENV } from "./env";
import { creditReferralForUpgrade } from "./referral";

// Plans that can be purchased (the free tier and admin-only enterprise are not
// self-serve). Labels are shown on the Stripe/Cryptomus checkout pages.
export const PURCHASABLE_PLANS = ["starter", "growth", "business"] as const;
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number];

const PLAN_LABELS: Record<string, string> = {
  starter: "Chatrico Starter",
  growth: "Chatrico Growth",
  business: "Chatrico Business",
};

export function isStripeConfigured(): boolean {
  return !!ENV.stripeSecretKey;
}

export function isCryptomusConfigured(): boolean {
  return !!ENV.cryptomusMerchantId && !!ENV.cryptomusApiKey;
}

export function isPurchasablePlan(plan: string): plan is PurchasablePlan {
  return (PURCHASABLE_PLANS as readonly string[]).includes(plan);
}

// Grant a plan to a workspace and credit any referring affiliate. Used by both
// the Stripe and Cryptomus webhooks once a payment is confirmed. Idempotent.
async function activatePlan(workspaceId: number, plan: string): Promise<void> {
  await db.updateWorkspace(workspaceId, { plan });
  await creditReferralForUpgrade({ workspaceId, plan }).catch(() => {});
}

// ─── Stripe (card, recurring) ─────────────────────────────────────────────────

// Create a Stripe Checkout Session in subscription mode using the REST API (no
// SDK dependency). Returns the hosted checkout URL to redirect the user to.
export async function createStripeCheckout(opts: {
  workspaceId: number;
  plan: PurchasablePlan;
  baseUrl: string;
  email?: string | null;
}): Promise<{ url: string; id: string }> {
  const amount = db.planPriceCents(opts.plan);
  if (!amount) throw new Error("Plan is not purchasable");

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("client_reference_id", String(opts.workspaceId));
  if (opts.email) form.set("customer_email", opts.email);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(amount));
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("line_items[0][price_data][product_data][name]", PLAN_LABELS[opts.plan] ?? opts.plan);
  form.set("success_url", `${opts.baseUrl}/dashboard?billing=success`);
  form.set("cancel_url", `${opts.baseUrl}/dashboard?billing=cancelled`);
  form.set("metadata[workspaceId]", String(opts.workspaceId));
  form.set("metadata[plan]", opts.plan);
  form.set("subscription_data[metadata][workspaceId]", String(opts.workspaceId));
  form.set("subscription_data[metadata][plan]", opts.plan);

  const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = (await resp.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!resp.ok || !data.url || !data.id) {
    throw new Error(data.error?.message || "Failed to create Stripe checkout session");
  }

  await db.createPayment({
    workspaceId: opts.workspaceId,
    provider: "stripe",
    externalId: data.id,
    plan: opts.plan,
    amountCents: amount,
    status: "pending",
  });

  return { url: data.url, id: data.id };
}

// Verify a Stripe webhook signature (the "stripe-signature" header) against the
// raw request body, without the SDK. Returns the parsed event or null.
function verifyStripeEvent(rawBody: Buffer, sigHeader: string | undefined): any | null {
  if (!sigHeader || !ENV.stripeWebhookSecret) return null;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return null;
  const expected = createHmac("sha256", ENV.stripeWebhookSecret)
    .update(`${t}.${rawBody.toString("utf8")}`)
    .digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
}

// ─── Cryptomus (crypto) ───────────────────────────────────────────────────────

// Cryptomus signs requests/webhooks as md5( base64(json) + apiKey ). PHP's
// json_encode escapes forward slashes (\/), so we must do the same for the
// signature to match.
function cryptomusSign(payload: unknown): string {
  const json = JSON.stringify(payload).replace(/\//g, "\\/");
  const base64 = Buffer.from(json).toString("base64");
  return createHash("md5").update(base64 + ENV.cryptomusApiKey).digest("hex");
}

export async function createCryptomusInvoice(opts: {
  workspaceId: number;
  plan: PurchasablePlan;
  baseUrl: string;
}): Promise<{ url: string; orderId: string }> {
  const amountCents = db.planPriceCents(opts.plan);
  if (!amountCents) throw new Error("Plan is not purchasable");

  const orderId = `cmus_${opts.workspaceId}_${opts.plan}_${Date.now()}`;
  const body = {
    amount: (amountCents / 100).toFixed(2),
    currency: "USD",
    order_id: orderId,
    url_callback: `${opts.baseUrl}/api/billing/cryptomus/webhook`,
    url_success: `${opts.baseUrl}/dashboard?billing=success`,
    url_return: `${opts.baseUrl}/dashboard?billing=cancelled`,
  };

  const resp = await fetch("https://api.cryptomus.com/v1/payment", {
    method: "POST",
    headers: {
      merchant: ENV.cryptomusMerchantId,
      sign: cryptomusSign(body),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { state?: number; result?: { url?: string }; message?: string };
  if (!resp.ok || data.state !== 0 || !data.result?.url) {
    throw new Error(data.message || "Failed to create Cryptomus invoice");
  }

  await db.createPayment({
    workspaceId: opts.workspaceId,
    provider: "cryptomus",
    externalId: orderId,
    plan: opts.plan,
    amountCents,
    status: "pending",
  });

  return { url: data.result.url, orderId };
}

function verifyCryptomusWebhook(rawBody: Buffer): any | null {
  let data: any;
  try {
    data = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
  const sign = data?.sign;
  if (!sign) return null;
  const { sign: _omit, ...rest } = data;
  const expected = cryptomusSign(rest);
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(String(sign)))) return null;
  } catch {
    return null;
  }
  return data;
}

// ─── Route registration ───────────────────────────────────────────────────────

// Webhooks need the RAW request body for signature verification, so these are
// registered with express.raw BEFORE the global express.json() middleware.
export function registerBillingRoutes(app: Express) {
  app.post("/api/billing/stripe/webhook", express.raw({ type: "*/*" }), async (req: Request, res: Response) => {
    try {
      const raw = req.body as Buffer;
      const event = verifyStripeEvent(raw, req.header("stripe-signature"));
      if (!event) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object ?? {};
        const workspaceId = Number(session.metadata?.workspaceId ?? session.client_reference_id);
        const plan = String(session.metadata?.plan ?? "");
        if (workspaceId && plan && isPurchasablePlan(plan)) {
          await activatePlan(workspaceId, plan);
          if (session.id) {
            const pay = await db.getPaymentByExternalId(String(session.id));
            if (pay) await db.updatePayment(pay.id, { status: "paid" });
          }
          console.log(`[Billing] Stripe activated plan=${plan} workspace=${workspaceId}`);
        }
      } else if (event.type === "customer.subscription.deleted") {
        const sub = event.data?.object ?? {};
        const workspaceId = Number(sub.metadata?.workspaceId);
        if (workspaceId) {
          await db.updateWorkspace(workspaceId, { plan: "free" });
          console.log(`[Billing] Stripe subscription cancelled, workspace=${workspaceId} downgraded to free`);
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("[Billing] Stripe webhook error", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  app.post("/api/billing/cryptomus/webhook", express.raw({ type: "*/*" }), async (req: Request, res: Response) => {
    try {
      const data = verifyCryptomusWebhook(req.body as Buffer);
      if (!data) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }
      const status = String(data.status ?? "");
      const orderId = String(data.order_id ?? "");
      // "paid" and "paid_over" are the success states Cryptomus reports.
      if ((status === "paid" || status === "paid_over") && orderId) {
        const pay = await db.getPaymentByExternalId(orderId);
        if (pay && pay.status !== "paid") {
          await activatePlan(pay.workspaceId, pay.plan);
          await db.updatePayment(pay.id, { status: "paid" });
          console.log(`[Billing] Cryptomus activated plan=${pay.plan} workspace=${pay.workspaceId}`);
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("[Billing] Cryptomus webhook error", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });
}
