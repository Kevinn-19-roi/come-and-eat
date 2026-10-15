import {createClient} from '@/lib/supabase/server';
import {renderQuoteDocument} from '@/lib/catering';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return new Response('Connexion requise',{status:401});
 const {id}=await params;if(!/^[\da-f-]{36}$/i.test(id))return new Response('Devis introuvable',{status:404});
 // RLS protects both the quote and its recipient; no service-role fallback.
 const {data:quote,error}=await db.from('catering_quotes').select('id,lines,extra_fee,total,valid_until,conditions,status,request:catering_requests(name,event_type,event_at,location)').eq('id',id).maybeSingle();
 if(error||!quote||!quote.request)return new Response('Devis introuvable',{status:404});
 const recipient=quote.request as unknown as {name:string;event_type:string;event_at:string;location:string};
 return new Response(renderQuoteDocument(quote,recipient),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="devis-come-and-eat.html"','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}});
}
