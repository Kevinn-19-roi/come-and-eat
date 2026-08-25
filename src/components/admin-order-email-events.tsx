import { retryOrderEmail } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/vendor-forms";

const typeLabels: Record<string, string> = {
  customer_order_received: "Commande reçue · client",
  admin_order_requires_review: "Nouvelle commande · administration",
  customer_payment_confirmed: "Paiement confirmé · client",
  vendor_new_order: "Nouvelle commande · restaurant",
  customer_order_status: "Avancement · client",
};
const statusLabels: Record<string, string> = {
  pending: "En attente", processing: "En cours", sent: "Envoyé",
  failed: "Échec", skipped: "Non envoyé",
};

export async function AdminOrderEmailEvents({ orderId }: { orderId: string }) {
  const db = await createClient();
  const { data } = await db.from("email_events")
    .select("id,event_type,recipient,status,attempts,sent_at,failed_at,last_error_code,created_at")
    .eq("order_id", orderId).order("created_at", { ascending: false });
  if (!data?.length) return (
    <section className="admin-card">
      <h2>Notifications e-mail</h2>
      <p className="muted">Aucune tentative d’envoi enregistrée pour cette commande.</p>
    </section>
  );
  return (
    <section className="admin-card">
      <h2>Notifications e-mail</h2>
      <div className="admin-list">
        {data.map((event) => (
          <div className="admin-list-row" key={event.id}>
            <div>
              <strong>{typeLabels[event.event_type] ?? "Notification"}</strong>
              <p className="muted">{event.recipient} · {statusLabels[event.status] ?? event.status} · {event.attempts} tentative{event.attempts > 1 ? "s" : ""}</p>
            </div>
            {["failed", "skipped"].includes(event.status) ? (
              <form action={retryOrderEmail}>
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="event_id" value={event.id} />
                <SubmitButton className="btn btn-outline" pendingLabel="Nouvelle tentative…">Réessayer</SubmitButton>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
