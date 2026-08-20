import type {ID} from './index';
export type AppRole='customer'|'vendor'|'admin'|'super_admin';
export type RestaurantMemberRole='owner'|'manager'|'staff';
export type RestaurantValidationStatus='draft'|'pending_review'|'approved'|'rejected'|'suspended';
export type SellerApplicationStatus='draft'|'submitted'|'under_review'|'approved'|'rejected'|'changes_requested';
export type RestaurantOrderStatus='pending'|'confirmed'|'preparing'|'ready'|'ready_for_pickup'|'out_for_delivery'|'delivered'|'collected'|'cancelled';
export interface Profile{id:ID;displayName?:string;phone?:string;role:AppRole}
export interface Restaurant{id:ID;name:string;slug:string;description:string;logoUrl?:string;coverUrl?:string;phone?:string;whatsapp?:string;email?:string;address?:string;commune?:string;latitude?:number;longitude?:number;mapsUrl?:string;timezone:string;averagePrepMinutes:number;deliveryAvailable:boolean;pickupAvailable:boolean;operatingStatus:'open'|'closed'|'paused';validationStatus:RestaurantValidationStatus}
export interface RestaurantMember{restaurantId:ID;userId:ID;role:RestaurantMemberRole}
export interface CuisineType{id:ID;name:string;slug:string;isActive:boolean;sortOrder:number}
export interface SellerApplication{id:ID;userId:ID;restaurantName:string;description:string;phone:string;address?:string;commune?:string;status:SellerApplicationStatus;adminNotes?:string}
export interface MarketplaceMedia{id:ID;path:string;publicUrl:string;fileName:string;altText:string;restaurantId?:ID;ownerUserId?:ID;type:'logo'|'cover'|'product'|'category'|'editorial'|'document'|'other'}
export interface RestaurantOrder{id:ID;orderId:ID;restaurantId:ID;subtotal:number;deliveryFee:number;status:RestaurantOrderStatus;prepMinutes?:number}
export interface HomepageSection{id:ID;sectionKey:string;title?:string;subtitle?:string;body?:string;imageUrl?:string;productId?:ID;sortOrder:number;isVisible:boolean}
export interface DashboardSummary{ordersToday:number;revenueToday:number;pendingOrders:number;unavailableProducts:number}
