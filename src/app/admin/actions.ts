"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
const value = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const checked = (form: FormData, name: string) => form.get(name) === "on";
const number = (form: FormData, name: string) =>
  Math.max(0, Number(value(form, name)) || 0);
async function adminDb() {
  await requireAdmin();
  return createClient();
}
export async function updateRestaurantAdmin(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const payload = {
    name: value(form, "name"),
    description: value(form, "description"),
    phone: value(form, "phone") || null,
    whatsapp: value(form, "whatsapp") || null,
    email: value(form, "email") || null,
    address: value(form, "address") || null,
    commune: value(form, "commune") || null,
    maps_url: value(form, "maps_url") || null,
    logo_path: value(form, "logo_path") || null,
    cover_path: value(form, "cover_path") || null,
    average_prep_minutes: number(form, "average_prep_minutes") || 25,
    delivery_available: checked(form, "delivery_available"),
    pickup_available: checked(form, "pickup_available"),
    operating_status: value(form, "operating_status"),
    validation_status: value(form, "validation_status"),
  };
  const { error } = await db.from("restaurants").update(payload).eq("id", id);
  if (error) throw error;
  const cuisines = form.getAll("cuisine_ids").map(String);
  await db.from("restaurant_cuisine_types").delete().eq("restaurant_id", id);
  if (cuisines.length) {
    const result = await db
      .from("restaurant_cuisine_types")
      .insert(
        cuisines.map((cuisine_type_id) => ({
          restaurant_id: id,
          cuisine_type_id,
        })),
      );
    if (result.error) throw result.error;
  }
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
}
export async function setRestaurantState(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const action = value(form, "action");
  const payload =
    action === "suspend"
      ? { validation_status: "suspended" }
      : action === "approve"
        ? { validation_status: "approved" }
        : action === "pause"
          ? { operating_status: "paused" }
          : action === "open"
            ? { operating_status: "open" }
            : action === "archive"
              ? {
                  archived_at: new Date().toISOString(),
                  operating_status: "closed",
                }
              : { archived_at: null };
  const { data, error } = await db
    .from("restaurants")
    .update(payload)
    .eq("id", id)
    .eq("is_official", false)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("RESTAURANT_STATE_NOT_UPDATED");
  revalidatePath("/admin/restaurants");
  revalidatePath(`/admin/restaurants/${id}`);
  redirect(`/admin/restaurants/${id}?saved=${encodeURIComponent(action)}`);
}
export async function moderateProduct(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const action = value(form, "action");
  const note = value(form, "note") || null;
  const payload =
    action === "hide"
      ? {
          hidden_by_admin: true,
          moderation_status: "hidden",
          moderation_note: note,
          availability: false,
        }
      : action === "show"
        ? {
            hidden_by_admin: false,
            moderation_status: "approved",
            moderation_note: null,
          }
        : action === "archive"
          ? { is_archived: true, availability: false }
          : action === "available"
            ? { availability: true }
            : action === "unavailable"
              ? { availability: false }
              : action === "flag"
                ? { moderation_status: "flagged", moderation_note: note }
                : { category_id: value(form, "category_id") };
  const { error } = await db.from("products").update(payload).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/products");
}
export async function saveCategory(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const payload = {
    name: value(form, "name"),
    description: value(form, "description") || null,
    image_path: value(form, "image_path") || null,
    sort_order: number(form, "sort_order"),
    is_active: checked(form, "is_active"),
  };
  const result = id
    ? await db.from("categories").update(payload).eq("id", id)
    : await db.from("categories").insert({ ...payload, slug: "" });
  if (result.error) throw result.error;
  revalidatePath("/admin/categories");
}
export async function archiveCategory(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const { count } = await db
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id)
    .eq("is_archived", false);
  if (count) {
    await db
      .from("categories")
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq("id", id);
  } else await db.from("categories").delete().eq("id", id);
  revalidatePath("/admin/categories");
}
export async function saveCuisineType(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const payload = {
    name: value(form, "name"),
    sort_order: number(form, "sort_order"),
    is_active: checked(form, "is_active"),
    archived_at: checked(form, "archived") ? new Date().toISOString() : null,
  };
  const result = id
    ? await db.from("cuisine_types").update(payload).eq("id", id)
    : await db.from("cuisine_types").insert({ ...payload, slug: "" });
  if (result.error) throw result.error;
  revalidatePath("/admin/cuisine-types");
}
export async function changeUserRole(form: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin")
    throw new Error("Seul un super administrateur peut modifier les rôles.");
  const db = await createClient();
  const { error } = await db.rpc("admin_set_user_role", {
    target_user: value(form, "user_id"),
    new_role: value(form, "role"),
  });
  if (error) throw error;
  revalidatePath("/admin/users");
}
export async function saveRestaurantMember(form: FormData) {
  const db = await adminDb();
  const restaurant_id = value(form, "restaurant_id");
  const user_id = value(form, "user_id");
  if (value(form, "action") === "remove") {
    const { error } = await db
      .from("restaurant_members")
      .delete()
      .eq("restaurant_id", restaurant_id)
      .eq("user_id", user_id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("restaurant_members")
      .upsert(
        { restaurant_id, user_id, role: value(form, "role") },
        { onConflict: "restaurant_id,user_id" },
      );
    if (error) throw error;
  }
  revalidatePath(`/admin/restaurants/${restaurant_id}`);
}
export async function updateAdminOrderStatus(form: FormData) {
  const db = await adminDb();
  const { error } = await db
    .from("restaurant_orders")
    .update({ status: value(form, "status") })
    .eq("id", value(form, "restaurant_order_id"));
  if (error) throw error;
  revalidatePath(`/admin/orders/${value(form, "order_id")}`);
  revalidatePath("/admin/orders");
}
export async function savePromotionAdmin(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const restaurant = value(form, "restaurant_id") || null;
  const product = value(form, "product_id") || null;
  const category = value(form, "category_id") || null;
  const scope = product
    ? "product"
    : category
      ? "category"
      : restaurant
        ? "restaurant"
        : "platform";
  const payload = {
    name: value(form, "name"),
    scope,
    discount_type: value(form, "discount_type"),
    value: number(form, "value"),
    code: value(form, "code") || null,
    restaurant_id: restaurant,
    product_id: product,
    category_id: category,
    starts_at: value(form, "starts_at") || null,
    ends_at: value(form, "ends_at") || null,
    is_active: checked(form, "is_active"),
    archived_at: null,
  };
  const result = id
    ? await db.from("promotions").update(payload).eq("id", id)
    : await db.from("promotions").insert(payload);
  if (result.error) throw result.error;
  revalidatePath("/admin/promotions");
}
export async function togglePromotion(form: FormData) {
  const db = await adminDb();
  const action = value(form, "action");
  const payload =
    action === "archive"
      ? { archived_at: new Date().toISOString(), is_active: false }
      : { is_active: action === "activate" };
  const { error } = await db
    .from("promotions")
    .update(payload)
    .eq("id", value(form, "id"));
  if (error) throw error;
  revalidatePath("/admin/promotions");
}
export async function saveDeliveryZone(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const payload = {
    name: value(form, "name"),
    fee: number(form, "fee"),
    is_active: checked(form, "is_active"),
    sort_order: number(form, "sort_order"),
    estimated_minutes: value(form, "estimated_minutes")
      ? number(form, "estimated_minutes")
      : null,
    restaurant_id: value(form, "restaurant_id") || null,
  };
  const result = id
    ? await db.from("delivery_zones").update(payload).eq("id", id)
    : await db.from("delivery_zones").insert(payload);
  if (result.error) throw result.error;
  revalidatePath("/admin/delivery");
}
export async function saveSiteSetting(form: FormData) {
  const admin = await requireAdmin();
  const db = await createClient();
  const key = value(form, "key");
  const entries = Array.from(form.entries()).filter(
    ([name]) => !["key"].includes(name),
  );
  const content = Object.fromEntries(
    entries.map(([name, entry]) => [name, String(entry).trim()]),
  );
  const { error } = await db
    .from("site_settings")
    .upsert(
      { key, value: content, is_public: true, updated_by: admin.id },
      { onConflict: "key" },
    );
  if (error) throw error;
  revalidatePath("/admin/content");
  revalidatePath("/admin/settings");
  revalidatePath("/");
}
export async function saveHomepageSection(form: FormData) {
  const db = await adminDb();
  const id = value(form, "id");
  const payload = {
    section_key: value(form, "section_key"),
    title: value(form, "title") || null,
    subtitle: value(form, "subtitle") || null,
    body: value(form, "body") || null,
    sort_order: number(form, "sort_order"),
    is_visible: checked(form, "is_visible"),
  };
  const result = id
    ? await db.from("homepage_sections").update(payload).eq("id", id)
    : await db.from("homepage_sections").insert(payload);
  if (result.error) throw result.error;
  revalidatePath("/admin/content");
  revalidatePath("/");
}
