import type { Metadata } from 'next';
import { MenuCatalog } from '@/components/menu-catalog';
import {catalogRepository} from '@/services/repositories';
import {getFavoriteIds} from '@/services/public-marketplace';
export const metadata:Metadata={title:'Menu & Carte'};
export default async function MenuPage({searchParams}:{searchParams:Promise<{category?:string}>}){const[products,categories,params,favorites]=await Promise.all([catalogRepository.getProducts(),catalogRepository.getCategories(),searchParams,getFavoriteIds()]);const selected=categories.find(category=>category.slug===params.category)?.id??'all';return <><section className="menu-hero"><div className="store-container"><p className="section-kicker">Tous les restaurants</p><h1>Les plats disponibles</h1><p>Explorez la carte de la marketplace, puis personnalisez votre commande.</p><div className="menu-facts"><span>Catégories dynamiques</span><span>Livraison ou retrait</span></div></div></section><section className="section menu-section"><div className="store-container"><MenuCatalog products={products} categories={categories} initialActive={selected} favoriteIds={[...favorites.productIds]}/></div></section></>}
