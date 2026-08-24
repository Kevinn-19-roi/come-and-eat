import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:'*',allow:'/',disallow:['/admin/','/vendor/','/account/','/cart/','/checkout/','/favorites/','/login','/signup','/order/','/search']},sitemap:'https://come-and-eat.vercel.app/sitemap.xml'}}
