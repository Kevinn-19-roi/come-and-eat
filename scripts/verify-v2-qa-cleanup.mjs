// Recovery limited to the interrupted QA run of 2026-10-14; never a general purge.
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/,'');
if(!url?.includes('pazddhyqojhrdinaqryu.supabase.co'))throw new Error('Unexpected project');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const since='2026-10-14T12:50:00Z';
const {data:restaurants,error}=await db.from('restaurants').select('id,name').like('name','QA Restaurant%').gte('created_at',since);
if(error)throw error;
const listing=await db.auth.admin.listUsers({page:1,perPage:1000});if(listing.error)throw listing.error;
const candidates=restaurants.filter(r=>/^QA Restaurant [a-f0-9]{8}$/.test(r.name));
for(const restaurant of candidates){
 const run=restaurant.name.split(' ').at(-1);
 const users=listing.data.users.filter(u=>u.created_at>=since&&new RegExp(`^qa-regression-[a-z]+-${run}@example\\.invalid$`).test(u.email??''));
 if(!users.length)throw new Error('No matching temporary accounts; refusing deletion');
 const related=await db.from('restaurant_orders').select('id').eq('restaurant_id',restaurant.id);if(related.error||related.data.length)throw new Error('Orders exist; refusing deletion');
 if(process.argv.includes('--clean-own-interrupted-run')){
  const removed=await db.from('restaurants').delete().eq('id',restaurant.id);if(removed.error)throw removed.error;
  for(const u of users){const removedUser=await db.auth.admin.deleteUser(u.id);if(removedUser.error)throw removedUser.error;}
 }
 console.log('Matched interrupted QA run:',run,'temporary restaurants:',1,'temporary accounts:',users.length,'cleaned:',process.argv.includes('--clean-own-interrupted-run'));
}
console.log('No business records selected.');
