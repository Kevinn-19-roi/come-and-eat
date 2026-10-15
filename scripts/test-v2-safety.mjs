import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
const run=url=>spawnSync(process.execPath,['scripts/require-isolated-database.mjs'],{encoding:'utf8',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:url}});
for(const url of ['https://example.invalid','https://localhost.example.invalid','https://localhost@example.invalid']){
 const result=run(url);assert.notEqual(result.status,0);assert.match(result.stderr,/TEST_DISTANT_BLOQUE/);
}
for(const url of ['http://localhost:54321','http://127.0.0.1:54321'])assert.equal(run(url).status,0);
for(const file of ['test-admin-management.mjs','test-email-idempotency-live.mjs','test-final-operations-live.mjs','test-members-and-order-transitions.mjs','test-qa-regressions.mjs','test-seller-application-review.mjs','test-sprint-6-1-live.mjs','test-vendor-rls.mjs']){
 assert.ok((await readFile(`scripts/${file}`,'utf8')).startsWith("import './require-isolated-database.mjs';"),`${file}: garde-fou en premier import`);
}
let clientCount=0;
async function inspectClients(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=`${directory}/${entry.name}`;
  if(entry.isDirectory()){await inspectClients(file);continue;}
  if(!/\.[jt]sx?$/.test(file))continue;
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/NEXT_PUBLIC_\w*(?:SERVICE_ROLE|SECRET_KEY)/,`${file}: secret dans un nom public`);
  if(!/^\s*['"]use client['"];?/m.test(source))continue;
  clientCount++;
  assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|createAdminClient|from\s+['"]@\/lib\/supabase\/admin['"]/,`${file}: accès serveur dans un composant client`);
 }
}
await inspectClients('src');
console.log(`Garde-fou testé: destinations distantes et faux localhost refusés, localhost accepté, huit suites protégées, ${clientCount} modules client sans import admin ou clé serveur directe. Analyse statique, aucune connexion Supabase effectuée.`);
