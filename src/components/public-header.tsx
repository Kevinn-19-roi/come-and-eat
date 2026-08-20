'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { siteConfig } from '@/config/site';
import { useCart } from './cart-provider';

const nav = [
  { href:'/', label:'Accueil' },
  { href:'/menu', label:'La carte' },
  { href:'/cart', label:'Commander' },
  { href:'/contact', label:'Contact' },
];
export function PublicHeader(){const [open,setOpen]=useState(false);const pathname=usePathname();const {count}=useCart();return <><div className="service-bar"><div className="store-container"><span>{siteConfig.announcement}</span><span className="service-meta">{siteConfig.contact.phone}<i>·</i>{siteConfig.hours}</span></div></div><header className="site-header"><div className="store-container nav-wrap"><Link href="/" className="official-logo" aria-label={`${siteConfig.brand.name} — accueil`}><Image src={siteConfig.brand.logo} alt={`${siteConfig.brand.name} — ${siteConfig.brand.tagline}`} width={170} height={92} priority/></Link><button className="mobile-menu" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="public-navigation"><span aria-hidden>{open?'×':'☰'}</span><span className="sr-only">Menu</span></button><nav id="public-navigation" className={open?'nav-links open':'nav-links'} onClick={()=>setOpen(false)}>{nav.map(item=><Link key={item.href} href={item.href} className={pathname===item.href?'active':''}>{item.label}</Link>)}</nav><Link href="/cart" className="cart-link"><span>Panier</span>{count>0?<b>{count}</b>:null}</Link></div></header></>}