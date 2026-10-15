export function csvCell(value:unknown){const raw=String(value??'').replace(/\r?\n/g,' ');const text=/^[\s\u0000-\u001f]*[=+\-@]/.test(raw)?`'${raw}`:raw;return `"${text.replace(/"/g,'""')}"`}
export function createCsv(headers:string[],rows:unknown[][]){return `\uFEFF${[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')}`}
export function csvResponse(content:string,fileName:string){return new Response(content,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${fileName}"`,'Cache-Control':'no-store'}})}
