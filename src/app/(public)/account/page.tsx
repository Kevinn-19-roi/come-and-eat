import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPublicUser } from '@/lib/auth/public-user';
import { publicLogout } from '../auth-actions';

export const metadata = { title: 'Mon compte', robots: { index: false, follow: false } };
export default async function AccountPage() {
  const user = await getPublicUser();
  if (!user) redirect('/login?next=/account');
  const admin = user.role === 'admin' || user.role === 'super_admin';
  return <section className="account-page store-container"><div className="account-card"><p className="section-kicker">Mon compte</p><h1>Bonjour{user.displayName ? ` ${user.displayName}` : ''}.</h1><p>{user.email}</p><div className="account-actions">{admin ? <Link className="btn btn-dark" href="/admin">Panel admin</Link> : null}{user.hasRestaurant ? <Link className="btn btn-outline" href="/vendor">Mon restaurant</Link> : <Link className="btn btn-outline" href="/vendor/application">Devenir vendeur</Link>}<form action={publicLogout}><button className="btn btn-outline">Déconnexion</button></form></div></div></section>;
}
