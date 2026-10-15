import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
type Conversation={id:string;subject:string;status:string;restaurant_id:string|null;updated_at:string;unread:number};
export async function ConversationInbox({restaurantId,search='',status='',beforeTime,beforeId,showFilters=true}:{restaurantId?:string;search?:string;status?:string;beforeTime?:string;beforeId?:string;showFilters?:boolean}){
 const db=await createClient();
 const {data,error}=await db.rpc('conversation_inbox',{search_text:search.slice(0,120),status_filter:status,restaurant:restaurantId??null,before_time:beforeTime??null,before_id:beforeId??null});
 if(error)return <p role="status">La messagerie est en cours d’activation ou le filtre est invalide.</p>;
 const rows=(data??[]) as Conversation[],visible=rows.slice(0,100),last=visible.at(-1);
 const next=new URLSearchParams({q:search,status});if(last){next.set('before_time',last.updated_at);next.set('before_id',last.id);}
 return <section className="conversation-inbox" aria-label="Conversations">{showFilters?<form method="get" className="admin-filters"><label className="field"><span>Rechercher</span><input name="q" defaultValue={search} maxLength={120}/></label><label className="field"><span>Statut</span><select name="status" defaultValue={status}><option value="">Toutes</option><option value="open">Ouvertes</option><option value="closed">Terminées</option><option value="unread">Non lues</option></select></label><button className="btn btn-dark">Filtrer</button></form>:null}
 {beforeTime?<Link className="btn btn-outline" href={`?${new URLSearchParams({q:search,status})}`}>Conversations récentes</Link>:null}
 {visible.length?visible.map(row=><Link href={`/account/messages/${row.id}`} key={row.id} className="conversation-list-item"><span><strong>{row.subject}</strong><small>{row.status==='closed'?'Terminée':row.restaurant_id?'Avec un restaurant':'Avec Come & Eat'} · {new Date(row.updated_at).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})}</small></span>{Number(row.unread)>0?<span className="conversation-unread">{row.unread} non lu{Number(row.unread)>1?'s':''}</span>:null}</Link>):<p>Aucune conversation pour ce filtre.</p>}
 {rows.length>100?<Link className="btn btn-outline" href={`?${next}`}>Conversations précédentes</Link>:null}
 </section>;
}
