import assert from 'node:assert/strict';
import {renderQuoteDocument,quoteLines,quoteIsAvailable} from '../src/lib/catering.ts';
const quote={id:'qa',status:'sent',valid_until:'2099-01-01',extra_fee:500,total:3500,conditions:'<script>alert("x")</script>',lines:[{name:'Poulet & attiéké <img src=x>',quantity:2,price:1500}]};
const html=renderQuoteDocument(quote,{name:'Awa <script>x</script>',event_type:'Réunion',event_at:'2026-12-01T12:00:00Z',location:'Abidjan & alentours'});
assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Poulet &amp; attiéké/);assert.match(html,/FCFA/);assert.match(html,/ni une preuve de paiement/);
assert.deepEqual(quoteLines(null),[]);assert.equal(quoteIsAvailable(quote),true);assert.equal(quoteIsAvailable({...quote,valid_until:'2000-01-01'}),false);
console.log('Document devis: montants, accents, échappement HTML, contenu malformé et expiration validés sans email ni accès distant.');
