import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "");
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && publicKey && serviceKey, "Variables Supabase manquantes.");

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = crypto.randomUUID().slice(0, 8);
const password = `CeA!${crypto.randomUUID()}9a`;
const users = [];
const restaurants = [];
const applications = [];
const mediaRows = [];
const publicPaths = [];
let officialOriginalStatus;

async function createUser(label, role = "customer") {
  const email = `qa-regression-${label}-${run}@example.invalid`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `QA ${label}` },
  });
  if (created.error) throw created.error;
  users.push(created.data.user.id);
  if (role !== "customer") {
    const updated = await service
      .from("profiles")
      .update({ role })
      .eq("id", created.data.user.id);
    if (updated.error) throw updated.error;
  }
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { id: created.data.user.id, client };
}

try {
  const [admin, vendor] = await Promise.all([
    createUser("admin", "super_admin"),
    createUser("vendor", "vendor"),
  ]);
  const restaurantResult = await service
    .from("restaurants")
    .insert({
      name: `QA Restaurant ${run}`,
      slug: `qa-restaurant-${run}`,
      validation_status: "approved",
      operating_status: "open",
    })
    .select("id")
    .single();
  assert.ifError(restaurantResult.error);
  restaurants.push(restaurantResult.data.id);
  const memberResult = await service
    .from("restaurant_members")
    .insert({
      restaurant_id: restaurantResult.data.id,
      user_id: vendor.id,
      role: "owner",
    });
  assert.ifError(memberResult.error);

  const suspended = await admin.client
    .from("restaurants")
    .update({ validation_status: "suspended" })
    .eq("id", restaurantResult.data.id)
    .select("validation_status")
    .single();
  assert.ifError(suspended.error);
  assert.equal(suspended.data.validation_status, "suspended");
  const persistedSuspension = await admin.client
    .from("restaurants")
    .select("validation_status")
    .eq("id", restaurantResult.data.id)
    .single();
  assert.equal(persistedSuspension.data?.validation_status, "suspended");
  const reactivated = await admin.client
    .from("restaurants")
    .update({ validation_status: "approved" })
    .eq("id", restaurantResult.data.id)
    .select("validation_status")
    .single();
  assert.ifError(reactivated.error);
  assert.equal(reactivated.data.validation_status, "approved");

  const officialResult = await admin.client
    .from("restaurants")
    .select("id,operating_status")
    .eq("is_official", true)
    .single();
  assert.ifError(officialResult.error);
  officialOriginalStatus = officialResult.data.operating_status;
  const paused = await admin.client
    .from("restaurants")
    .update({ operating_status: "paused" })
    .eq("id", officialResult.data.id)
    .select("operating_status")
    .single();
  assert.ifError(paused.error);
  assert.equal(paused.data.operating_status, "paused");
  const resumed = await admin.client
    .from("restaurants")
    .update({ operating_status: "open" })
    .eq("id", officialResult.data.id)
    .select("operating_status")
    .single();
  assert.ifError(resumed.error);
  assert.equal(resumed.data.operating_status, "open");

  const file = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const mediaPath = `${admin.id}/${crypto.randomUUID()}.png`;
  publicPaths.push(mediaPath);
  const uploaded = await admin.client.storage
    .from("restaurant-media")
    .upload(mediaPath, file, { contentType: "image/png" });
  assert.ifError(uploaded.error);
  const insertedMedia = await admin.client
    .from("media")
    .insert({
      path: mediaPath,
      bucket: "restaurant-media",
      file_name: "qa.png",
      mime_type: "image/png",
      size_bytes: file.length,
      alt_text: "QA",
      owner_user_id: admin.id,
      restaurant_id: restaurantResult.data.id,
      type: "logo",
      is_public: true,
    })
    .select("id,path,restaurant_id")
    .single();
  assert.ifError(insertedMedia.error);
  mediaRows.push(insertedMedia.data.id);
  const vendorGallery = await vendor.client
    .from("media")
    .select("id,path")
    .eq("restaurant_id", restaurantResult.data.id);
  assert.ifError(vendorGallery.error);
  assert.ok(
    vendorGallery.data.some((item) => item.id === insertedMedia.data.id),
    "Le gérant doit voir tous les médias de son restaurant.",
  );
  const savedBranding = await vendor.client
    .from("restaurants")
    .update({ logo_path: mediaPath, cover_path: mediaPath })
    .eq("id", restaurantResult.data.id)
    .select("logo_path,cover_path")
    .single();
  assert.ifError(savedBranding.error);
  assert.equal(savedBranding.data.logo_path, mediaPath);
  assert.equal(savedBranding.data.cover_path, mediaPath);
  const publicUrl = vendor.client.storage
    .from("restaurant-media")
    .getPublicUrl(mediaPath).data.publicUrl;
  const imageResponse = await fetch(publicUrl);
  assert.equal(imageResponse.status, 200, "Le média public doit être lisible.");

  const applicationResult = await vendor.client
    .from("seller_applications")
    .insert({
      user_id: vendor.id,
      restaurant_name: `QA Candidature ${run}`,
      description: "",
      phone: "0000000000",
      status: "submitted",
      cuisine_notes: [],
      establishment_photo_paths: [],
    })
    .select("id")
    .single();
  assert.ifError(applicationResult.error);
  applications.push(applicationResult.data.id);
  const applicationQuery = await admin.client
    .from("seller_applications")
    .select("*,profile:profiles!seller_applications_user_id_fkey(display_name)")
    .eq("id", applicationResult.data.id)
    .single();
  assert.ifError(applicationQuery.error);
  assert.ok(
    applicationQuery.data,
    "La candidature nullable doit rester consultable.",
  );
  const eventsQuery = await admin.client
    .from("seller_application_events")
    .select("id,status,note,created_at,actor:profiles(display_name)")
    .eq("application_id", applicationResult.data.id);
  assert.ifError(eventsQuery.error);

  console.log(
    "Régressions QA validées: candidature, suspension, pause officielle, médiathèque et identité visuelle.",
  );
} finally {
  if (officialOriginalStatus) {
    const official = await service
      .from("restaurants")
      .select("id")
      .eq("is_official", true)
      .maybeSingle();
    if (official.data)
      await service
        .from("restaurants")
        .update({ operating_status: officialOriginalStatus })
        .eq("id", official.data.id);
  }
  if (applications.length)
    await service.from("seller_applications").delete().in("id", applications);
  if (mediaRows.length)
    await service.from("media").delete().in("id", mediaRows);
  if (publicPaths.length)
    await service.storage.from("restaurant-media").remove(publicPaths);
  if (restaurants.length)
    await service.from("restaurants").delete().in("id", restaurants);
  for (const id of users) await service.auth.admin.deleteUser(id);
}
