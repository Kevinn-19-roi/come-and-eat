import {categories,deliveryZones,media,optionGroups,orders,products,siteSettings} from '@/data/mock-data';
import type {Category,DeliveryZone,Media,Order,Product,ProductOptionGroup,SiteSettings} from '@/types';
import {createMarketplaceRepositories} from './marketplace-repositories';import {productMutations,optionMutations,orderMutations,sellerApplicationMutations,userMutations} from './marketplace-mutations';
export {productMutations,optionMutations,orderMutations,sellerApplicationMutations,userMutations};
export interface CatalogRepository{getProducts():Promise<Product[]>;getProductBySlug(slug:string):Promise<Product|undefined>;getCategories():Promise<Category[]>;getOptionGroups(productId?:string):Promise<ProductOptionGroup[]>}
export interface OrderRepository{getOrders():Promise<Order[]>;getByReference(reference:string):Promise<Order|undefined>}
export interface MediaRepository{getMedia():Promise<Media[]>}
export interface SettingsRepository{getSettings():Promise<SiteSettings>;getDeliveryZones():Promise<DeliveryZone[]>}
export const localCatalogRepository:CatalogRepository={async getProducts(){return products},async getProductBySlug(slug){return products.find(product=>product.slug===slug)},async getCategories(){return categories},async getOptionGroups(){return optionGroups}};
export const localOrderRepository:OrderRepository={async getOrders(){return orders},async getByReference(reference){return orders.find(order=>order.reference===reference)}};
export const localMediaRepository:MediaRepository={async getMedia(){return media}};
export const localSettingsRepository:SettingsRepository={async getSettings(){return siteSettings},async getDeliveryZones(){return deliveryZones}};
export const marketplaceRepositories=createMarketplaceRepositories({products:()=>localCatalogRepository.getProducts(),productBySlug:slug=>localCatalogRepository.getProductBySlug(slug),categories:()=>localCatalogRepository.getCategories(),groups:()=>localCatalogRepository.getOptionGroups(),orders:()=>localOrderRepository.getOrders(),orderByReference:reference=>localOrderRepository.getByReference(reference),media:()=>localMediaRepository.getMedia(),settings:()=>localSettingsRepository.getSettings(),zones:()=>localSettingsRepository.getDeliveryZones()});
export const catalogRepository:CatalogRepository={getProducts:()=>marketplaceRepositories.productRepository.listPublic(),getProductBySlug:slug=>marketplaceRepositories.productRepository.getBySlug(slug),getCategories:()=>marketplaceRepositories.categoryRepository.listPublic(),getOptionGroups:productId=>productId?marketplaceRepositories.optionRepository.listForProduct(productId):localCatalogRepository.getOptionGroups()};
export const orderRepository:OrderRepository={getOrders:()=>marketplaceRepositories.orderRepository.list(),getByReference:reference=>marketplaceRepositories.orderRepository.getByReference(reference)};
export const marketplaceOrderRepository={...marketplaceRepositories.orderRepository,...orderMutations};
export const mediaRepository:MediaRepository={getMedia:()=>marketplaceRepositories.mediaRepository.list()};
export const settingsRepository:SettingsRepository={getSettings:()=>marketplaceRepositories.settingsRepository.get() as Promise<SiteSettings>,getDeliveryZones:()=>marketplaceRepositories.settingsRepository.getDeliveryZones()};
export const restaurantRepository=marketplaceRepositories.restaurantRepository;
export const categoryRepository=marketplaceRepositories.categoryRepository;
export const productRepository={...marketplaceRepositories.productRepository,...productMutations};
export const optionRepository={...marketplaceRepositories.optionRepository,...optionMutations};
export const userRepository={...marketplaceRepositories.userRepository,...userMutations};
export const sellerApplicationRepository={...marketplaceRepositories.sellerApplicationRepository,...sellerApplicationMutations};
export const promotionRepository=marketplaceRepositories.promotionRepository;
