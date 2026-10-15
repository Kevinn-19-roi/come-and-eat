import {authorizedUserSource} from '@/services/admin-users';
import {iterateAdminUsers,userRoleLabels} from '@/lib/admin-users-data';
import {csvCell} from '@/lib/csv';
export async function GET(request:Request){
 const source=await authorizedUserSource();
 const params=new URL(request.url).searchParams;const filters={q:params.get('q')??'',role:params.get('role')??''};
 const encoder=new TextEncoder();
 const stream=new ReadableStream({async start(controller){try{
  controller.enqueue(encoder.encode('\uFEFF'+['Nom et prénom','Prénom','Nom','Email','Téléphone','Rôle','Statut','Date d’inscription'].map(csvCell).join(';')+'\r\n'));
  for await(const batch of iterateAdminUsers(source,filters))controller.enqueue(encoder.encode(batch.users.map(user=>[user.display_name,user.first_name,user.last_name,user.email,user.phone,userRoleLabels[user.role]??user.role,user.status,user.created_at].map(csvCell).join(';')).join('\r\n')+(batch.users.length?'\r\n':'')));
  controller.close();
 }catch{controller.error(new Error('La liste des utilisateurs n’a pas pu être exportée. Réessayez.'));}}});
 return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="come-and-eat-utilisateurs-${new Date().toISOString().slice(0,10)}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
