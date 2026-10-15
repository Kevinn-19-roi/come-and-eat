import {mkdir,writeFile,access} from 'node:fs/promises';
const root='artifacts';
const before='visual-qa-before-20261014-complete',after='visual-qa';
const exists=async p=>{try{await access(p);return true}catch{return false}};
const names=[['accueil','Accueil'],['restaurants','Restaurants'],['restaurant-public','Restaurant'],['produit','Produit'],['panier','Panier'],['checkout','Checkout']];
const sections=[];
for(const width of ['375','1440'])for(const [name,label] of names){
 const cells=[];
 for(const [folder,title] of [[before,'Avant'],[after,'Après']]){
  const file=`${folder}/${name}-${width}.png`;
  cells.push(`<article><h3>${title}</h3>${await exists(`${root}/${file}`)?`<a href="${file}"><img loading="lazy" src="${file}" alt="${label} ${title} ${width} pixels"></a>`:'<p>Capture non disponible. Aucun avant reconstitué artificiellement.</p>'}</article>`);
 }
 sections.push(`<section><h2>${label} — ${width==='375'?'Mobile 375 px':'Desktop 1440 px'}</h2><div class="pair">${cells.join('')}</div></section>`);
}
await mkdir(root,{recursive:true});
await writeFile(`${root}/comparaison-design.html`,`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Come & Eat — comparaison locale</title><style>body{font:16px system-ui;background:#f6f5ef;color:#123b2e;margin:0;padding:32px}main{max-width:1400px;margin:auto}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:white;padding:16px;border-radius:16px;min-width:0}img{width:100%;height:auto}section{margin:50px 0}@media(max-width:650px){.pair{grid-template-columns:1fr}}</style><main><h1>Come & Eat — avant / après</h1><p>Captures locales. Cliquez une image pour la consulter en taille réelle. Les captures absentes sont signalées explicitement.</p>${sections.join('')}</main></html>`);
console.log('Comparaison: artifacts/comparaison-design.html');
