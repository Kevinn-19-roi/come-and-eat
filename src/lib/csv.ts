export function csvCell(value:unknown){const text=String(value??'').replace(/\r?\n/g,' ');return `"${text.replace(/"/g,'""')}"`}
export function createCsv(headers:string[],rows:unknown[][]){return `\uFEFF${[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')}`}
export function csvResponse(content:string,fileName:string){return new Response(content,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${fileName}"`,'Cache-Control':'no-store'}})}
