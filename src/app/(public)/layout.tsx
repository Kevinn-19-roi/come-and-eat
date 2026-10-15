import { PublicHeader } from '@/components/public-header';import { PublicFooter } from '@/components/public-footer';import {getPublicUser} from '@/lib/auth/public-user';
import {MobileCartBar} from '@/components/mobile-cart-bar';
export default async function PublicLayout({children}:{children:React.ReactNode}){const user=await getPublicUser();return <div className="storefront"><PublicHeader user={user}/><main>{children}</main><PublicFooter/><MobileCartBar/></div>}
