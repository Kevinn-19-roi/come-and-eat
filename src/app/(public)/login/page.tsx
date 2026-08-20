import { redirect } from 'next/navigation';
import { getPublicUser } from '@/lib/auth/public-user';
import { PublicAuthForm } from '@/components/public-auth-form';

export const metadata = { title: 'Connexion' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next = '' }, user] = await Promise.all([searchParams, getPublicUser()]);
  if (user) redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/account');
  return <section className="public-auth-page"><div className="public-auth-card"><p className="section-kicker">Bienvenue</p><h1>Heureux de vous revoir.</h1><p>Connectez-vous pour retrouver votre espace Come & Eat.</p><PublicAuthForm mode="login" next={next} /></div></section>;
}
