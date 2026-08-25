import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, provider, service, templates, auth, checkout, admin, vendor, settings] = await Promise.all([
  read("supabase/migrations/202608250001_transactional_email_events.sql"),
  read("src/lib/notifications/provider.ts"),
  read("src/lib/notifications/service.ts"),
  read("src/lib/notifications/templates.ts"),
  read("src/app/(public)/auth-actions.ts"),
  read("src/app/(public)/checkout/actions.ts"),
  read("src/app/admin/actions.ts"),
  read("src/app/vendor/actions.ts"),
  read("src/app/admin/settings/page.tsx"),
]);

assert.match(migration, /idempotency_key text not null unique/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /grant execute.+service_role/is);
assert.doesNotMatch(provider, /NEXT_PUBLIC_|SUPABASE_SERVICE_ROLE_KEY/);
assert.match(provider, /Idempotency-Key/);
assert.match(provider, /api\.resend\.com\/emails/);
assert.match(service, /status:\s*"sent"/);
assert.match(service, /provider_unconfigured/);
assert.match(service, /sendPaymentConfirmedNotifications/);
assert.match(service, /sendOrderStatusNotification/);
assert.match(templates, /come-eat-logo-transparent\.webp/);
assert.match(templates, /Nous avons reçu votre commande/);
assert.match(auth, /resetPasswordForEmail/);
assert.match(auth, /sendWelcomeEmail/);
assert.match(checkout, /sendOrderCreatedNotifications/);
assert.match(admin, /sendPaymentConfirmedNotifications/);
assert.match(vendor, /sendOrderStatusNotification/);
assert.match(settings, /E-mails transactionnels/);
console.log("Transactional email architecture checks passed.");
