import type { Metadata } from 'next';
import { CartProvider } from '@/components/cart-provider';
import { ToastProvider } from '@/components/toast-provider';
import { siteConfig } from '@/config/site';
import './globals.css';
import './marketplace.css';
export const metadata:Metadata={metadataBase:new URL('https://come-and-eat.vercel.app'),applicationName:siteConfig.brand.name,title:{default:`${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,template:`%s | ${siteConfig.brand.name}`},description:siteConfig.brand.description,openGraph:{type:'website',locale:'fr_CI',siteName:siteConfig.brand.name,title:`${siteConfig.brand.name} — ${siteConfig.brand.tagline}`,description:siteConfig.brand.description,images:['/opengraph-image.jpg']},icons:{icon:'/icon.png',apple:'/apple-icon.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><ToastProvider><CartProvider>{children}</CartProvider></ToastProvider></body></html>}
