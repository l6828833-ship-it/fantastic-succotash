import { Link } from "wouter";
import { Bot, ArrowLeft } from "lucide-react";

const BRAND = "Chatrico";
const SUPPORT_EMAIL = "support@chatrico.com";
const UPDATED = "June 2026";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">{BRAND}</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {UPDATED}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-2 [&_li]:ml-4 [&_li]:list-disc [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
          <Link href="/refund" className="text-muted-foreground hover:text-foreground">Refund Policy</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted-foreground hover:text-foreground">Contact</a>
        </div>
      </main>
    </div>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p>Welcome to {BRAND}. By creating an account or using our website, dashboard, chat widget, and related services (the "Service"), you agree to these Terms of Service. If you don't agree, please don't use the Service.</p>
      <h2>1. Your account</h2>
      <p>You're responsible for your account, the accuracy of the information you provide, and all activity under your account. Keep your credentials secure. You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service.</p>
      <h2>2. Acceptable use</h2>
      <p>You agree not to misuse the Service, including: sending spam, unlawful, harmful, or infringing content; attempting to breach security; reverse-engineering the Service; or using it to violate others' rights or applicable law.</p>
      <h2>3. Plans, billing & renewals</h2>
      <p>Paid plans are billed monthly in advance and renew automatically until cancelled. You can cancel anytime from Settings → Billing & Plan; your plan stays active until the end of the current billing period and will not renew afterward. Prices may change with notice.</p>
      <h2>4. Your content & data</h2>
      <p>You retain ownership of the content and data you upload (knowledge base, conversations, contacts). You grant {BRAND} a limited license to host and process it solely to provide the Service. See our <a href="/privacy">Privacy Policy</a>.</p>
      <h2>5. AI-generated responses</h2>
      <p>The Service uses AI to generate replies based on your content. AI output may be inaccurate; you're responsible for reviewing and for the responses your agents send to your customers.</p>
      <h2>6. Availability & changes</h2>
      <p>We aim for high availability but the Service is provided "as is" without warranty of uninterrupted operation. We may update, suspend, or discontinue features.</p>
      <h2>7. Termination</h2>
      <p>You may stop using the Service anytime. We may suspend or terminate accounts that violate these Terms. On termination, your right to use the Service ends.</p>
      <h2>8. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, {BRAND} is not liable for indirect, incidental, or consequential damages, or for loss of data or profits arising from your use of the Service.</p>
      <h2>9. Contact</h2>
      <p>Questions about these Terms? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>This Privacy Policy explains what information {BRAND} collects, how we use it, and your choices.</p>
      <h2>1. Information we collect</h2>
      <p>Account information (name, email, login method); workspace content you provide (knowledge base, contacts, conversations); billing details processed by our payment providers; and technical data such as IP address, device/browser information, and usage logs.</p>
      <h2>2. How we use information</h2>
      <p>To provide and improve the Service, authenticate you, process payments, generate AI replies, send transactional and support emails, prevent abuse and fraud, and comply with legal obligations.</p>
      <h2>3. Sharing</h2>
      <p>We share data with service providers that help us run the Service (e.g. hosting, database, email delivery, payment processing, AI model providers) under appropriate safeguards. We don't sell your personal data.</p>
      <h2>4. Payments</h2>
      <p>Card payments are handled by Stripe and crypto payments by Cryptomus. We don't store full card details on our servers.</p>
      <h2>5. Cookies</h2>
      <p>We use essential cookies for sign-in/session management and may use analytics to understand usage. You can control cookies in your browser settings.</p>
      <h2>6. Data retention & security</h2>
      <p>We retain data while your account is active and as needed for legal/operational purposes. We apply reasonable technical and organizational measures to protect it, though no method is 100% secure.</p>
      <h2>7. Your rights</h2>
      <p>Depending on your location, you may have rights to access, correct, export, or delete your personal data. Contact us to exercise them.</p>
      <h2>8. Contact</h2>
      <p>Privacy questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  );
}

export function Refund() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p>We want you to be happy with {BRAND}. This policy explains cancellations and refunds for paid plans.</p>
      <h2>1. Cancel anytime</h2>
      <p>You can cancel your subscription at any time from Settings → Billing & Plan. When you cancel, your plan stays active until the end of the current billing period and <strong>will not renew</strong> the following month — you won't be charged again.</p>
      <h2>2. Monthly subscriptions</h2>
      <p>Plans are billed monthly in advance. Because you keep full access for the period you paid for, monthly fees already charged are generally non-refundable, except where required by law.</p>
      <h2>3. Refund requests</h2>
      <p>If you were charged in error, experienced a billing problem, or believe you're entitled to a refund, contact us within 14 days of the charge at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll review your request in good faith.</p>
      <h2>4. Crypto payments</h2>
      <p>Cryptocurrency payments (via Cryptomus) are one-time and non-refundable due to the nature of blockchain transactions, except where required by law.</p>
      <h2>5. Downgrades</h2>
      <p>Downgrading to a lower or Free plan takes effect at the end of the current billing period. Plan limits then apply to your usage.</p>
      <h2>6. Contact</h2>
      <p>For any billing or refund question, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalShell>
  );
}
