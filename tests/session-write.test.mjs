import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import Module from 'node:module'
import path from 'node:path'
const compiled=new Module(path.resolve('src/lib/notion.test.cjs'))
compiled.filename=path.resolve('src/lib/notion.test.cjs')
compiled.paths=Module._nodeModulePaths(process.cwd())
const output=await build({entryPoints:['src/lib/notion.js'],bundle:true,write:false,platform:'node',format:'cjs'})
compiled._compile(output.outputFiles[0].text,compiled.filename)
const {notion}=compiled.exports
const page={id:'session-id',properties:{Statut:{select:{name:'🗓 Prévu'}},Date:{date:{start:'2026-10-20T10:00:00'}},Session:{title:[{plain_text:'[RDV] SUMUP-ABCDEF'}]},Notes:{rich_text:[{plain_text:'1 session(s) · CONSENTEMENT SIGNÉ · informations conservées'}]}}}
test('confirmation saves only balance, its receipt date and preserves consent and quote link',async()=>{
 const original=global.fetch;let saved
 global.fetch=async(url,options)=>{if(options.method==='PATCH')saved=JSON.parse(options.body);return {ok:true,json:async()=>page}}
 try {
  await notion.confirmAppointment('session-id',{prix:200,acompte:50,date:'2026-10-26',paiement:'carte'})
  assert.equal(saved.properties.Prix.number,150)
  assert.equal(saved.properties['Solde reçu'].number,150)
  assert.equal(saved.properties.Date.date.start,'2026-10-26')
  assert.match(saved.properties.Notes.rich_text[0].text.content,/CONSENTEMENT SIGNÉ/)
  assert.match(saved.properties.Notes.rich_text[0].text.content,/DEVIS_TOKEN:ABCDEF/)
 } finally{global.fetch=original}
})
test('an already confirmed appointment cannot subtract its deposit twice',async()=>{
 const original=global.fetch;let writes=0
 global.fetch=async(url,options)=>{if(options.method==='PATCH')writes++;return {ok:true,json:async()=>({...page,properties:{...page.properties,Statut:{select:{name:'✅ Confirmé'}}}})}}
 try {await notion.confirmAppointment('session-id',{prix:150,acompte:50});assert.equal(writes,0)}finally{global.fetch=original}
})
test('an impossible deposit is rejected instead of silently clipping balance to zero',async()=>{
 const original=global.fetch;let writes=0
 global.fetch=async(url,options)=>{if(options.method==='PATCH')writes++;return {ok:true,json:async()=>page}}
 try {await assert.rejects(notion.confirmAppointment('session-id',{prix:20,acompte:50}),/au moins/);assert.equal(writes,0)}finally{global.fetch=original}
})
