import { categories, deliveryZones, media, optionGroups, orders, products, siteSettings } from '@/data/mock-data';
import type { Category, DeliveryZone, Media, Order, Product, ProductOptionGroup, SiteSettings } from '@/types';
export interface CatalogRepository { getProducts(): Promise<Product[]>; getProductBySlug(slug:string): Promise<Product|undefined>; getCategories(): Promise<Category[]>; getOptionGroups(): Promise<ProductOptionGroup[]> }
export interface OrderRepository { getOrders(): Promise<Order[]>; getByReference(reference:string): Promise<Order|undefined> }
export interface MediaRepository { getMedia(): Promise<Media[]> }
export interface SettingsRepository { getSettings(): Promise<SiteSettings>; getDeliveryZones(): Promise<DeliveryZone[]> }
export const localCatalogRepository: CatalogRepository = { async getProducts(){return products}, async getProductBySlug(slug){return products.find(p=>p.slug===slug)}, async getCategories(){return categories}, async getOptionGroups(){return optionGroups} };
export const localOrderRepository: OrderRepository = { async getOrders(){return orders}, async getByReference(reference){return orders.find(o=>o.reference===reference)} };
export const localMediaRepository: MediaRepository = { async getMedia(){return media} };
export const localSettingsRepository: SettingsRepository = { async getSettings(){return siteSettings}, async getDeliveryZones(){return deliveryZones} };
