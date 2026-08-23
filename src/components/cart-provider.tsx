'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem, Product, CartSelection } from '@/types';
import { uid } from '@/lib/utils';
type CartContextValue = { items:CartItem[]; count:number; subtotal:number; add:(product:Product,selections?:CartSelection[],quantity?:number)=>void; remove:(id:string)=>void; setQuantity:(id:string,quantity:number)=>void; clear:()=>void };
const CartContext = createContext<CartContextValue|null>(null);
const STORAGE_KEY='come-eat-cart-v1';
export function CartProvider({children}:{children:React.ReactNode}){
 const [items,setItems]=useState<CartItem[]>([]); const [ready,setReady]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{try { const saved=localStorage.getItem(STORAGE_KEY); if(saved)setItems(JSON.parse(saved)); } catch{} setReady(true)},0);return()=>clearTimeout(timer)},[]);
 useEffect(()=>{if(ready)localStorage.setItem(STORAGE_KEY,JSON.stringify(items))},[items,ready]);
 const value=useMemo<CartContextValue>(()=>({items,count:items.reduce((s,i)=>s+i.quantity,0),subtotal:items.reduce((s,i)=>s+(i.unitPrice+i.selections.reduce((n,o)=>n+o.price,0))*i.quantity,0),add:(p,selections=[],quantity=1)=>setItems(old=>[...old,{id:uid(),productId:p.id,restaurantId:p.restaurantId,restaurantName:p.restaurantName,restaurantSlug:p.restaurantSlug,name:p.name,unitPrice:p.price,quantity,image:p.image?.url,selections}]),remove:(id)=>setItems(old=>old.filter(i=>i.id!==id)),setQuantity:(id,quantity)=>setItems(old=>quantity<1?old.filter(i=>i.id!==id):old.map(i=>i.id===id?{...i,quantity}:i)),clear:()=>setItems([])}),[items]);
 return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export const useCart=()=>{const value=useContext(CartContext); if(!value)throw new Error('useCart hors CartProvider'); return value};
