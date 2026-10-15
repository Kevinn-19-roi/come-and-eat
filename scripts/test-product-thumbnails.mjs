import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
for(const path of ['src/app/admin/store/products/page.tsx','src/app/admin/products/page.tsx','src/app/vendor/(panel)/products/page.tsx']){
 const source=ts.createSourceFile(path,fs.readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let count=0;function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(source)==='Image'){count++;assert.ok(n.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='unoptimized'),path);}ts.forEachChild(n,visit);}visit(source);assert.ok(count>0);
}
for(const [file,name] of [['src/app/admin/store/actions.ts','updateOfficialProduct'],['src/app/vendor/actions.ts','updateProduct']]){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const fn=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(fn);
 const exports={};let saved={media_id:'old-photo'},failed=false;const invalidated=[];
 const db={from(table){let updating=false;const query={update(payload){assert.equal(table,'products');updating=true;this.payload=payload;return this;},eq(){return this;},select(){return this;},then(resolve){if(updating&&!failed)saved={...saved,...this.payload};return Promise.resolve(resolve({error:failed&&updating?{code:'QA_FAILURE'}:null,data:[]}));}};return query;}};
 const context={exports,createClient:async()=>db,requireAdmin:async()=>{},requireVendorManager:async()=>({restaurant:{id:'qa-store'}}),getOfficialStore:async()=>({id:'qa-store'}),value:(form,key)=>String(form.get(key)??''),amount:(form,key)=>Number(form.get(key)),checked:(form,key)=>form.get(key)==='on',saveGroups:async()=>{},saveOptionGroups:async()=>{},safeError(){},revalidatePath:path=>invalidated.push(path)};
 vm.runInNewContext(ts.transpileModule(fn.getText(source),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 const form=new FormData();for(const [key,value] of Object.entries({name:'QA product',category_id:'qa-category',base_price:'5000',media_id:'replacement-photo'}))form.set(key,value);
 assert.equal((await exports[name]('qa-product',{},form)).ok,true);assert.equal(saved.media_id,'replacement-photo');assert.ok(invalidated.length);
 // Reload and save again preserves the same media reference, without new uploads.
 form.set('media_id',saved.media_id);assert.equal((await exports[name]('qa-product',{},form)).ok,true);assert.equal(saved.media_id,'replacement-photo');
 failed=true;form.set('media_id','failed-photo');assert.ok((await exports[name]('qa-product',{},form)).error);assert.equal(saved.media_id,'replacement-photo');
}
console.log('Product lists bypass optimizer; actual admin/vendor save functions executed with isolated mocks: replacement, reload/re-save, failure preservation. No production writes or real Storage upload.');
