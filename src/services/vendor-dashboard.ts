import "server-only";
import { createClient } from "@/lib/supabase/server";

export const fcfa = (value: number) =>
  `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
export const vendorStatusLabels: Record<string, string> = {
  pending: "Nouvelle",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  ready_for_pickup: "Prête pour retrait",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  collected: "Remise au client",
  cancelled: "Annulée",
};
export const moderationLabels: Record<string, string> = {
  pending: "En vérification",
  approved: "Validé",
  flagged: "À corriger",
  hidden: "Masqué par Come & Eat",
};

export async function getVendorDashboard(restaurantId: string) {
  const db = await createClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [orders, products] = await Promise.all([
    db
      .from("restaurant_orders")
      .select(
        "id,status,subtotal,created_at,order:orders(reference,customer_name,fulfillment)",
      )
      .eq("restaurant_id", restaurantId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("availability", false)
      .eq("is_archived", false),
  ]);
  if (orders.error)
    console.error("[vendor-dashboard] orders_failed", {
      code: orders.error.code,
    });
  if (products.error)
    console.error("[vendor-dashboard] products_failed", {
      code: products.error.code,
    });
  const rows = orders.data ?? [];
  return {
    ordersToday: rows.length,
    revenueToday: rows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0),
    toPrepare: rows.filter((row) =>
      ["pending", "confirmed", "preparing"].includes(row.status),
    ).length,
    ready: rows.filter((row) =>
      ["ready", "ready_for_pickup"].includes(row.status),
    ).length,
    unavailableProducts: products.count ?? 0,
    recentOrders: rows,
  };
}

export async function getVendorProducts(restaurantId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .select(
      "id,name,description,base_price,availability,is_archived,moderation_status,moderation_note,hidden_by_admin,category_id,media_id,category:categories(name),media(path,alt_text)",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function getVendorProduct(restaurantId: string, id: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .select(
      "id,name,description,base_price,availability,is_archived,moderation_status,moderation_note,hidden_by_admin,category_id,media_id,media(path,alt_text),links:product_option_group_links(group:product_option_groups(id,type,is_required,max_choices,options:product_options(name,price_delta)))",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function getVendorCategories() {
  const db = await createClient();
  const { data, error } = await db
    .from("categories")
    .select("id,name")
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}
export async function getCuisineTypes() {
  const db = await createClient();
  const { data, error } = await db
    .from("cuisine_types")
    .select("id,name")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}
export async function getVendorMedia(userId: string, restaurantId?: string) {
  const db = await createClient();
  let query = db
    .from("media")
    .select("id,path,file_name,alt_text,type,restaurant_id,created_at")
    .order("created_at", { ascending: false });
  query = restaurantId
    ? query.eq("restaurant_id", restaurantId)
    : query.eq("owner_user_id", userId).is("restaurant_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    publicUrl: db.storage.from("restaurant-media").getPublicUrl(row.path).data
      .publicUrl,
  }));
}
export async function getVendorRestaurant(restaurantId: string) {
  const db = await createClient();
  const [{ data: restaurant, error }, { data: cuisines }, { data: hours }] =
    await Promise.all([
      db.from("restaurants").select("*").eq("id", restaurantId).single(),
      db
        .from("restaurant_cuisine_types")
        .select("cuisine_type_id")
        .eq("restaurant_id", restaurantId),
      db
        .from("restaurant_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week"),
    ]);
  if (error) throw error;
  return {
    restaurant,
    cuisineIds: (cuisines ?? []).map((row) => row.cuisine_type_id),
    hours: hours ?? [],
  };
}
export async function getSellerApplication(userId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("seller_applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function getSellerApplicationDocumentKinds(
  applicationId?: string,
) {
  if (!applicationId) return [];
  const db = await createClient();
  const { data, error } = await db
    .from("seller_application_documents")
    .select("kind")
    .eq("application_id", applicationId);
  if (error) throw error;
  return (data ?? []).map((row) => row.kind);
}
export async function getVendorOrders(restaurantId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("restaurant_orders")
    .select(
      "id,status,subtotal,delivery_fee,prep_minutes,vendor_note,created_at,order:orders(reference,customer_name,customer_phone,customer_email,fulfillment,address,commune,customer_note,wants_cutlery,payment_method,total,created_at),items:order_items(id,product_name,quantity,unit_price,options,line_total)",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function getVendorOrder(restaurantId: string, id: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("restaurant_orders")
    .select(
      "id,status,subtotal,delivery_fee,prep_minutes,vendor_note,created_at,order:orders(reference,customer_name,customer_phone,customer_email,fulfillment,address,commune,customer_note,wants_cutlery,payment_method,total,created_at),items:order_items(id,product_name,quantity,unit_price,options,line_total)",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function getVendorPromotions(restaurantId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("promotions")
    .select(
      "id,name,discount_type,value,starts_at,ends_at,is_active,product_id,product:products(name)",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
