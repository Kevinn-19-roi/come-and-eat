import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{const base='https://come-and-eat.vercel.app';return['','/menu','/about','/contact','/login','/signup'].map(path=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path===''?'daily':'weekly',priority:path===''?1:path==='/menu'?.9:.6}))}
