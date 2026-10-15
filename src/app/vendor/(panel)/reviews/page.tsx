import {requireVendor} from '@/lib/auth/vendor';
import {createClient} from '@/lib/supabase/server';
import {ActionForm} from '@/components/vendor-forms';
import {replyReview} from './actions';
export default async function Page(){const context=await requireVendor();const db=await createClient();const {data}=await db.from('product_reviews').select('id,rating,comment,vendor_reply,is_visible').eq('restaurant_id',context.restaurant!.id).order('created_at',{ascending:false}).limit(100);return <><h1>Avis de vos clients</h1>{!data?.length?<p>Aucun avis pour le moment.</p>:data.map(r=><article className="vendor-card" key={r.id}><h2>{r.rating}/5</h2><p>{r.comment}</p>{context.canManage?<ActionForm action={replyReview} submitLabel="Publier ma réponse"><input type="hidden" name="review" value={r.id}/><label className="field"><span>Réponse publique</span><textarea name="reply" defaultValue={r.vendor_reply??''} maxLength={2000}/></label></ActionForm>:<p>{r.vendor_reply}</p>}</article>)}</>}
