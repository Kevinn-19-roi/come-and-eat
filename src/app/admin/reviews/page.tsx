import {requirePermission} from '@/lib/auth/permissions';
import {ActionForm} from '@/components/vendor-forms';
import {moderateReview} from './actions';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){
 const {db}=await requirePermission('reviews.moderate');const {status}=await searchParams;
 let query=db.from('product_reviews').select('id,rating,comment,is_visible,moderation_reason,created_at').order('created_at',{ascending:false}).limit(100);
 if(status==='hidden')query=query.eq('is_visible',false);if(status==='visible')query=query.eq('is_visible',true);
 const [{data},{data:reports}]=await Promise.all([query,db.from('review_reports').select('review_id,reason,created_at').order('created_at',{ascending:false}).limit(500)]);
 const shown=(data??[]).filter(r=>status!=='reported'||reports?.some(s=>s.review_id===r.id));
 return <><h1>Avis clients</h1><p>Les avis critiques légitimes doivent rester visibles.</p><form className="admin-filters"><label className="field"><span>Statut des avis</span><select name="status" defaultValue={status??''}><option value="">Tous</option><option value="visible">Visibles</option><option value="hidden">Masqués</option><option value="reported">Signalés parmi les 100 derniers avis</option></select></label><button className="btn btn-dark">Filtrer</button></form>
 {shown.map(r=><article className="admin-card" key={r.id}><h2>{r.rating}/5 · {r.is_visible?'Visible':'Masqué'}</h2><p>{r.comment}</p><p>{r.moderation_reason}</p>{reports?.filter(s=>s.review_id===r.id).map((s,i)=><blockquote key={i}><strong>Signalement reçu</strong><p>{s.reason}</p></blockquote>)}<ActionForm action={moderateReview} submitLabel={r.is_visible?'Masquer cet avis':'Restaurer cet avis'}><input type="hidden" name="review" value={r.id}/><input type="hidden" name="visible" value={String(!r.is_visible)}/><label className="field"><span>Motif de modération</span><textarea name="reason" required={r.is_visible} minLength={5} maxLength={1000}/></label></ActionForm></article>)}{!shown.length?<div className="admin-empty">Aucun avis correspondant.</div>:null}</>;
}
