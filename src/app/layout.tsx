import type { Metadata } from 'next';import { CartProvider } from '@/components/cart-provider';import { ToastProvider } from '@/components/toast-provider';import './globals.css';
export const metadata:Metadata={title:{default:'Come & Eat — Savoureux, simplement',template:'%s | Come & Eat'},description:'Burgers maison, accompagnements et boissons fraîches à Abidjan.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><ToastProvider><CartProvider>{children}</CartProvider></ToastProvider></body></html>}
