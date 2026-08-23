import Image from 'next/image';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { RestaurantCard } from '@/components/restaurant-card';
import { siteConfig } from '@/config/site';
import { getAlreadyOrderedProducts, getFavoriteIds } from '@/services/public-marketplace';
import { catalogRepository, marketplaceRepositories } from '@/services/repositories';

const fallbackImages = ['/images/burger.svg', '/images/alloco.svg', '/images/bissap.svg'];

export default async function Home() {
  const [products, categories, restaurants, promotions, cuisines, sections, favorites, reordered] = await Promise.all([
    marketplaceRepositories.productRepository.listFeatured(8), catalogRepository.getCategories(),
    marketplaceRepositories.restaurantRepository.listPublic(), marketplaceRepositories.promotionRepository.listPublic(),
    marketplaceRepositories.cuisineTypeRepository.list(), marketplaceRepositories.settingsRepository.getHomepageSections().catch(() => []),
    getFavoriteIds(), getAlreadyOrderedProducts(),
  ]);
  const concept = sections.find(section => section.sectionKey === 'concept');
  const finalCta = sections.find(section => section.sectionKey === 'final_cta');
  const featured = products.find(product => product.image) ?? products[0];
  const home = siteConfig.homepage;
  return <>
    <section className="marketplace-hero"><div className="store-container marketplace-hero-grid">
      <div className="marketplace-hero-copy"><p className="section-kicker">{siteConfig.hero.eyebrow}</p><h1>{siteConfig.hero.title}</h1><p>{siteConfig.hero.body}</p>
        <form className="hero-search" action="/search"><label><span className="sr-only">Rechercher</span><input name="q" placeholder="Un plat, un restaurant, une cuisine…" /></label><button>Rechercher</button></form>
        <div className="hero-actions"><Link href="/restaurants" className="btn btn-orange">Découvrir les restaurants <span aria-hidden>→</span></Link><Link href="/menu" className="btn btn-ghost">Voir tous les plats</Link></div>
        <div className="hero-proof"><span>{siteConfig.delivery.promise}</span><span>Livraison ou retrait</span></div>
      </div>
      <div className="marketplace-hero-visual">{featured ? <Link href={`/menu/${featured.slug}`}><span className="hero-food-frame">{featured.image ? <Image src={featured.image.url} alt={featured.name} fill priority sizes="(max-width: 800px) 94vw, 44vw" /> : <Image src={siteConfig.hero.featuredProduct.image} alt={featured.name} fill priority sizes="(max-width: 800px) 94vw, 44vw" />}</span><span className="hero-food-label"><small>À découvrir</small><strong>{featured.name}</strong><span>{featured.restaurantName ?? siteConfig.brand.name}</span></span></Link> : null}</div>
    </div></section>

    <section className="section marketplace-categories"><div className="store-container"><div className="section-head"><div><p className="section-kicker">Explorer</p><h2>Qu’est-ce qui vous ferait plaisir ?</h2></div><Link href="/menu" className="quiet-link">Toute la carte <span>→</span></Link></div><div className="category-rail">{categories.filter(item => item.visible).slice(0, 10).map((category, index) => <Link href={`/menu?category=${category.slug}`} key={category.id} className="market-category"><span>{category.image?.url ? <Image src={category.image.url} alt="" fill sizes="120px" /> : <Image src={fallbackImages[index % fallbackImages.length]} alt="" fill sizes="120px" />}</span><strong>{category.name}</strong></Link>)}</div></div></section>

    <section className="section restaurant-discovery"><div className="store-container"><div className="section-head"><div><p className="section-kicker">Restaurants</p><h2>Les tables de Come & Eat</h2><p>Découvrez les restaurants disponibles sur la plateforme.</p></div><Link href="/restaurants" className="quiet-link">Voir tous <span>→</span></Link></div>{restaurants.length ? <div className="restaurant-grid">{restaurants.slice(0, 6).map(restaurant => <RestaurantCard key={restaurant.id} restaurant={restaurant} favorite={favorites.restaurantIds.has(restaurant.id)} />)}</div> : <div className="empty-state"><h3>Les restaurants arrivent bientôt</h3><p>La sélection est en cours de préparation.</p></div>}</div></section>

    {promotions.length ? <section className="promotion-strip"><div className="store-container"><div><p className="section-kicker">Bons plans du moment</p><h2>Les offres actives</h2></div><div className="promotion-list-public">{promotions.slice(0, 4).map(item => <Link key={item.id} href={item.restaurantSlug ? `/restaurants/${item.restaurantSlug}` : '/menu'}><strong>{item.name}</strong><span>{item.discountType === 'percent' ? `−${item.value} %` : `−${new Intl.NumberFormat('fr-FR').format(item.value)} FCFA`}</span><small>{item.restaurantName ?? item.productName ?? 'Offre Come & Eat'}{item.code ? ` · Code ${item.code}` : ''}</small></Link>)}</div></div></section> : null}

    <section className="section popular-section"><div className="store-container"><div className="section-head"><div><p className="section-kicker">Les plus demandés</p><h2>À commander aujourd’hui</h2></div><Link href="/menu" className="quiet-link">Voir tous les plats <span>→</span></Link></div><div className="product-grid home-products">{products.map(product => <ProductCard key={product.id} product={product} featured favorite={favorites.productIds.has(product.id)} />)}</div></div></section>
    {reordered.length ? <section className="section reordered-section"><div className="store-container"><div className="section-head"><div><p className="section-kicker">Vos habitudes</p><h2>Déjà commandé</h2></div></div><div className="product-grid">{reordered.map(product => <ProductCard key={product.id} product={product} favorite={favorites.productIds.has(product.id)} />)}</div></div></section> : null}

    <section className="cuisine-band"><div className="store-container"><p className="section-kicker">Toutes les envies</p><h2>Explorer par cuisine</h2><div className="cuisine-links">{cuisines.slice(0, 12).map(cuisine => <Link href={`/restaurants?cuisine=${cuisine.slug}`} key={cuisine.id}>{cuisine.name}</Link>)}</div></div></section>
    <section className="concept section"><div className="store-container concept-stage"><div className="concept-visual"><Image src={concept?.imageUrl ?? '/images/alloco.svg'} alt="Cuisine Come & Eat" fill sizes="(max-width: 800px) 92vw, 42vw" /><span>Préparé à Abidjan</span></div><div className="concept-content"><p className="section-kicker">{concept?.subtitle ?? home.conceptEyebrow}</p><h2>{concept?.title ?? home.conceptTitle}</h2><p className="concept-intro">{concept?.body ?? home.conceptIntro}</p><div className="editorial-values">{home.values.map(value => <article key={value.number}><span>{value.number}</span><div><h3>{value.title}</h3><p>{value.body}</p></div></article>)}</div></div></div></section>
    <section className="seller-cta"><div className="store-container"><div><p className="section-kicker">Restaurateurs</p><h2>Votre cuisine mérite d’être découverte.</h2><p>Rejoignez Come & Eat et gérez votre carte, vos commandes et vos horaires simplement.</p></div><Link href="/vendor/application" className="btn btn-orange">Devenir vendeur</Link></div></section>
    <section className="cta-section"><div className="store-container"><div><p className="section-kicker">{finalCta?.subtitle ?? 'À table'}</p><h2>{finalCta?.title ?? home.finalCta.title}</h2><p>{finalCta?.body ?? home.finalCta.body}</p><div><Link className="btn btn-orange" href="/restaurants">Choisir un restaurant <span aria-hidden>→</span></Link><Link className="btn btn-ghost" href="/contact">Nous contacter</Link></div></div></div></section>
  </>;
}
