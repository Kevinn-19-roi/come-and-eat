import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
const compile=async file=>ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const validation={exports:{}};new Function('exports',await compile('src/lib/contact-validation.ts'))(validation.exports);
let sent=0,claimStatus='accepted',providerSent=true,recipient='',configured=true;
const db={from(){return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{value:{admin_recipient:recipient}},error:null}),update(){return {eq:async()=>({error:null})}}}},rpc:async name=>name==='claim_contact_message'?{data:claimStatus,error:null}:{data:[{event_id:'fixture',should_send:true}],error:null}};
const loaded={exports:{}};
const fakeRequire=name=>{
 if(name==='node:crypto')return {createHmac};
 if(name==='next/headers')return {headers:async()=>new Headers({'x-vercel-forwarded-for':'127.0.0.1'})};
 if(name.includes('supabase/admin'))return {createAdminClient:()=>db};
 if(name.includes('notifications/provider'))return {isEmailProviderConfigured:()=>configured,getEmailProvider:()=>({send:async()=>{sent++;return {sent:providerSent}}})};
 if(name.includes('contact-validation'))return validation.exports;
 throw new Error(`Unexpected import ${name}`);
};
new Function('require','exports',await compile('src/app/(public)/contact/actions.ts'))(fakeRequire,loaded.exports);
const original={key:process.env.SUPABASE_SERVICE_ROLE_KEY,recipient:process.env.EMAIL_CONTACT_RECIPIENT,admin:process.env.EMAIL_ADMIN_RECIPIENT};
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';delete process.env.EMAIL_CONTACT_RECIPIENT;delete process.env.EMAIL_ADMIN_RECIPIENT;
try{
 const form=new FormData();for(const [k,v]of Object.entries({name:'Awa Koné',email:'awa@example.invalid',message:'Une question concernant la carte.'}))form.set(k,v);
 assert.ok((await loaded.exports.sendContact({},form)).error);assert.equal(sent,0);
 recipient='qa@example.invalid';assert.ok((await loaded.exports.sendContact({},form)).message);assert.equal(sent,1);
 claimStatus='limited';assert.ok((await loaded.exports.sendContact({},form)).error);assert.equal(sent,1);
 claimStatus='duplicate';assert.ok((await loaded.exports.sendContact({},form)).error);assert.equal(sent,1);
 claimStatus='accepted';providerSent=false;assert.ok((await loaded.exports.sendContact({},form)).error);assert.equal(sent,2);
 form.set('website','spam');assert.ok((await loaded.exports.sendContact({},form)).message);assert.equal(sent,2);
 console.log('Contact Server Action: destinataire absent, succès, rate limit, doublon, panne provider, honeypot validés avec mocks; zéro email réel.');
}finally{for(const [name,value]of [['SUPABASE_SERVICE_ROLE_KEY',original.key],['EMAIL_CONTACT_RECIPIENT',original.recipient],['EMAIL_ADMIN_RECIPIENT',original.admin]]){if(value===undefined)delete process.env[name];else process.env[name]=value}}
