'use client';
import {useEffect,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function ConversationRefresh(){
 const router=useRouter();const [pending,startTransition]=useTransition();
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!document.activeElement?.matches('textarea,input,select'))router.refresh();},30000);return()=>clearInterval(timer);},[router]);
 return <button className="btn btn-outline" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Actualisation…':'Actualiser les messages'}</button>;
}
