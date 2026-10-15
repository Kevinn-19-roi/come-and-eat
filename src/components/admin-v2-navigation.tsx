'use client';
import Link from 'next/link';
import {v2Modules} from '@/lib/v2-modules';
export function AdminV2Navigation({permissions}:{permissions:string[]}){return <nav className="admin-v2-links" aria-label="Nouveaux services">{v2Modules.filter(m=>permissions.includes(m.permission)).map(m=><Link key={m.href} href={m.href}>{m.label}</Link>)}</nav>}
