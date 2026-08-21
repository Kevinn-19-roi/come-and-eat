import {NextResponse} from 'next/server';import {requireAdmin} from '@/lib/auth/admin';import {getPendingSellerApplicationCount} from '@/services/seller-applications-admin';
export async function GET(){try{await requireAdmin();return NextResponse.json({count:await getPendingSellerApplicationCount()})}catch{return NextResponse.json({count:0},{status:401})}}
