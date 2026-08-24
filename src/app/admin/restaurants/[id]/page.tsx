import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin-ui";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminRestaurant,
  getAdminUsers,
  operationLabels,
  orderLabels,
  validationLabels,
} from "@/services/admin-marketplace";
import { getCuisineTypes } from "@/services/vendor-dashboard";
import {
  saveRestaurantMember,
  setRestaurantState,
  updateRestaurantAdmin,
} from "@/app/admin/actions";
import { formatPrice } from "@/lib/utils";
import {VendorMediaPicker,SubmitButton} from '@/components/vendor-forms';
const days = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; memberSearch?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { saved,memberSearch }] = await Promise.all([params, searchParams]);
  const [details, cuisines,users] = await Promise.all([
    getAdminRestaurant(id),
    getCuisineTypes(),
    getAdminUsers(memberSearch?.trim()??''),
  ]);
  if (!details) notFound();
  const { restaurant } = details;
  return (
    <>
      <AdminHeader
        eyebrow="Restaurant"
        title={restaurant.name}
        action={
          <Link className="btn btn-outline" href="/admin/restaurants">
            ← Restaurants
          </Link>
        }
      />
      <div className="admin-state-bar">
        <span className="vendor-badge">
          {validationLabels[restaurant.validation_status]}
        </span>
        <span className="vendor-badge">
          {operationLabels[restaurant.operating_status]}
        </span>
        {!restaurant.is_official ? (
          <>
            <form action={setRestaurantState}>
              <input type="hidden" name="id" value={id} />
              <button className="btn btn-danger" name="action" value="suspend">
                Suspendre
              </button>
            </form>
            <form action={setRestaurantState}>
              <input type="hidden" name="id" value={id} />
              <button className="btn btn-outline" name="action" value="approve">
                Réactiver
              </button>
            </form>
            <form action={setRestaurantState}>
              <input type="hidden" name="id" value={id} />
              <button
                className="btn btn-outline"
                name="action"
                value={
                  restaurant.operating_status === "paused" ? "open" : "pause"
                }
              >
                {restaurant.operating_status === "paused"
                  ? "Reprendre les commandes"
                  : "Mettre en pause"}
              </button>
            </form>
          </>
        ) : null}
      </div>
      {saved ? (
        <div className="form-feedback success" role="status">
          {saved?.startsWith('member-')
            ? saved==='member-remove'?'Membre retiré du restaurant.':'Membre enregistré.'
            : saved === "suspend"
            ? "Restaurant suspendu."
            : saved === "approve"
              ? "Restaurant réactivé."
              : saved === "pause"
                ? "Restaurant mis en pause."
                : "Les commandes ont repris."}
        </div>
      ) : null}
      <div className="admin-detail-grid">
        <form action={updateRestaurantAdmin} className="admin-card vendor-form">
          <input type="hidden" name="id" value={id} />
          <h2>Informations du restaurant</h2>
          <div className="vendor-photo-grid">
            <div>
              <strong>Logo</strong>
              <VendorMediaPicker
                restaurantId={id}
                type="logo"
                pathName="logo_path"
                initialPath={restaurant.logo_path ?? ""}
                items={details.media}
              />
            </div>
            <div>
              <strong>Couverture</strong>
              <VendorMediaPicker
                restaurantId={id}
                type="cover"
                pathName="cover_path"
                initialPath={restaurant.cover_path ?? ""}
                items={details.media}
              />
            </div>
          </div>
          <div className="vendor-form-grid">
            <label className="field full">
              <span>Nom</span>
              <input name="name" defaultValue={restaurant.name} required />
            </label>
            <label className="field full">
              <span>Description</span>
              <textarea
                name="description"
                rows={4}
                defaultValue={restaurant.description}
              />
            </label>
            <label className="field">
              <span>Téléphone</span>
              <input name="phone" defaultValue={restaurant.phone ?? ""} />
            </label>
            <label className="field">
              <span>WhatsApp</span>
              <input name="whatsapp" defaultValue={restaurant.whatsapp ?? ""} />
            </label>
            <label className="field full">
              <span>Email</span>
              <input
                type="email"
                name="email"
                defaultValue={restaurant.email ?? ""}
              />
            </label>
            <label className="field full">
              <span>Adresse</span>
              <input name="address" defaultValue={restaurant.address ?? ""} />
            </label>
            <label className="field">
              <span>Commune</span>
              <input name="commune" defaultValue={restaurant.commune ?? ""} />
            </label>
            <label className="field">
              <span>Lien Maps</span>
              <input
                type="url"
                name="maps_url"
                defaultValue={restaurant.maps_url ?? ""}
              />
            </label>
            <label className="field">
              <span>Délai de préparation</span>
              <input
                type="number"
                name="average_prep_minutes"
                defaultValue={restaurant.average_prep_minutes}
              />
            </label>
            <label className="field">
              <span>Ouverture</span>
              <select
                name="operating_status"
                defaultValue={restaurant.operating_status}
              >
                <option value="open">Ouvert</option>
                <option value="closed">Fermé</option>
                <option value="paused">En pause</option>
              </select>
            </label>
            <label className="field">
              <span>Validation</span>
              <select
                name="validation_status"
                defaultValue={restaurant.validation_status}
              >
                <option value="draft">Brouillon</option>
                <option value="pending_review">À valider</option>
                <option value="approved">Validé</option>
                <option value="rejected">Refusé</option>
                <option value="suspended">Suspendu</option>
              </select>
            </label>
          </div>
          <fieldset className="cuisine-choices">
            <legend>Types de cuisine</legend>
            {cuisines.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  name="cuisine_ids"
                  value={c.id}
                  defaultChecked={details.cuisineIds.includes(c.id)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <div className="option-checks">
            <label>
              <input
                type="checkbox"
                name="delivery_available"
                defaultChecked={restaurant.delivery_available}
              />
              Livraison
            </label>
            <label>
              <input
                type="checkbox"
                name="pickup_available"
                defaultChecked={restaurant.pickup_available}
              />
              Retrait
            </label>
          </div>
          <button className="btn btn-dark">Enregistrer</button>
        </form>
        <aside className="admin-detail-side">
          <section className="admin-card">
            <div className="card-head"><h2>Membres</h2><a className="btn btn-outline" href="#ajouter-membre">+ Ajouter un membre</a></div>
            {details.members.map((member) => {
              const profile = Array.isArray(member.profile)
                ? member.profile[0]
                : member.profile;
              const account=users.find((user:{id:string})=>user.id===member.user_id) as {email?:string}|undefined;
              return (
                <form
                  action={saveRestaurantMember}
                  className="member-row"
                  key={member.user_id}
                >
                  <input type="hidden" name="restaurant_id" value={id} />
                  <input type="hidden" name="user_id" value={member.user_id} />
                  <span>
                    <strong>{profile?.display_name || "Utilisateur"}</strong>
                    <small>{account?.email || profile?.phone || "Contact non renseigné"}</small>
                  </span>
                  <select name="role" defaultValue={member.role}>
                    <option value="owner">Propriétaire</option>
                    <option value="manager">Responsable</option>
                    <option value="staff">Équipe</option>
                  </select>
                  <SubmitButton pendingLabel="Mise à jour…">Modifier le rôle</SubmitButton>
                  <SubmitButton className="danger-link" name="action" value="remove" pendingLabel="Retrait…" confirmMessage="Retirer cet utilisateur du restaurant ?">
                    Retirer
                  </SubmitButton>
                </form>
              );
            })}
            {!details.members.length ? (
              <div className="admin-empty"><strong>Aucun membre associé</strong><p>Ajoutez un propriétaire, un manager ou un membre de l’équipe.</p></div>
            ) : null}
            <details id="ajouter-membre" open={Boolean(memberSearch)} className="member-add-panel">
              <summary>Ajouter un membre</summary>
              <form method="get" className="admin-inline-form"><label className="field"><span>Rechercher un utilisateur</span><input name="memberSearch" defaultValue={memberSearch??''} placeholder="Nom, email ou téléphone" required/></label><button className="btn btn-outline">Rechercher</button></form>
              {memberSearch&&users.length===0?<p className="muted">Aucun utilisateur trouvé.</p>:null}
              {memberSearch?users.map((user:{id:string;display_name?:string;email:string;phone?:string})=><form action={saveRestaurantMember} className="member-search-result" key={user.id}><input type="hidden" name="restaurant_id" value={id}/><input type="hidden" name="user_id" value={user.id}/><span><strong>{user.display_name||user.email}</strong><small>{user.email}{user.phone?` · ${user.phone}`:''}</small></span><select name="role" defaultValue="staff" aria-label={`Rôle de ${user.display_name||user.email}`}><option value="owner">Propriétaire</option><option value="manager">Manager</option><option value="staff">Staff</option></select><SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton></form>):null}
            </details>
          </section>
          <section className="admin-card">
            <h2>Horaires</h2>
            {details.hours.map((hour) => (
              <p key={hour.id}>
                {days[hour.day_of_week]}{" "}
                <strong>
                  {hour.is_closed
                    ? "Fermé"
                    : `${hour.opens_at.slice(0, 5)} – ${hour.closes_at.slice(0, 5)}`}
                </strong>
              </p>
            ))}
          </section>
        </aside>
      </div>
      <section className="admin-card">
        <div className="card-head">
          <h2>Produits récents</h2>
          <Link href={`/admin/products?restaurant=${id}`}>Voir tous</Link>
        </div>
        {details.products.map((product) => (
          <div className="admin-list-row" key={product.id}>
            <span>
              <strong>{product.name}</strong>
              <small>
                {product.hidden_by_admin
                  ? "Masqué"
                  : product.availability
                    ? "Disponible"
                    : "Indisponible"}
              </small>
            </span>
            <strong>{formatPrice(product.base_price)}</strong>
          </div>
        ))}
        {!details.products.length ? (
          <p className="muted">Aucun produit.</p>
        ) : null}
      </section>
      <section className="admin-card">
        <div className="card-head">
          <h2>Commandes récentes</h2>
          <Link href={`/admin/orders?restaurant=${id}`}>Voir toutes</Link>
        </div>
        {details.orders.map((order) => {
          const global = Array.isArray(order.order)
            ? order.order[0]
            : order.order;
          return (
            <Link
              className="admin-list-row"
              key={order.id}
              href={global?.id ? `/admin/orders/${global.id}` : "/admin/orders"}
            >
              <span>
                <strong>{global?.reference}</strong>
                <small>{global?.customer_name}</small>
              </span>
              <span>
                {orderLabels[order.status]} · {formatPrice(order.subtotal)}
              </span>
            </Link>
          );
        })}
        {!details.orders.length ? (
          <p className="muted">Aucune commande.</p>
        ) : null}
      </section>
    </>
  );
}
