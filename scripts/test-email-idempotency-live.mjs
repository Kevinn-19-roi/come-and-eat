import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && serviceKey, "Variables Supabase serveur manquantes.");
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const key = `qa-email:${crypto.randomUUID()}`;
let eventId;
try {
  const first = await db.rpc("claim_email_event", {
    event_key: key, event_name: "qa_idempotency", target_recipient: "qa@example.invalid",
    target_order: null, target_restaurant_order: null, target_user: null,
  });
  assert.ifError(first.error);
  eventId = first.data[0].event_id;
  assert.equal(first.data[0].should_send, true);
  await db.from("email_events").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", eventId);
  const duplicate = await db.rpc("claim_email_event", {
    event_key: key, event_name: "qa_idempotency", target_recipient: "qa@example.invalid",
    target_order: null, target_restaurant_order: null, target_user: null,
  });
  assert.ifError(duplicate.error);
  assert.equal(duplicate.data[0].should_send, false);
  console.log("Idempotence distante des notifications validée.");
} finally {
  if (eventId) await db.from("email_events").delete().eq("id", eventId);
}
