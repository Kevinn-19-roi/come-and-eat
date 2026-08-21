import {VendorShell} from '@/components/vendor-shell';import {requireVendor} from '@/lib/auth/vendor';
export const metadata={title:'Espace vendeur | Come & Eat',robots:{index:false,follow:false}};
export default async function VendorPanelLayout({children}:{children:React.ReactNode}){const context=await requireVendor();return <VendorShell restaurants={context.restaurants} activeRestaurant={context.restaurant}>{children}</VendorShell>}
