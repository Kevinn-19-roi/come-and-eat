import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots=[],cursor=0,fail=false;
const React={createElement:(type,props,...children)=>({type,props:props??{},children}),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=v];},useEffect(){},useActionState(){return [{},()=>{},false];}};
const item={id:'qa-media',path:'qa/image.png',file_name:'image.png',alt_text:'QA',publicUrl:'https://example.test/storage/image.png'};
const exports={};
const source=fs.readFileSync('src/components/vendor-forms.tsx','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,moduleResolution:ts.ModuleResolutionKind.NodeJs,esModuleInterop:true}}).outputText;
vm.runInNewContext(js,{exports,React,Error,require(name){if(name==='react')return React;if(name==='next/image')return {__esModule:true,default:'Image'};if(name==='react-dom')return {useFormStatus:()=>({pending:false})};if(name.includes('toast-provider'))return {useToast:()=>()=>{}};if(name.includes('media-upload'))return {uploadMedia:async()=>{if(fail)throw new Error('QA upload refused');return item;}};throw Error(name);}});
const walk=n=>!n||typeof n!=='object'?[]:[n,...(n.children??[]).flat(Infinity).flatMap(walk)];
for(const type of ['logo','cover','product']){
 slots=[];const render=()=>{cursor=0;return walk(exports.VendorMediaPicker({type,restaurantId:'qa-restaurant',pathName:`${type}_path`,items:[]}));};
 let nodes=render();await nodes.find(n=>n.props.type==='file').props.onChange({target:{files:[{name:'image.png'}]}});
 nodes=render();assert.equal(nodes.find(n=>n.type==='Image').props.unoptimized,true);assert.equal(nodes.find(n=>n.type==='Image').props.src,item.publicUrl);assert.equal(nodes.find(n=>n.props.name===`${type}_path`).props.value,item.path);
 fail=true;await nodes.find(n=>n.props.type==='file').props.onChange({target:{files:[{name:'bad.png'}]}});nodes=render();assert.equal(nodes.find(n=>n.props.name===`${type}_path`).props.value,item.path);assert.ok(nodes.some(n=>n.children.includes('QA upload refused')));fail=false;
 slots=[];cursor=0;nodes=walk(exports.VendorMediaPicker({type,items:[item],initialPath:item.path}));assert.equal(nodes.find(n=>n.type==='Image').props.unoptimized,true);
 slots=[];cursor=0;nodes=walk(exports.VendorMediaPicker({type,items:[item]}));assert.equal(nodes.find(n=>n.type==='Image').props.unoptimized,true);
}
slots=[];cursor=0;
const fallbackProps={type:'other',items:[item],initialId:item.id,fallbackSrc:'/images/alloco.svg',clearLabel:'Revenir à l’image par défaut'};
let fallbackNodes=walk(exports.VendorMediaPicker(fallbackProps));fallbackNodes.find(n=>n.type==='button'&&n.children.includes(fallbackProps.clearLabel)).props.onClick();cursor=0;fallbackNodes=walk(exports.VendorMediaPicker(fallbackProps));assert.equal(fallbackNodes.find(n=>n.type==='Image').props.src,fallbackProps.fallbackSrc);assert.equal(fallbackNodes.find(n=>n.props.name==='media_id').props.value,'');
console.log('Shared picker executed with mocks: logo/cover/product, direct Storage previews, saved-path reload, gallery thumbnails, upload error preserves existing selection; CMS return-to-default clears media reference. No production writes.');
