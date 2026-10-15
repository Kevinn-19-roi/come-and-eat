import {requirePermission} from '@/lib/auth/permissions';
import {ActionForm, SubmitButton} from '@/components/vendor-forms';
import {saveDeliveryHours} from './actions';

const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default async function Page() {
  const {db} = await requirePermission('delivery.operate');
  const {data, error} = await db.from('platform_delivery_hours').select('day_of_week,opens_at,closes_at,is_closed');
  return <section className="admin-card">
    <h1>Horaires de livraison Come & Eat</h1>
    <p>Heure d’Abidjan. Ces horaires concernent toutes les zones et tous les restaurants. Les horaires propres à chaque restaurant restent applicables.</p>
    {error ? <p role="status">Cette configuration sera disponible après application des migrations validées.</p> : <>
      {!data?.length ? <p>Aucun horaire global configuré. Les livraisons programmées restent bloquées jusqu’à la configuration ; le parcours habituel est conservé.</p> : null}
      <ActionForm action={saveDeliveryHours} submitLabel={false}>
        {days.map((name, day) => {
          const row = data?.find(item => item.day_of_week === day);
          return <fieldset key={day}>
            <legend>{name}</legend>
            <label className="check-row"><input type="checkbox" name={`closed_${day}`} defaultChecked={row?.is_closed ?? true}/>Livraisons fermées</label>
            <label className="field"><span>Ouverture</span><input type="time" name={`opens_${day}`} defaultValue={row?.opens_at?.slice(0, 5) ?? ''}/></label>
            <label className="field"><span>Fermeture</span><input type="time" name={`closes_${day}`} defaultValue={row?.closes_at?.slice(0, 5) ?? ''}/></label>
          </fieldset>;
        })}
        <p>Une fermeture avant l’ouverture correspond au lendemain, par exemple 18:00 → 02:00.</p>
        <SubmitButton pendingLabel="Enregistrement…" confirmMessage="Appliquer ces horaires à toutes les livraisons Come & Eat ?">Enregistrer les horaires</SubmitButton>
      </ActionForm>
    </>}
  </section>;
}
