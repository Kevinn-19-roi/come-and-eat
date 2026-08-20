'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
const ToastContext=createContext<(message:string)=>void>(()=>{});
export function ToastProvider({children}:{children:React.ReactNode}){const [message,setMessage]=useState('');const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);const toast=useCallback((text:string)=>{setMessage(text);if(timeout.current)clearTimeout(timeout.current);timeout.current=setTimeout(()=>setMessage(''),2800)},[]);useEffect(()=>()=>{if(timeout.current)clearTimeout(timeout.current)},[]);return <ToastContext.Provider value={toast}>{children}{message?<div className="toast" role="status">✓ {message}</div>:null}</ToastContext.Provider>}
export const useToast=()=>useContext(ToastContext);
