import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getCuisineTypes } from "@/services/vendor-dashboard";
import { getOfficialStoreDetails } from "@/services/official-store";
import { OfficialStoreForm } from "@/components/official-store-form";
import { SubmitButton } from "@/components/vendor-forms";
import { toggleOfficialStorePause } from "./actions";

export default async function OfficialStorePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const [details, cuisines] = await Promise.all([
    getOfficialStoreDetails(),
    getCuisineTypes(),
  ]);
  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Boutique officielle</p>
          <h1>
            Come & Eat <span className="official-badge">Officielle</span>
          </h1>
        </div>
        <div className="store-admin-actions">
          <Link className="btn btn-outline" href="/admin/store/media">
            Photos
          </Link>
          <Link className="btn btn-outline" href="/admin/store/hours">
            Horaires
          </Link>
          <Link className="btn btn-dark" href="/admin/store/products">
            Produits
          </Link>
        </div>
      </div>
      {status === "paused" || status === "open" ? (
        <div className="form-feedback success" role="status">
          {status === "paused"
            ? "Boutique mise en pause."
            : "Les commandes ont repris."}
        </div>
      ) : null}
      <div className="vendor-alert">
        <strong>Gérée par la plateforme</strong>
        <p>Cette boutique ne dépend d’aucun membre vendeur.</p>
      </div>
      <form action={toggleOfficialStorePause} className="official-pause">
        <SubmitButton
          className="btn btn-outline"
          confirmMessage={
            details.store.operating_status === "paused"
              ? "Reprendre les commandes ?"
              : "Mettre la boutique en pause ?"
          }
        >
          {details.store.operating_status === "paused"
            ? "Reprendre les commandes"
            : "Mettre en pause"}
        </SubmitButton>
        <span
          className={
            details.store.operating_status === "paused"
              ? "vendor-badge danger"
              : "vendor-badge success"
          }
        >
          {details.store.operating_status === "paused" ? "En pause" : "Ouverte"}
        </span>
      </form>
      <OfficialStoreForm
        store={details.store}
        cuisineIds={details.cuisineIds}
        cuisines={cuisines}
        media={details.media}
      />
    </>
  );
}
