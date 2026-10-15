import ExcelJS from 'exceljs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import {collectUserExport,usersCsv,userRoleLabels,type UserExportRow} from '@/lib/user-export';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  await requireAdmin();
  const db = await createClient();
  const search = request.nextUrl.searchParams.get('q')?.trim() || null;
  if(search&&search.length>120)return NextResponse.json({error:'Recherche trop longue.'},{status:400});
  const format=request.nextUrl.searchParams.get('format')??'xlsx';
  if(!['csv','xlsx'].includes(format))return NextResponse.json({error:'Format non pris en charge.'},{status:400});
  const users=await collectUserExport(async(offset,limit)=>{
    const {data,error}=await db.rpc('admin_export_users',{search_text:search,result_limit:limit,result_offset:offset});
    if(error)throw new Error('USER_EXPORT_UNAVAILABLE');
    return (data??[]) as UserExportRow[];
  });
  if(format==='csv')return new NextResponse(usersCsv(users),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="utilisateurs-come-and-eat.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Come & Eat';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Utilisateurs', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Nom et prénom', key: 'name', width: 30 }, { header: 'Email', key: 'email', width: 34 },
    { header: 'Téléphone', key: 'phone', width: 22 }, { header: 'Rôle', key: 'role', width: 22 },
    { header: 'Statut', key: 'status', width: 14 }, { header: 'Date d’inscription', key: 'createdAt', width: 22 },
    { header: 'Dernière activité', key: 'lastActivity', width: 22 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B513C' } };
  users.forEach(user => sheet.addRow({ name: user.display_name || '', email: user.email || '', phone: user.phone || '', role: userRoleLabels[user.role || ''] || 'Client', status: '', createdAt: user.created_at ? new Date(user.created_at) : '', lastActivity: user.last_sign_in_at ? new Date(user.last_sign_in_at) : '' }));
  sheet.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.getColumn('lastActivity').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.autoFilter = { from: 'A1', to: 'G1' };
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="utilisateurs-come-and-eat-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Cache-Control': 'private, no-store' } });
}
