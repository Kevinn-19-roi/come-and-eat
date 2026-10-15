import {redirect} from 'next/navigation';
import {requireVendor} from '@/lib/auth/vendor';
import {ConversationInbox} from '@/components/conversation-inbox';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;status?:string;before_time?:string;before_id?:string}>}){const query=await searchParams;const context=await requireVendor();if(!context.canManage)redirect('/vendor/orders');return <><h1>Messages de mon restaurant</h1><p>Conversations adressées à {context.restaurant!.name}.</p><ConversationInbox restaurantId={context.restaurant!.id} search={query.q} status={query.status} beforeTime={query.before_time} beforeId={query.before_id}/></>;}
