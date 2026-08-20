'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { chooseRestaurant, vendorLogout } from '@/app/vendor/actions';
import type { VendorRestaurant } from '@/lib/auth/vendor';

const links = [
  ['/vendor', '▦', 'Tableau de bord'], ['/vendor/orders', '◴', 'Commandes'],
  ['/vendor/products', '□', 'Produits'], ['/vendor/restaurant', '⌂', 'Mon restaurant'],
  ['/vendor/media', '▧', 'Photos'], ['/vendor/hours', '◷', 'Horaires'],
  ['/vendor/promotions', '%', 'Promotions'],
] as const;

export function VendorShell({ children, restaurants, activeRestaurant }: { children: React.ReactNode; restaurants: VendorRestaurant[]; activeRestaurant?: VendorRestaurant }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === '/vendor/login' || path === '/vendor/application') return <>{children}</>;
  const visibleLinks = activeRestaurant?.role === 'staff' ? links.slice(0, 2) : links;

  return <div className="vendor-app">
    <aside className={open ? 'vendor-sidebar open' : 'vendor-sidebar'}>
      <Link href="/vendor" className="vendor-brand"><strong>Come & Eat</strong><small>Espace restaurant</small></Link>
      {restaurants.length > 1 ? <form action={chooseRestaurant} className="vendor-switcher">
        <label htmlFor="active-restaurant">Restaurant actif</label>
        <select id="active-restaurant" name="restaurant" defaultValue={activeRestaurant?.id} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {restaurants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </form> : activeRestaurant ? <div className="vendor-current"><small>Mon restaurant</small><strong>{activeRestaurant.name}</strong></div> : null}
      <nav>{visibleLinks.map(([href, icon, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href || (href !== '/vendor' && path.startsWith(`${href}/`)) ? 'active' : ''}><i>{icon}</i>{label}</Link>)}</nav>
      <Link href="/" className="back-site">← Voir le site public</Link>
    </aside>
    {open ? <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fermer le menu" /> : null}
    <div className="vendor-main">
      <header className="vendor-top">
        <button className="admin-menu-btn" onClick={() => setOpen(true)} aria-label="Ouvrir la navigation">☰</button>
        <div><strong>{activeRestaurant?.name ?? 'Espace vendeur'}</strong><span>{activeRestaurant?.role === 'owner' ? 'Propriétaire' : activeRestaurant?.role === 'manager' ? 'Responsable' : 'Équipe commandes'}</span></div>
        <form action={vendorLogout} className="admin-logout"><button type="submit">Déconnexion</button></form>
      </header>
      <main className="vendor-content">
        {activeRestaurant?.validationStatus === 'suspended' ? <div className="vendor-alert danger">Ce restaurant est suspendu. Contactez Come & Eat pour obtenir de l’aide.</div> : null}
        {children}
      </main>
    </div>
  </div>;
}
