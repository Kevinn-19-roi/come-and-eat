export type UserExportRow={display_name?:string|null;email?:string|null;phone?:string|null;role?:string|null;created_at?:string|null;last_sign_in_at?:string|null};
export const userRoleLabels:Record<string,string>={customer:'Client',vendor:'Vendeur',admin:'Administrateur',super_admin:'Super administrateur'};
export const userExportHeaders=['Nom et prénom','Email','Téléphone','Rôle','Statut','Date d’inscription','Dernière activité'];
export function csvCell(value:unknown){
 let text=value==null?'':String(value);
 text=text.replaceAll('\u0000','');
 if(/^[\s\u0001-\u001f]*[=+@-]/u.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function usersCsv(rows:UserExportRow[]){
 const lines=[userExportHeaders,...rows.map(row=>[row.display_name??'',row.email??'',row.phone??'',userRoleLabels[row.role??'']??'Non renseigné','',row.created_at??'',row.last_sign_in_at??''])];
 return '\ufeff'+lines.map(line=>line.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
/** No silent truncation: stop on a short page or report the safety limit. */
export async function collectUserExport(fetchPage:(offset:number,limit:number)=>Promise<UserExportRow[]>){
 const result:UserExportRow[]=[];
 for(let offset=0;offset<=100_000;offset+=100){
  const page=await fetchPage(offset,100);
  if(offset===100_000&&page.length)throw new Error('EXPORT_TOO_LARGE');
  result.push(...page);
  if(page.length<100)return result;
 }
 throw new Error('EXPORT_TOO_LARGE');
}
