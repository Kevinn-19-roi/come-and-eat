export type ID = string;
export interface Media { id: ID; name: string; url: string; alt: string; createdAt: string }
export interface Category { id: ID; name: string; slug: string; image?: Media; visible: boolean; order: number }
export interface ProductOption { id: ID; name: string; price: number; available: boolean }
export interface ProductOptionGroup { id: ID; name: string; required: boolean; multiple: boolean; minChoices?: number; maxChoices?: number; options: ProductOption[] }
export interface Product { id: ID; restaurantId?: ID; restaurantName?: string; restaurantSlug?: string; restaurantCanOrder?: boolean; sku: string; name: string; slug: string; categoryId: ID; categoryName?: string; price: number; description: string; image?: Media; available: boolean; isFeatured?: boolean; optionGroupIds: ID[]; archived?: boolean; moderationStatus?: 'pending'|'approved'|'flagged'|'hidden'; hiddenByAdmin?: boolean }
export interface CartSelection { groupId: ID; optionId: ID; name: string; price: number }
export interface CartItem { id: ID; productId: ID; restaurantId?: ID; restaurantName?: string; restaurantSlug?: string; restaurantCanOrder?: boolean; name: string; unitPrice: number; quantity: number; image?: string; selections: CartSelection[] }
export interface Cart { items: CartItem[]; subtotal: number; deliveryFee: number; total: number }
export interface Customer { name: string; phone: string; email?: string }
export type OrderStatus = 'new'|'confirmed'|'preparing'|'ready'|'delivering'|'delivered'|'cancelled';
export interface OrderItem { id: ID; productName: string; quantity: number; unitPrice: number; options: string[] }
export interface Order { id: ID; reference: string; customer: Customer; items: OrderItem[]; total: number; fulfillment: 'delivery'|'pickup'; address?: string; zone?: string; paymentMethod: string; note?: string; status: OrderStatus; createdAt: string }
export interface DeliveryZone { id: ID; name: string; fee: number; active: boolean }
export interface Promotion { id: ID; name: string; code?: string; type: 'percent'|'fixed'; value: number; active: boolean }
export interface SiteSettings { restaurantName: string; phone: string; email: string; address: string; currency: 'XOF'; deliveryEnabled: boolean; pickupEnabled: boolean }
