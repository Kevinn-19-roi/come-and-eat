import { redirect } from 'next/navigation';
import { getPublicUser } from '@/lib/auth/public-user';
import { PublicAuthForm } from '@/components/public-auth-form';

export const metadata = { title: 'Créer un compte' };
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next = '' }, user] = await Promise.all([searchParams, getPublicUser()]);
  if (user) redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/account');
  return <section className="public-auth-page"><div className="public-auth-card"><p className="section-kicker">Votre espace</p><h1>Créer un compte.</h1><p>Quelques secondes suffisent pour rejoindre Come & Eat.</p><PublicAuthForm mode="signup" next={next} /></div></section>;
}
