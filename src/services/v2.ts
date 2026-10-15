import 'server-only';
import {createClient} from '@/lib/supabase/server';
export type V2Row=Record<string,unknown>;
export async function readV2(table:string,columns='*'){
 const db=await createClient();const {data,error}=await db.from(table).select(columns).limit(100);
 return {rows:(data??[]) as unknown as V2Row[],available:!error};
}
export function text(row:V2Row,key:string){return String(row[key]??'')}
