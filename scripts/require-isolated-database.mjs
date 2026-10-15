import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const target=process.env.NEXT_PUBLIC_SUPABASE_URL;
let host='';try{host=new URL(target).hostname}catch{/* Fail closed. */}
if(!['localhost','127.0.0.1','::1','[::1]'].includes(host)){
 throw new Error('TEST_DISTANT_BLOQUE: cette suite écrit dans Supabase. Utilisez une base locale isolée. Aucun accès distant implicite n’est autorisé.');
}
