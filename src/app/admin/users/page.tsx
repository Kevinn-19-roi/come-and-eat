import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AdminHeader} from '@/components/admin-ui';
import {changeUserRole} from '@/app/admin/actions';
import {requireAdmin} from '@/lib/auth/admin';
import {getUserPage} from '@/services/admin-users';
import {userRoleLabels} from '@/lib/admin-users-data';
import {UserCsvDownload} from '@/components/user-csv-download';
import {SubmitButton} from '@/components/vendor-forms';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;role?:string;page?:string}>}){
 const admin=await requireAdmin();const params=await searchParams;const q=(params.q??'').trim().slice(0,200);const role=params.role&&Object.hasOwn(userRoleLabels,params.role)?params.role:'';
 const requested=Number(params.page??1);const page=Number.isSafeInteger(requested)&&requested>0?requested:1;
 const result=await getUserPage({q,role},page);const query=new URLSearchParams({q,role});const href=(number:number)=>'/admin/users?'+new URLSearchParams({q,role,page:String(number)});
 if(page>result.pages)redirect(href(result.pages));
 return <><AdminHeader eyebrow="Utilisateurs et accès" title="Utilisateurs"/><form className="admin-filters"><input name="q" defaultValue={q} maxLength={200} placeholder="Nom, email ou téléphone"/><select name="role" defaultValue={role} aria-label="Filtrer par rôle"><option value="">Tous les rôles</option>{Object.entries(userRoleLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button className="btn btn-dark">Rechercher</button></form>
 <p>{result.total} comptes au total · {result.matching} correspondant aux filtres · {result.rows.length} affichés sur cette page.</p><UserCsvDownload query={query.toString()}/>
 <section className="admin-card"><div className="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Contact</th><th>Rôle</th><th>Statut</th><th>Restaurants</th><th>Inscription</th><th></th></tr></thead><tbody>{result.rows.map(user=><tr key={user.id}><td><strong>{user.display_name||'Sans nom'}</strong></td><td>{user.email}<small>{user.phone}</small></td><td>{userRoleLabels[user.role]??user.role}</td><td>{user.status}</td><td>{user.restaurants.length?user.restaurants.map(r=><small key={r.name+'-'+r.member_role}>{r.name} · {r.member_role==='owner'?'Propriétaire':r.member_role==='manager'?'Responsable':'Équipe'}</small>):'Aucun'}</td><td>{new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(user.created_at))}</td><td>{admin.role==='super_admin'&&user.role!=='unconfigured'?<form action={changeUserRole} className="table-actions"><input type="hidden" name="user_id" value={user.id}/><select name="role" defaultValue={user.role} aria-label={'Rôle de '+(user.display_name||user.email)}>{Object.entries(userRoleLabels).filter(([key])=>key!=='unconfigured').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><SubmitButton>Enregistrer</SubmitButton></form>:<span className="muted">Lecture seule</span>}</td></tr>)}</tbody></table>{!result.rows.length?<p>Aucun utilisateur sur cette page. <Link href={href(1)}>Revenir à la première page</Link></p>:null}</div>
 <nav aria-label="Pages des utilisateurs" className="vendor-row-actions">{page>1?<Link prefetch={false} href={href(page-1)}>← Précédente</Link>:null}<span>Page {page} / {result.pages}</span>{page<result.pages?<Link prefetch={false} href={href(page+1)}>Suivante →</Link>:null}</nav></section></>;
}
