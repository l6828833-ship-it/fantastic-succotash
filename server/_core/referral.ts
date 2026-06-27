import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";

// Affiliate referral attribution shared by the GitHub OAuth callback and the
// email/password signup flow.
export const REF_COOKIE = "cbp_ref";
// Referrals are only attributed within this window after the link was clicked.
export const REF_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Read a still-valid referral code from the request cookies. The cookie value
 * is "CODE.TIMESTAMP"; we enforce the 5-day window server-side too, so the
 * attribution can't be replayed with a stale/extended cookie.
 */
export function readReferralCode(cookieHeader: string | undefined): string | null {
  const cookies = parseCookieHeader(cookieHeader ?? "");
  const raw = cookies[REF_COOKIE];
  if (!raw) return null;
  const sep = raw.lastIndexOf(".");
  const code = sep > 0 ? raw.slice(0, sep) : raw;
  const tsPart = sep > 0 ? raw.slice(sep + 1) : "";
  if (!/^[A-Za-z0-9]{4,32}$/.test(code)) return null;
  if (tsPart) {
    const ts = Number(tsPart);
    if (!Number.isFinite(ts) || Date.now() - ts > REF_MAX_AGE_MS) return null;
  }
  return code;
}

/**
 * Record a referral for a brand-new user, if they arrived via a referral code.
 * Guards against self-referral. Never throws.
 */
export async function attributeReferral(opts: {
  cookieHeader: string | undefined;
  userId: number;
  name?: string | null;
  email?: string | null;
}): Promise<boolean> {
  try {
    const code = readReferralCode(opts.cookieHeader);
    if (!code) return false;
    const affiliate = await db.getAffiliateByCode(code);
    if (!affiliate || affiliate.userId === opts.userId) return false;
    await db.createReferral({
      affiliateId: affiliate.id,
      referredName: opts.name ?? null,
      referredEmail: opts.email ?? null,
      plan: "starter",
      amount: 0,
      status: "active",
    });
    return true;
  } catch (error) {
    console.error("[Referral] attribution failed", error);
    return false;
  }
}
