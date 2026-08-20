'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from './cart-provider';

const nav = [
  { href:'/', label:'Accueil', icon:'⌂' },
  { href:'/menu', label:'Menu & Carte', icon:'⚔' },
  { href:'/cart', label:'Commander & Panier', icon:'▣' },
  { href:'/contact', label:'Contact & Zones', icon:'◉' },
];

export function PublicHeader(){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();
  const {count}=useCart();
  return <>
    <div className="service-bar"><div className="store-container"><span>● Livraison express à Abidjan · 7j/7</span><span className="service-meta">☎ +225 07 48 99 22 11 <i>•</i> 🎁 Fidélité : 1 250 pts</span></div></div>
    <header className="site-header"><div className="store-container nav-wrap">
      <Link href="/" className="store-logo" aria-label="Come & Eat — accueil"><span className="logo-mark">🍲</span><span><b><em>COME</em> & <strong>EAT</strong></b><small>— LE GOÛT QUI PARLE —</small></span></Link>
      <button className="mobile-menu" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="public-navigation"><span aria-hidden>{open?'×':'☰'}</span><span className="sr-only">Menu</span></button>
      <nav id="public-navigation" className={open?'nav-links open':'nav-links'} onClick={()=>setOpen(false)}>{nav.map(item=><Link key={item.href} href={item.href} className={pathname===item.href?'active':''}><span aria-hidden>{item.icon}</span>{item.label}</Link>)}</nav>
      <Link href="/cart" className="cart-link"><span aria-hidden>▣</span><span>Mon panier</span>{count>0?<b>{count}</b>:null}</Link>
    </div></header>
  </>
}