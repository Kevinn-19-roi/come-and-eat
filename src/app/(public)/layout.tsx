import { PublicHeader } from '@/components/public-header';import { PublicFooter } from '@/components/public-footer';import {getPublicUser} from '@/lib/auth/public-user';
export default async function PublicLayout({children}:{children:React.ReactNode}){const user=await getPublicUser();return <><PublicHeader user={user}/><main>{children}</main><PublicFooter/></>}
