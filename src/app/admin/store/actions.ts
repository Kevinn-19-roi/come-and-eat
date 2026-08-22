"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { getOfficialStore } from "@/services/official-store";
import type { VendorActionState } from "@/app/vendor/actions";

const value = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const checked = (form: FormData, name: string) => form.get(name) === "on";
const amount = (form: FormData, name: string) =>
  Math.max(0, Number(value(form, name).replace(/\s/g, "")) || 0);

async function saveGroups(
  db: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  productId: string,
  form: FormData,
) {
  for (const type of ["accompaniment", "drink", "supplement"] as const) {
    const names = form.getAll(`${type}_name`).map(String);
    const prices = form.getAll(`${type}_price`).map(String);
    const options = names
      .map((name, index) => ({
        name: name.trim(),
        price: Math.max(0, Number(prices[index]) || 0),
      }))
      .filter((item) => item.name);
    if (!options.length) continue;
    const defaults =
      type === "accompaniment"
        ? { name: "Accompagnements", required: true, min: 1, max: 1 }
        : type === "drink"
          ? { name: "Boissons", required: false, min: 0, max: 1 }
          : { name: "Suppléments", required: false, min: 0, max: null };
    const { data: group, error } = await db
      .from("product_option_groups")
      .insert({
        restaurant_id: restaurantId,
        name: defaults.name,
        type,
        is_required: value(form, `${type}_required`)
          ? value(form, `${type}_required`) === "yes"
          : defaults.required,
        min_choices:
          value(form, `${type}_required`) === "yes" ? 1 : defaults.min,
        max_choices:
          value(form, `${type}_multiple`) === "yes" ? null : defaults.max,
      })
      .select("id")
      .single();
    if (error) throw error;
    const inserted = await db
      .from("product_options")
      .insert(
        options.map((option, index) => ({
          group_id: group.id,
          name: option.name,
          price_delta: option.price,
          sort_order: index,
        })),
      );
    if (inserted.error) throw inserted.error;
    const linked = await db
      .from("product_option_group_links")
      .insert({ product_id: productId, group_id: group.id });
    if (linked.error) throw linked.error;
  }
}

export async function updateOfficialStore(
  _state: VendorActionState,
  form: FormData,
): Promise<VendorActionState> {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const { error } = await db
    .from("restaurants")
    .update({
      name: value(form, "name"),
      description: value(form, "description"),
      phone: value(form, "phone") || null,
      whatsapp: value(form, "whatsapp") || null,
      email: value(form, "email") || null,
      address: value(form, "address") || null,
      commune: value(form, "commune") || null,
      latitude: value(form, "latitude")
        ? Number(value(form, "latitude"))
        : null,
      longitude: value(form, "longitude")
        ? Number(value(form, "longitude"))
        : null,
      maps_url: value(form, "maps_url") || null,
      logo_path: value(form, "logo_path") || null,
      cover_path: value(form, "cover_path") || null,
      average_prep_minutes: Number(value(form, "average_prep_minutes")) || 25,
      delivery_available: checked(form, "delivery_available"),
      pickup_available: checked(form, "pickup_available"),
    })
    .eq("id", store.id)
    .eq("is_official", true);
  if (error)
    return { error: "Les modifications n’ont pas pu être enregistrées." };
  const cuisineIds = form.getAll("cuisine_ids").map(String);
  await db
    .from("restaurant_cuisine_types")
    .delete()
    .eq("restaurant_id", store.id);
  if (cuisineIds.length) {
    const result = await db
      .from("restaurant_cuisine_types")
      .insert(
        cuisineIds.map((id) => ({
          restaurant_id: store.id,
          cuisine_type_id: id,
        })),
      );
    if (result.error)
      return {
        error:
          "Boutique enregistrée, mais les types de cuisine n’ont pas été mis à jour.",
      };
  }
  revalidatePath("/admin/store");
  return { ok: true, message: "Boutique Come & Eat enregistrée." };
}

export async function toggleOfficialStorePause() {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const nextStatus = store.operating_status === "paused" ? "open" : "paused";
  const { data, error } = await db
    .from("restaurants")
    .update({ operating_status: nextStatus })
    .eq("id", store.id)
    .eq("is_official", true)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("OFFICIAL_STORE_STATE_NOT_UPDATED");
  revalidatePath("/admin/store");
  redirect(`/admin/store?status=${nextStatus}`);
}

export async function saveOfficialHours(
  _state: VendorActionState,
  form: FormData,
): Promise<VendorActionState> {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const rows = Array.from({ length: 7 }, (_, day) => ({
    restaurant_id: store.id,
    day_of_week: day,
    is_closed: !checked(form, `open_${day}`),
    opens_at: checked(form, `open_${day}`) ? value(form, `opens_${day}`) : null,
    closes_at: checked(form, `open_${day}`)
      ? value(form, `closes_${day}`)
      : null,
  }));
  const { error } = await db
    .from("restaurant_hours")
    .upsert(rows, { onConflict: "restaurant_id,day_of_week" });
  if (error) return { error: "Les horaires n’ont pas pu être enregistrés." };
  revalidatePath("/admin/store/hours");
  return { ok: true, message: "Horaires enregistrés." };
}

export async function createOfficialProduct(
  _state: VendorActionState,
  form: FormData,
): Promise<VendorActionState> {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const name = value(form, "name");
  if (!name || !value(form, "category_id"))
    return { error: "Ajoutez un nom et choisissez une catégorie." };
  const { data, error } = await db
    .from("products")
    .insert({
      restaurant_id: store.id,
      category_id: value(form, "category_id"),
      name,
      description: value(form, "description"),
      base_price: amount(form, "base_price"),
      media_id: value(form, "media_id") || null,
      availability: checked(form, "availability"),
      moderation_status: "approved",
      slug: "",
      sku: "",
    })
    .select("id")
    .single();
  if (error) return { error: "Le produit n’a pas pu être ajouté." };
  try {
    await saveGroups(db, store.id, data.id, form);
  } catch {
    return {
      error:
        "Produit ajouté, mais certaines options n’ont pas été enregistrées.",
    };
  }
  revalidatePath("/admin/store/products");
  redirect("/admin/store/products?success=created");
}

export async function updateOfficialProduct(
  productId: string,
  _state: VendorActionState,
  form: FormData,
): Promise<VendorActionState> {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const { error } = await db
    .from("products")
    .update({
      category_id: value(form, "category_id"),
      name: value(form, "name"),
      description: value(form, "description"),
      base_price: amount(form, "base_price"),
      media_id: value(form, "media_id") || null,
      availability: checked(form, "availability"),
    })
    .eq("id", productId)
    .eq("restaurant_id", store.id);
  if (error) return { error: "Le produit n’a pas pu être modifié." };
  const { data: links } = await db
    .from("product_option_group_links")
    .select("group_id")
    .eq("product_id", productId);
  const groupIds = (links ?? []).map((link) => link.group_id);
  if (groupIds.length) {
    await db
      .from("product_option_group_links")
      .delete()
      .eq("product_id", productId);
    await db.from("product_option_groups").delete().in("id", groupIds);
  }
  try {
    await saveGroups(db, store.id, productId, form);
  } catch {
    return {
      error:
        "Produit modifié, mais certaines options n’ont pas été enregistrées.",
    };
  }
  revalidatePath("/admin/store/products");
  return { ok: true, message: "Produit enregistré." };
}

export async function setOfficialProductAvailability(form: FormData) {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const { error } = await db
    .from("products")
    .update({ availability: value(form, "availability") === "true" })
    .eq("id", value(form, "product_id"))
    .eq("restaurant_id", store.id);
  if (error) throw error;
  revalidatePath("/admin/store/products");
}

export async function archiveOfficialProduct(form: FormData) {
  await requireAdmin();
  const db = await createClient();
  const store = await getOfficialStore();
  const { error } = await db
    .from("products")
    .update({ is_archived: true, availability: false })
    .eq("id", value(form, "product_id"))
    .eq("restaurant_id", store.id);
  if (error) throw error;
  revalidatePath("/admin/store/products");
}
