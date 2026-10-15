'use server';

import {revalidatePath} from 'next/cache';
import {requirePermission} from '@/lib/auth/permissions';

export async function saveDeliveryHours(_state: object, form: FormData) {
  const {db} = await requirePermission('delivery.operate');
  const hours = Array.from({length: 7}, (_, day) => ({
    day,
    closed: form.get(`closed_${day}`) === 'on',
    opens: String(form.get(`opens_${day}`) ?? ''),
    closes: String(form.get(`closes_${day}`) ?? ''),
  }));
  if (hours.some(row => !row.closed && (
    !/^\d{2}:\d{2}$/.test(row.opens) || !/^\d{2}:\d{2}$/.test(row.closes) || row.opens === row.closes
  ))) return {error: 'Renseignez une ouverture et une fermeture différentes pour chaque jour ouvert.'};
  const {error} = await db.rpc('save_platform_delivery_hours', {hours});
  if (error) return {error: 'Les horaires n’ont pas été enregistrés. Vérifiez les heures et vos permissions.'};
  revalidatePath('/admin/delivery-hours');
  revalidatePath('/checkout');
  revalidatePath('/meal-planner');
  return {ok: true, message: 'Horaires de livraison enregistrés, en heure d’Abidjan.'};
}
