export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate the OAuth login URL at runtime so the redirect URI reflects the
 * current origin.
 *
 * Returns `null` when the OAuth portal has not been configured at build time
 * (e.g. self-hosted deploys on Railway/Render/etc. that have not set the
 * `VITE_OAUTH_PORTAL_URL` / `VITE_APP_ID` build-time variables). Returning
 * `null` instead of constructing an invalid URL prevents a
 * "TypeError: Invalid URL" from crashing the entire app during render.
 */
export const getLoginUrl = (): string | null => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL as string | undefined;
  const appId = import.meta.env.VITE_APP_ID as string | undefined;

  if (typeof window === "undefined") return null;

  if (!oauthPortalUrl) {
    console.warn(
      "[auth] VITE_OAUTH_PORTAL_URL is not set at build time, so login is disabled. " +
        "Set VITE_OAUTH_PORTAL_URL and VITE_APP_ID as build-time environment variables for this deployment."
    );
    return null;
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId ?? "");
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error("[auth] Failed to build login URL from VITE_OAUTH_PORTAL_URL:", oauthPortalUrl, error);
    return null;
  }
};
