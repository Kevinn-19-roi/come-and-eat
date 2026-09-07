'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast-provider';

export function ShareButton({ title, text, path, className = 'share-button' }: { title: string; text: string; path: string; className?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function share() {
    if (busy) return;
    setBusy(true);
    const url = new URL(path, 'https://comeandeat.org').toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Lien du restaurant copié'.replace('restaurant', path.startsWith('/menu/') ? 'produit' : 'restaurant'));
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url);
          toast('Lien copié');
        } catch {
          toast('Le lien n’a pas pu être copié');
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return <button type="button" className={className} onClick={share} disabled={busy} aria-busy={busy} aria-label={`Partager ${title}`}><span aria-hidden>↗</span>{busy ? 'Partage…' : 'Partager'}</button>;
}
