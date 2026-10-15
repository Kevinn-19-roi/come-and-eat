export const userRoleLabels: Record<string, string> = {customer:'Client',vendor:'Vendeur',admin:'Administrateur',super_admin:'Super administrateur',unconfigured:'Profil non configuré'};
export type AdminUserRow = {id:string;display_name:string;first_name:string;last_name:string;email:string;phone:string;role:string;status:string;created_at:string;restaurants:Array<{name:string;member_role:string}>};
type Account = {id:string;email?:string;phone?:string;created_at:string;email_confirmed_at?:string;banned_until?:string;user_metadata?:Record<string,unknown>};
type Profile = {id:string;display_name:string|null;phone:string|null;role:string};
export type UserSource = {accounts:(page:number)=>Promise<Account[]>;profiles:(ids:string[])=>Promise<Profile[]>;memberships:(ids:string[])=>Promise<Record<string,Array<{name:string;member_role:string}>>>};
const text=(value:unknown)=>typeof value==='string'?value:'';
export async function* iterateAdminUsers(source:UserSource,filters:{q?:string;role?:string}={}) {
 const needle=(filters.q??'').trim().slice(0,200).toLocaleLowerCase('fr');
 for(let page=1;;page++){
  const accounts=await source.accounts(page);if(!accounts.length)return;
  const ids=accounts.map(user=>user.id);const [profiles,memberships]=await Promise.all([source.profiles(ids),source.memberships(ids)]);const byId=new Map(profiles.map(profile=>[profile.id,profile]));
  const users=accounts.map(user=>{const profile=byId.get(user.id),meta=user.user_metadata??{};
   return {id:user.id,display_name:profile?.display_name||text(meta.display_name)||text(meta.full_name)||[text(meta.first_name),text(meta.last_name)].filter(Boolean).join(' '),first_name:text(meta.first_name),last_name:text(meta.last_name),email:user.email??'',phone:profile?.phone||user.phone||'',role:profile?.role??'unconfigured',status:user.banned_until&&Date.parse(user.banned_until)>Date.now()?'Suspendu':user.email_confirmed_at?'Email confirmé':'Email à confirmer',created_at:user.created_at,restaurants:memberships[user.id]??[]} satisfies AdminUserRow;
  });
  yield {accountCount:accounts.length,users:users.filter(user=>(!filters.role||user.role===filters.role)&&(!needle||[user.display_name,user.first_name,user.last_name,user.email,user.phone].some(field=>field.toLocaleLowerCase('fr').includes(needle))))};
 }
}
export async function collectUserPage(source:UserSource,filters:{q?:string;role?:string},page=1,pageSize=50){
 const rows:AdminUserRow[]=[];let total=0,matching=0;const offset=(page-1)*pageSize;
 for await(const batch of iterateAdminUsers(source,filters)){total+=batch.accountCount;for(const user of batch.users){if(matching>=offset&&rows.length<pageSize)rows.push(user);matching++;}}
 return {rows,total,matching,page,pageSize,pages:Math.max(1,Math.ceil(matching/pageSize))};
}
