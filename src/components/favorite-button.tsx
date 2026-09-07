'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toggleFavorite } from '@/app/(public)/favorite-actions';

export function FavoriteButton({ restaurantId, productId, initial = false }: { restaurantId?: string; productId?: string; initial?: boolean }) {
  const [active, setActive] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <button
    type="button"
    className={`favorite-button ${active ? 'active' : ''}`}
    aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    aria-pressed={active}
    disabled={pending}
    onClick={() => { const previous=active; setActive(!previous); startTransition(async () => {
      const result = await toggleFavorite({ restaurantId, productId });
      if (result.loginRequired) {
        setActive(previous);
        const next = encodeURIComponent(window.location.pathname);
        router.push(`/login?next=${next}`);
        return;
      }
      if (result.ok) setActive(result.active); else setActive(previous);
    })}}
  ><span aria-hidden>{active ? '♥' : '♡'}</span></button>;
}
