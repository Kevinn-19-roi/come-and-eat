import assert from 'node:assert/strict';import ts from 'typescript';import {readFile} from 'node:fs/promises';
let role='super_admin',row,writes=[],race=false,readError=false,auditError=false;
const db={from(table){if(table==='restaurant_validation_events')return {select(){return this;},eq(){return this;},limit:async()=>({error:auditError?new Error('MISSING_AUDIT'):null})};if(table!=='restaurants')return {delete:()=>({eq:async()=>({error:null})})};let payload;const filters=[];const execute=()=>{
 if(readError)return {error:new Error('READ_FAILED')};if(!payload)return {data:{...row},error:null};
 if(race||filters.some(([key,value])=>row[key]!==value))return {data:null,error:null};
 writes.push(payload);Object.assign(row,payload);return {data:{id:row.id},error:null};
};const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},update(value){payload=value;return this;},maybeSingle:async()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}};return query;}};
const compiled={exports:{}};const source=await readFile('src/app/admin/actions.ts','utf8');
new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(compiled.exports,name=>{
 if(name==='next/cache')return {revalidatePath:()=>{}};
 if(name==='next/navigation')return {redirect:path=>{throw new Error(`REDIRECT:${path}`);}};
 if(name.includes('auth/admin'))return {requireAdmin:async()=>{if(!['admin','super_admin'].includes(role))throw new Error('FORBIDDEN');return {id:'qa-admin',role};}};
 if(name.includes('supabase/server'))return {createClient:async()=>db};
 if(name.includes('notifications/service'))return {};
 throw new Error(name);
});
const reset=()=>{row={id:'qa',validation_status:'approved',operating_status:'paused',is_official:false,archived_at:null};writes=[];race=false;readError=false;auditError=false;role='super_admin';};
const form=(action,confirmed='yes')=>{const f=new FormData();f.set('id','qa');f.set('action',action);f.set('confirmed',confirmed);f.set('reason','Motif QA');return f;};
const action=compiled.exports.setRestaurantState;
reset();await assert.rejects(()=>action(form('suspend')),/REDIRECT/);assert.equal(row.validation_status,'suspended');assert.equal(row.operating_status,'paused');assert.equal(row.suspension_reason,'Motif QA');
await assert.rejects(()=>action(form('restore')),/REDIRECT/);assert.equal(row.validation_status,'approved');assert.equal(row.operating_status,'paused');assert.equal(row.suspension_reason,null);assert.equal(writes.length,2);
await assert.rejects(()=>action(form('restore')),/REDIRECT/);assert.equal(writes.length,2,'Retry ne modifie pas à nouveau');
for(const forbidden of ['customer','vendor','orders_admin']){reset();role=forbidden;await assert.rejects(()=>action(form('suspend')),/FORBIDDEN/);assert.equal(writes.length,0);}
reset();role='admin';await assert.rejects(()=>action(form('suspend')),/REDIRECT/);assert.equal(row.validation_status,'suspended','Admin historique explicitement autorisé');
reset();await assert.rejects(()=>action(form('suspend','')),/CONFIRMATION_REQUIRED/);assert.equal(writes.length,0);
reset();await assert.rejects(()=>action(form('unknown')),/INVALID_RESTAURANT_ACTION/);
reset();const longReason=form('suspend');longReason.set('reason','x'.repeat(1001));await assert.rejects(()=>action(longReason),/INVALID_SUSPENSION_REASON/);
reset();row.validation_status='draft';await assert.rejects(()=>action(form('restore')),/INVALID_RESTAURANT_TRANSITION/);
reset();row.is_official=true;await assert.rejects(()=>action(form('suspend')),/NOT_UPDATED/);
reset();race=true;await assert.rejects(()=>action(form('suspend')),/NOT_UPDATED/);assert.equal(writes.length,0);
reset();readError=true;await assert.rejects(()=>action(form('suspend')),/READ_FAILED/);
reset();auditError=true;await assert.rejects(()=>action(form('suspend')),/AUDIT_UNAVAILABLE/);assert.equal(writes.length,0,'Pas de mutation si la migration audit manque');
reset();const forged=form('');forged.set('validation_status','suspended');forged.set('operating_status','paused');await compiled.exports.updateRestaurantAdmin(forged);assert.equal(row.validation_status,'approved','Formulaire général ne contourne pas les actions confirmées');
console.log('Server Actions exécutées avec mocks : suspension/levée/retry/pause, permissions, confirmation, panne et concurrence optimiste. Aucune écriture distante ni preuve Auth réelle.');
