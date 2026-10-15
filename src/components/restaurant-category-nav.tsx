'use client';
import {useEffect,useRef,useState} from 'react';

export function RestaurantCategoryNav({categories}:{categories:readonly (readonly [string,string])[]}){
 const [active,setActive]=useState(categories[0]?.[0]??'');const nav=useRef<HTMLElement>(null);
 useEffect(()=>{
  const elements=categories.flatMap(([id])=>{const el=document.getElementById(`category-${id}`);return el?[el]:[];});
  if(!elements.length)return;
  const visible=new Map<string,number>();
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){if(entry.isIntersecting)visible.set(entry.target.id,entry.boundingClientRect.top);else visible.delete(entry.target.id);}
   const first=[...visible.entries()].sort((a,b)=>a[1]-b[1])[0];if(first)setActive(first[0].slice('category-'.length));
  },{rootMargin:'-100px 0px -55% 0px'});
  elements.forEach(el=>observer.observe(el));return()=>observer.disconnect();
 },[categories]);
 useEffect(()=>{
  const container=nav.current;const selected=container?.querySelector<HTMLElement>('[aria-current="location"]');
  if(container&&selected)container.scrollTo({left:Math.max(0,selected.offsetLeft-container.offsetLeft-container.clientWidth/2+selected.clientWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 },[active]);
 return <nav ref={nav} className="restaurant-menu-nav" aria-label="Catégories de la carte"><strong>La carte</strong>{categories.map(([id,name])=><a key={id} href={`#category-${id}`} onClick={()=>setActive(id)} aria-current={active===id?'location':undefined} className={active===id?'active':''}>{name}</a>)}</nav>;
}
