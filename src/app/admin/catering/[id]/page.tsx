import {notFound} from 'next/navigation';
import {requirePermission} from '@/lib/auth/permissions';
import {CateringAdminHistory} from '@/components/catering-admin-history';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {db}=await requirePermission('catering.manage');const {id}=await params;
 const {data:request,error}=await db.from('catering_requests').select('id,name,event_type,event_at,guests,location,dishes,message,budget').eq('id',id).maybeSingle();if(error||!request)notFound();
 return <><h1>{request.name} · {request.event_type}</h1><p>{request.guests} personnes · {request.location}</p><p>{new Date(request.event_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})}</p><p>{request.dishes}</p><p>{request.message}</p><p>Budget indiqué : {request.budget===null?'Non renseigné':`${request.budget.toLocaleString('fr-FR')} FCFA`}</p><CateringAdminHistory requestId={request.id}/></>;
}
