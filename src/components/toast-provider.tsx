'use client';
import { createContext, useContext, useState } from 'react';
const ToastContext=createContext<(message:string)=>void>(()=>{});
export function ToastProvider({children}:{children:React.ReactNode}){const [message,setMessage]=useState(''); const toast=(text:string)=>{setMessage(text);setTimeout(()=>setMessage(''),2800)};return <ToastContext.Provider value={toast}>{children}{message&&<div className="toast" role="status">✓ {message}</div>}</ToastContext.Provider>}
export const useToast=()=>useContext(ToastContext);
