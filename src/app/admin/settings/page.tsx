import Link from "next/link";
import { AdminHeader } from "@/components/admin-ui";
import { SubmitButton } from "@/components/vendor-forms";
import { saveCommissionSetting, saveEmailSettings, saveSiteSetting } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { isEmailProviderConfigured } from "@/lib/notifications/provider";
import { getAdminContent } from "@/services/admin-marketplace";

type Settings = Record<string, unknown>;

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const [{ saved }, { settings }] = await Promise.all([searchParams, getAdminContent()]);
  const platform = (settings.find((row) => row.key === "platform")?.value ?? {}) as Settings;
  const commission = (settings.find((row) => row.key === "marketplace_commission")?.value ?? {}) as Settings;
  const email = (settings.find((row) => row.key === "email")?.value ?? {}) as Settings;
  const rate = Number(commission.rate_bps ?? 0) / 100;
  const providerReady = isEmailProviderConfigured();

  return <>
    <AdminHeader eyebrow="Réglages essentiels" title="Paramètres" />
    {saved === "commission" ? <div className="form-feedback success">Commission enregistrée. Les anciennes commandes restent inchangées.</div> : null}
    {saved === "email" ? <div className="form-feedback success">Réglages e-mail enregistrés.</div> : null}
    <div className="admin-two">
      <div>
        <form action={saveSiteSetting} className="admin-card vendor-form">
          <input type="hidden" name="key" value="platform" />
          <h2>Prise de commandes</h2>
          <input type="hidden" name="ordering_enabled" value="false" />
          <label className="check-row"><input type="checkbox" name="ordering_enabled" defaultChecked={platform.ordering_enabled !== "false"} />La plateforme accepte les commandes</label>
          <input type="hidden" name="delivery_enabled" value="false" />
          <label className="check-row"><input type="checkbox" name="delivery_enabled" defaultChecked={platform.delivery_enabled !== "false"} />Livraison proposée</label>
          <input type="hidden" name="pickup_enabled" value="false" />
          <label className="check-row"><input type="checkbox" name="pickup_enabled" defaultChecked={platform.pickup_enabled !== "false"} />Retrait proposé</label>
          <button className="btn btn-dark">Enregistrer</button>
        </form>
        <form action={saveCommissionSetting} className="admin-card vendor-form">
          <h2>Paiement</h2>
          <label className="field"><span>Commission Come & Eat</span><div className="commission-input"><input type="number" name="commission_rate" min="0" max="100" step="0.01" defaultValue={rate} /><strong>%</strong></div><small>Pourcentage prélevé sur les commandes des restaurants partenaires. Ce taux est figé sur chaque nouvelle commande.</small></label>
          <SubmitButton className="btn btn-dark" pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        </form>
        <form action={saveEmailSettings} className="admin-card vendor-form">
          <h2>E-mails transactionnels</h2>
          <p className="muted">{providerReady ? "Le service d’envoi est configuré." : "Le service d’envoi n’est pas encore configuré sur Vercel. Les commandes continuent de fonctionner normalement."}</p>
          <input type="hidden" name="enabled" value="false" />
          <label className="check-row"><input type="checkbox" name="enabled" defaultChecked={email.enabled !== false && email.enabled !== "false"} />Activer les e-mails automatiques</label>
          <label className="field"><span>Nom de l’expéditeur</span><input name="sender_name" defaultValue={String(email.sender_name ?? "Come & Eat")} /></label>
          <label className="field"><span>Adresse de réponse</span><input type="email" name="reply_to" defaultValue={String(email.reply_to ?? "")} placeholder="contact@votre-domaine.ci" /></label>
          <label className="field"><span>Adresse qui reçoit les nouvelles commandes</span><input type="email" name="admin_recipient" defaultValue={String(email.admin_recipient ?? "")} placeholder="commandes@votre-domaine.ci" /></label>
          <small className="muted">Les clés et secrets restent uniquement dans Vercel et ne sont jamais affichés ici.</small>
          <SubmitButton className="btn btn-dark" pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        </form>
      </div>
      <section className="admin-card">
        <h2>Informations commerciales</h2>
        <p className="muted">Le téléphone, l’adresse, les horaires et les liens publics sont regroupés dans le contenu du site.</p>
        <Link className="btn btn-outline" href="/admin/content">Modifier le contenu</Link>
      </section>
    </div>
  </>;
}
