'use client';
import {useState} from 'react';
export function UserCsvDownload({query}:{query:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){setBusy(true);setError('');let url='';try{const response=await fetch(`/admin/users/export?${query}`,{cache:'no-store'});if(!response.ok||!response.headers.get('content-type')?.includes('text/csv'))throw Error('Export indisponible');const blob=await response.blob();url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`come-and-eat-utilisateurs-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(link);link.click();link.remove();}catch{setError('L’export a échoué. Vérifiez votre connexion puis réessayez.');}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);setBusy(false);}}
 return <div><button type="button" className="btn btn-dark" disabled={busy} aria-busy={busy} onClick={download}>{busy?'Préparation du fichier…':'Exporter en CSV'}</button>{error?<p role="alert" className="form-error">{error}</p>:null}</div>;
}
