export const ENV = {
  // Internal label embedded in signed session JWTs. Does not need to match any
  // external service; defaults to a non-empty constant so sessions verify even
  // when VITE_APP_ID is not set.
  appId: process.env.VITE_APP_ID || "github-oauth-app",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Use the OpenAI API directly when an OPENAI_API_KEY is provided. This takes
  // priority over the built-in Forge gateway.
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  // GitHub OAuth (self-hosted login). Create an OAuth App at
  // https://github.com/settings/developers and set these in your environment.
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  // Optional: grant the "admin" role to a specific GitHub account.
  ownerGithubLogin: process.env.OWNER_GITHUB_LOGIN ?? "",
  // Optional: force the public base URL (e.g. https://app.up.railway.app).
  // When unset it is derived from the incoming request headers.
  appBaseUrl: process.env.APP_BASE_URL ?? "",

  // ─── Email / SMTP (campaign + transactional sending) ───────────────────────
  // Brevo HTTP API is preferred (works on hosts that block SMTP ports, e.g.
  // Railway). Set BREVO_API_KEY + EMAIL_FROM and email "just works". SMTP is
  // used as a fallback when no Brevo key is set. Email degrades gracefully when
  // neither is configured (isEmailConfigured() === false).
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  // Inbound domain for email-to-ticket replies (MX pointed at your inbound mail
  // provider, e.g. Brevo Inbound). When set, ticket emails get a per-ticket
  // Reply-To at this domain so customer replies thread back into the ticket.
  inboundEmailDomain: process.env.INBOUND_EMAIL_DOMAIN ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? "587"),
  // Force a TLS-on-connect (smtps) socket. Defaults to true for port 465.
  smtpSecure: process.env.SMTP_SECURE
    ? /^(1|true|yes)$/i.test(process.env.SMTP_SECURE)
    : Number(process.env.SMTP_PORT ?? "587") === 465,
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  // The From address shown to recipients, and an optional display name.
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME ?? "",
};
