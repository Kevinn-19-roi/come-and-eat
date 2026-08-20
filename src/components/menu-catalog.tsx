'use client';
import { useMemo,useState } from 'react';
import type { Category,Product } from '@/types';
import { ProductCard } from './product-card';

export function MenuCatalog({products,categories}:{products:Product[];categories:Category[]}){
  const [active,setActive]=useState('all'); const [query,setQuery]=useState('');
  const shown=useMemo(()=>products.filter(p=>!p.archived&&(active==='all'||p.categoryId===active)&&(`${p.name} ${p.description}`).toLowerCase().includes(query.toLowerCase())),[products,active,query]);
  return <>
    <div className="catalog-tools"><label className="menu-search"><span aria-hidden>⌕</span><span className="sr-only">Rechercher un plat</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un plat, une boisson…"/></label><span className="catalog-count">{shown.length} choix</span></div>
    <div className="filters" role="tablist" aria-label="Catégories"><button role="tab" aria-selected={active==='all'} className={`pill ${active==='all'?'active':''}`} onClick={()=>setActive('all')}><span>🍽</span> Toute la carte</button>{categories.filter(c=>c.visible).map(c=><button role="tab" aria-selected={active===c.id} key={c.id} className={`pill ${active===c.id?'active':''}`} onClick={()=>setActive(c.id)}><span>{c.slug==='burgers'?'🍔':c.slug==='boissons'?'🥤':c.slug==='desserts'?'🍰':'🍟'}</span>{c.name}</button>)}</div>
    {shown.length?<div className="product-grid catalog-grid">{shown.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="empty-state"><span>⌕</span><h2>Aucun plat trouvé</h2><p>Essayez une autre recherche ou une autre catégorie.</p><button className="btn btn-dark" onClick={()=>{setQuery('');setActive('all')}}>Voir toute la carte</button></div>}
  </>
}