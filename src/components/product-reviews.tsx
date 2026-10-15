import Link from 'next/link';
import {createPublicClient} from '@/lib/supabase/public';
import {ActionForm} from '@/components/vendor-forms';
import {reportReview} from '@/app/(public)/account/reviews/actions';
export async function ProductReviews({productId}:{productId:string}){
 const db=createPublicClient();const [{data,error},{data:summary}]=await Promise.all([db.rpc('list_public_product_reviews',{target_product:productId}),db.rpc('public_product_review_summary',{target_product:productId})]);
 const rows=(data??[]) as {id:string;rating:number;comment:string;display_name:string;vendor_reply:string|null;created_at:string}[];
 return <section className="store-container section"><div className="section-head"><div><p className="section-kicker">Achats vérifiés</p><h2>L’avis des clients</h2></div><Link className="quiet-link" href="/account/reviews">Donner mon avis →</Link></div>{error?<p>Les avis ne sont pas encore disponibles.</p>:rows.length?<><p>{summary?.[0]?.average_rating??'—'} / 5 · {summary?.[0]?.review_count??rows.length} avis</p>{rows.map(r=><article key={r.id} className="card"><strong>{r.display_name} · {r.rating}/5</strong><p><small>Achat vérifié · {new Date(r.created_at).toLocaleDateString('fr-FR')}</small></p><p>{r.comment}</p>{r.vendor_reply?<blockquote><strong>Réponse du restaurant</strong><p>{r.vendor_reply}</p></blockquote>:null}<details><summary>Signaler cet avis</summary><ActionForm action={reportReview} submitLabel="Transmettre le signalement"><input type="hidden" name="review" value={r.id}/><label className="field"><span>Pourquoi cet avis vous semble-t-il abusif ?</span><textarea name="reason" minLength={5} maxLength={1000} required/></label></ActionForm></details></article>)}</>:<p>Ce plat n’a pas encore reçu d’avis.</p>}</section>
}
