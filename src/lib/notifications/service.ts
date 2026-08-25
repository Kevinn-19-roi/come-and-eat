import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider, isEmailProviderConfigured } from "./provider";
import {
  adminOrderTemplate, lifecycleTemplate, orderReceivedTemplate,
  passwordChangedTemplate, paymentConfirmedTemplate, vendorNewOrderTemplate,
  welcomeTemplate, type EmailTemplate, type OrderEmailInput, type OrderEmailItem,
} from "./templates";

type EventType = "welcome" | "password_changed" | "customer_order_received" |
  "admin_order_requires_review" | "customer_payment_confirmed" |
  "vendor_new_order" | "customer_order_status";
type SendInput = { key: string; type: EventType; to?: string | null; template: EmailTemplate; orderId?: string; restaurantOrderId?: string; userId?: string };
type RestaurantOrder = NonNullable<NonNullable<Awaited<ReturnType<typeof orderData>>>["restaurant_orders"]>[number];
const validEmail = (entry: unknown): entry is string => typeof entry === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry);
const one = <T,>(entry: T | T[] | null | undefined): T | undefined => Array.isArray(entry) ? entry[0] : entry ?? undefined;

async function emailSettings(db: ReturnType<typeof createAdminClient>) {
  const { data } = await db.from("site_settings").select("value").eq("key", "email").maybeSingle();
  const value = (data?.value ?? {}) as Record<string, unknown>;
  return {
    enabled: value.enabled !== false && value.enabled !== "false",
    senderName: String(value.sender_name || "Come & Eat"),
    replyTo: String(value.reply_to || process.env.EMAIL_REPLY_TO || "") || undefined,
    adminRecipient: String(value.admin_recipient || process.env.EMAIL_ADMIN_RECIPIENT || "") || undefined,
  };
}

async function send(input: SendInput) {
  if (!validEmail(input.to)) return { sent: false, reason: "recipient_invalid" };
  const db = createAdminClient();
  try {
    const settings = await emailSettings(db);
    const { data, error } = await db.rpc("claim_email_event", {
      event_key: input.key, event_name: input.type, target_recipient: input.to,
      target_order: input.orderId ?? null, target_restaurant_order: input.restaurantOrderId ?? null,
      target_user: input.userId ?? null,
    });
    if (error) {
      console.error("[email] claim_failed", { code: error.code, type: input.type });
      return { sent: false, reason: "claim_failed" };
    }
    const claim = one(data as Array<{ event_id: string; should_send: boolean }>);
    if (!claim?.should_send) return { sent: false, reason: "duplicate" };
    if (!settings.enabled || !isEmailProviderConfigured()) {
      await db.from("email_events").update({
        status: "skipped",
        last_error_code: settings.enabled ? "provider_unconfigured" : "emails_disabled",
        updated_at: new Date().toISOString(),
      }).eq("id", claim.event_id);
      return { sent: false, reason: settings.enabled ? "provider_unconfigured" : "emails_disabled" };
    }
    const result = await getEmailProvider(settings.senderName).send({
      ...input.template, to: input.to, idempotencyKey: input.key, replyTo: settings.replyTo,
    });
    await db.from("email_events").update(result.sent ? {
      status: "sent", provider_message_id: result.providerId ?? null,
      sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } : {
      status: "failed", failed_at: new Date().toISOString(),
      last_error_code: result.errorCode ?? "send_failed", updated_at: new Date().toISOString(),
    }).eq("id", claim.event_id);
    return result;
  } catch (error) {
    console.error("[email] dispatch_failed", { type: input.type, name: error instanceof Error ? error.name : "unknown" });
    return { sent: false, reason: "dispatch_failed" };
  }
}

async function orderData(orderId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("orders").select(
    "id,reference,created_at,customer_user_id,customer_name,customer_email,customer_phone,fulfillment,address,commune,customer_note,total,payment_status,public_tracking_token,restaurant_orders(id,restaurant_id,status,subtotal,delivery_fee,restaurant:restaurants(name,email,members:restaurant_members(role,user_id)),items:order_items(product_name,quantity,options,line_total))",
  ).eq("id", orderId).maybeSingle();
  if (error) {
    console.error("[email] order_read_failed", { code: error.code });
    return null;
  }
  return data;
}

function itemRows(items: Array<{ product_name: string; quantity: number; options: unknown; line_total: number }> | undefined): OrderEmailItem[] {
  return (items ?? []).map((item) => ({
    productName: item.product_name,
    quantity: item.quantity,
    options: Array.isArray(item.options) ? item.options.map((option) => String((option as { name?: unknown }).name ?? "")).filter(Boolean) : [],
    lineTotal: item.line_total,
  }));
}

function base(order: NonNullable<Awaited<ReturnType<typeof orderData>>>): OrderEmailInput {
  return {
    name: order.customer_name, customerPhone: order.customer_phone, createdAt: order.created_at,
    reference: order.reference, orderId: order.id,
    total: order.total, fulfillment: order.fulfillment, zone: order.commune ?? undefined,
    address: order.address ?? undefined, instructions: order.customer_note ?? undefined,
    paymentStatus: order.payment_status, trackingToken: order.public_tracking_token,
    restaurants: (order.restaurant_orders ?? []).map((sub) => one(sub.restaurant)?.name).filter((name): name is string => Boolean(name)),
    items: (order.restaurant_orders ?? []).flatMap((sub) => itemRows(sub.items)),
  };
}

async function vendorEmail(sub: RestaurantOrder) {
  const restaurant = one(sub.restaurant);
  if (validEmail(restaurant?.email)) return restaurant.email;
  const owner = restaurant?.members?.find((member: { role: string; user_id: string }) => member.role === "owner");
  if (!owner?.user_id) return null;
  const { data } = await createAdminClient().auth.admin.getUserById(owner.user_id);
  return data.user?.email ?? null;
}

export async function sendWelcomeEmail(userId: string, email: string, name?: string) {
  return send({ key: `welcome:${userId}`, type: "welcome", to: email, userId, template: welcomeTemplate(name) });
}
export async function sendPasswordChangedEmail(userId: string, email: string, name?: string) {
  return send({ key: `password-changed:${userId}:${new Date().toISOString().slice(0, 16)}`, type: "password_changed", to: email, userId, template: passwordChangedTemplate(name) });
}
export async function sendOrderCreatedNotifications(orderId: string) {
  const order = await orderData(orderId);
  if (!order) return;
  const input = base(order);
  const settings = await emailSettings(createAdminClient());
  await Promise.all([
    send({ key: `order-received:${order.id}`, type: "customer_order_received", to: order.customer_email, orderId: order.id, userId: order.customer_user_id ?? undefined, template: orderReceivedTemplate(input) }),
    send({ key: `admin-order:${order.id}`, type: "admin_order_requires_review", to: settings.adminRecipient, orderId: order.id, template: adminOrderTemplate(input) }),
  ]);
}
export async function sendPaymentConfirmedNotifications(orderId: string) {
  const order = await orderData(orderId);
  if (!order) return;
  const input = base(order);
  await send({ key: `payment-confirmed:${order.id}`, type: "customer_payment_confirmed", to: order.customer_email, orderId: order.id, userId: order.customer_user_id ?? undefined, template: paymentConfirmedTemplate(input) });
  await Promise.all((order.restaurant_orders ?? []).map(async (sub) => {
    const restaurant = one(sub.restaurant);
    const subInput = { ...input, restaurantOrderId: sub.id, restaurantName: restaurant?.name, items: itemRows(sub.items), total: (sub.subtotal ?? 0) + (sub.delivery_fee ?? 0) };
    return send({ key: `vendor-new-order:${sub.id}`, type: "vendor_new_order", to: await vendorEmail(sub), orderId: order.id, restaurantOrderId: sub.id, template: vendorNewOrderTemplate(subInput) });
  }));
}
export async function sendOrderStatusNotification(restaurantOrderId: string, status: string) {
  const db = createAdminClient();
  const { data } = await db.from("restaurant_orders").select("order_id").eq("id", restaurantOrderId).maybeSingle();
  if (!data) return;
  const order = await orderData(data.order_id);
  if (!order) return;
  const sub = (order.restaurant_orders ?? []).find((item) => item.id === restaurantOrderId);
  if (!sub) return;
  const restaurant = one(sub.restaurant);
  const input = { ...base(order), restaurantOrderId, restaurantName: restaurant?.name, items: itemRows(sub.items), total: (sub.subtotal ?? 0) + (sub.delivery_fee ?? 0) };
  return send({ key: `order-status:${restaurantOrderId}:${status}`, type: "customer_order_status", to: order.customer_email, orderId: order.id, restaurantOrderId, userId: order.customer_user_id ?? undefined, template: lifecycleTemplate(status, input) });
}

export async function retryEmailEvent(eventId: string) {
  const db = createAdminClient();
  const { data } = await db.from("email_events").select("event_type,order_id,restaurant_order_id").eq("id", eventId).maybeSingle();
  if (!data) return;
  if (["customer_order_received", "admin_order_requires_review"].includes(data.event_type) && data.order_id) return sendOrderCreatedNotifications(data.order_id);
  if (["customer_payment_confirmed", "vendor_new_order"].includes(data.event_type) && data.order_id) return sendPaymentConfirmedNotifications(data.order_id);
  if (data.event_type === "customer_order_status" && data.restaurant_order_id) {
    const { data: event } = await db.from("order_status_events").select("to_status").eq("restaurant_order_id", data.restaurant_order_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (event) return sendOrderStatusNotification(data.restaurant_order_id, event.to_status);
  }
}
