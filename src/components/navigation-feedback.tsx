'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function NavigationFeedback() {
  const pathname = usePathname();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const pending = targetPath !== null && targetPath !== pathname;
  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.href !== window.location.href) setTargetPath(destination.pathname);
    };
    document.addEventListener('click', start, true);
    return () => document.removeEventListener('click', start, true);
  }, []);
  return <div className={`navigation-progress ${pending ? 'active' : ''}`} role="progressbar" aria-label="Navigation en cours" aria-hidden={!pending}><span /></div>;
}
