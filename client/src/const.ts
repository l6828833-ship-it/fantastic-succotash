export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * The login entry point — our own login page (email/password + GitHub). The
 * GitHub button on that page navigates to the server route `/api/oauth/login`.
 */
export const getLoginUrl = (): string => "/login";
