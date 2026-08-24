import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/,'');
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&publicKey&&serviceKey,'Variables Supabase manquantes pour le test RLS.');
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const run=crypto.randomUUID().slice(0,8);const password=`CeA!${crypto.randomUUID()}9a`;
const createdUsers=[];const restaurantIds=[];let orderId;
async function createUser(label){const email=`vendor-rls-${label}-${run}@example.invalid`;const{data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;createdUsers.push(data.user.id);return{email,id:data.user.id}}
async function login(email){const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});const{error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return client}
try{
  const[ownerA,ownerB,staffA]=await Promise.all([createUser('a'),createUser('b'),createUser('staff')]);
  const{data:restaurants,error:restaurantError}=await admin.from('restaurants').insert([{name:`Test RLS A ${run}`,slug:'',description:'Test temporaire',validation_status:'approved',operating_status:'open'},{name:`Test RLS B ${run}`,slug:'',description:'Test temporaire',validation_status:'approved',operating_status:'open'}]).select('id');if(restaurantError)throw restaurantError;restaurantIds.push(...restaurants.map(row=>row.id)); await admin.from('restaurant_hours').insert(restaurants.flatMap(row=>Array.from({length:7},(_,day_of_week)=>({restaurant_id:row.id,day_of_week,opens_at:'00:00',closes_at:'23:59',is_closed:false}))));
  const[restaurantA,restaurantB]=restaurantIds;const{error:memberError}=await admin.from('restaurant_members').insert([{restaurant_id:restaurantA,user_id:ownerA.id,role:'owner'},{restaurant_id:restaurantB,user_id:ownerB.id,role:'owner'},{restaurant_id:restaurantA,user_id:staffA.id,role:'staff'}]);if(memberError)throw memberError;
  const{data:category,error:categoryError}=await admin.from('categories').select('id').eq('is_active',true).limit(1).single();if(categoryError)throw categoryError;
  const{data:products,error:productError}=await admin.from('products').insert([{restaurant_id:restaurantA,category_id:category.id,name:`Produit privé A ${run}`,slug:'',sku:'',base_price:1000,moderation_status:'pending'},{restaurant_id:restaurantB,category_id:category.id,name:`Produit privé B ${run}`,slug:'',sku:'',base_price:1200,moderation_status:'pending'}]).select('id,restaurant_id');if(productError)throw productError;const productA=products.find(row=>row.restaurant_id===restaurantA);const productB=products.find(row=>row.restaurant_id===restaurantB);
  const{data:order,error:orderError}=await admin.from('orders').insert({reference:`RLS-${run}`,customer_name:'Client test',customer_phone:'0000000000',fulfillment:'delivery',payment_method:'test',subtotal:2200,total:2200}).select('id').single();if(orderError)throw orderError;orderId=order.id;
  const{data:restaurantOrders,error:roError}=await admin.from('restaurant_orders').insert([{order_id:order.id,restaurant_id:restaurantA,subtotal:1000},{order_id:order.id,restaurant_id:restaurantB,subtotal:1200}]).select('id,restaurant_id');if(roError)throw roError;const roA=restaurantOrders.find(row=>row.restaurant_id===restaurantA);const roB=restaurantOrders.find(row=>row.restaurant_id===restaurantB);await admin.from('order_items').insert([{restaurant_order_id:roA.id,product_id:productA.id,product_name:'A',quantity:1,unit_price:1000,line_total:1000},{restaurant_order_id:roB.id,product_id:productB.id,product_name:'B',quantity:1,unit_price:1200,line_total:1200}]);
  const[clientA,clientB,clientStaff]=await Promise.all([login(ownerA.email),login(ownerB.email),login(staffA.email)]);
  const{data:ownA}=await clientA.from('products').select('id').eq('id',productA.id);assert.equal(ownA?.length,1,'Owner A doit lire son produit en attente.');
  const{data:foreignB}=await clientA.from('products').select('id').eq('id',productB.id);assert.equal(foreignB?.length,0,'Owner A ne doit pas lire le produit privé B.');
  const{data:updatedA,error:updateAError}=await clientA.from('products').update({base_price:1300}).eq('id',productA.id).select('id');assert.ifError(updateAError);assert.equal(updatedA?.length,1,'Owner A doit modifier son produit.');
  const{data:updatedB}=await clientA.from('products').update({base_price:9999}).eq('id',productB.id).select('id');assert.equal(updatedB?.length,0,'Owner A ne doit pas modifier le produit B.');
  const{data:staffUpdate}=await clientStaff.from('products').update({base_price:9999}).eq('id',productA.id).select('id');assert.equal(staffUpdate?.length,0,'Staff ne doit pas modifier les produits.');
  const{data:ordersA,error:ordersAError}=await clientA.from('restaurant_orders').select('id');assert.ifError(ordersAError);assert.deepEqual(ordersA?.map(row=>row.id),[roA.id],'Owner A ne doit voir que sa sous-commande.');
  const{data:itemsA}=await clientA.from('order_items').select('restaurant_order_id');assert.deepEqual(itemsA?.map(row=>row.restaurant_order_id),[roA.id],'Owner A ne doit voir que ses articles.');
  const{data:ordersB}=await clientB.from('restaurant_orders').select('id');assert.deepEqual(ordersB?.map(row=>row.id),[roB.id],'Owner B ne doit voir que sa sous-commande.');
  const{error:staffStatusError}=await clientStaff.rpc('vendor_update_restaurant_order_status',{target:roA.id,new_status:'confirmed'});assert.ifError(staffStatusError);
  console.log('RLS vendeur validée: produits privés isolés, écritures owner/manager protégées, staff limité et sous-commandes isolées.');
}finally{
  if(orderId)await admin.from('orders').delete().eq('id',orderId);
  if(restaurantIds.length)await admin.from('restaurants').delete().in('id',restaurantIds);
  for(const id of createdUsers)await admin.auth.admin.deleteUser(id);
}
