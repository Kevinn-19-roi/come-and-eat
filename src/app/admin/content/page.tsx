import { saveHomepageSection, saveSiteSetting, saveCommitmentsImage } from "@/app/admin/actions";
import { AdminHeader } from "@/components/admin-ui";
import { ActionForm, SubmitButton, VendorMediaPicker } from "@/components/vendor-forms";
import { createClient } from '@/lib/supabase/server';
import { storyFallback } from "@/config/story";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminContent, getAdminMedia } from "@/services/admin-marketplace";

const fields: Record<string, { label: string; names: { key: string; label: string }[] }> = {
  brand: { label: "Identité", names: [{ key: "name", label: "Nom de la marque" }, { key: "tagline", label: "Slogan" }] },
  announcement: { label: "Bandeau supérieur", names: [{ key: "text", label: "Texte du bandeau" }] },
  contact: { label: "Coordonnées", names: [{ key: "phone", label: "Téléphone" }, { key: "email", label: "Email" }, { key: "address", label: "Adresse" }] },
  hours: { label: "Horaires généraux", names: [{ key: "label", label: "Horaires affichés" }] },
  footer: { label: "Pied de page", names: [{ key: "description", label: "Description" }, { key: "legal", label: "Mention légale" }] },
  external_links: { label: "Liens externes", names: [{ key: "bloop", label: "Site Bloop" }] },
};

export default async function Page() {
  await requireAdmin();
  const [{ settings, sections }, media] = await Promise.all([getAdminContent(), getAdminMedia()]);
  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value as Record<string, unknown>]));
  const story = values.story ?? {};
  const db = await createClient();
  const {data:concept,error:conceptError} = await db.from('homepage_sections').select('media_id,media(id,path,file_name,alt_text)').eq('section_key','concept').maybeSingle();
  if (conceptError) throw conceptError;
  const currentMedia = Array.isArray(concept?.media)?concept.media[0]:concept?.media;
  const conceptMedia = currentMedia ? [...media.filter(item=>item.id!==currentMedia.id),{...currentMedia,publicUrl:db.storage.from('restaurant-media').getPublicUrl(currentMedia.path).data.publicUrl}] : media;
  return <>
    <AdminHeader eyebrow="Textes administrables" title="Contenu du site" />
    <p className="admin-notice">Ces valeurs remplacent la configuration locale. Si une valeur manque, le site conserve automatiquement son texte de secours.</p>
    <section className="admin-card vendor-form">
      <h2>Image de la section Nos engagements</h2>
      <p>L’image est affichée sur l’accueil, dans la section « Notre façon de cuisiner ». Le cadrage reste identique. Pour revenir à l’illustration d’origine, retirez la photo puis enregistrez.</p>
      <ActionForm action={saveCommitmentsImage} submitLabel="Enregistrer l’image">
        <VendorMediaPicker type="other" label="Ajouter ou remplacer l’image" items={conceptMedia} initialId={concept?.media_id??''} fallbackSrc="/images/alloco.svg" clearLabel="Revenir à l’image par défaut" />
      </ActionForm>
    </section>
    <section className="admin-card vendor-form story-admin-card">
      <h2>Section Histoire</h2>
      <p className="muted">Le texte et la photo apparaissent sur la page Notre histoire.</p>
      <form action={saveSiteSetting} className="vendor-form">
        <input type="hidden" name="key" value="story" />
        <label className="field"><span>Titre</span><input name="title" defaultValue={String(story.title ?? storyFallback.title)} /></label>
        <label className="field"><span>Texte</span><textarea name="body" rows={18} defaultValue={String(story.body ?? storyFallback.body)} /></label>
        <h3>Photo de la section Histoire</h3>
        <VendorMediaPicker name="media_id_unused" pathName="photo_path" type="other" label={story.photo_path ? "Changer la photo" : "Ajouter une photo"} items={media} initialPath={String(story.photo_path ?? "")} />
        <SubmitButton className="btn btn-dark" pendingLabel="Enregistrement…">Enregistrer l’histoire</SubmitButton>
      </form>
    </section>
    <div className="admin-content-grid">{Object.entries(fields).map(([key, group]) => <form action={saveSiteSetting} className="admin-card vendor-form" key={key}><input type="hidden" name="key" value={key} /><h2>{group.label}</h2>{group.names.map((field) => <label className="field" key={field.key}><span>{field.label}</span><input name={field.key} defaultValue={String(values[key]?.[field.key] ?? "")} /></label>)}<SubmitButton className="btn btn-dark" pendingLabel="Enregistrement…">Enregistrer</SubmitButton></form>)}</div>
    <AdminHeader eyebrow="Accueil" title="Sections éditoriales" />
    <section className="admin-content-grid">{sections.map((section) => <form action={saveHomepageSection} className="admin-card vendor-form" key={section.id}><input type="hidden" name="id" value={section.id} /><input type="hidden" name="section_key" value={section.section_key} /><label className="field"><span>Titre</span><input name="title" defaultValue={section.title ?? ""} /></label><label className="field"><span>Sous-titre</span><input name="subtitle" defaultValue={section.subtitle ?? ""} /></label><label className="field"><span>Texte</span><textarea name="body" defaultValue={section.body ?? ""} /></label><label className="field"><span>Ordre</span><input name="sort_order" type="number" defaultValue={section.sort_order} /></label><label className="check-row"><input type="checkbox" name="is_visible" defaultChecked={section.is_visible} />Afficher cette section</label><SubmitButton className="btn btn-dark" pendingLabel="Enregistrement…">Enregistrer</SubmitButton></form>)}</section>
  </>;
}
