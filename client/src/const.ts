export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * The login entry point. This is a server route (`/api/oauth/login`) that
 * redirects the browser to GitHub's OAuth authorize page. Keeping it
 * server-driven means the client needs no build-time OAuth configuration.
 */
export const getLoginUrl = (): string => "/api/oauth/login";
