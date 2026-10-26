import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {completePayment}=require('../server/payments.cjs')
const token='TESTTOKEN'
const rich=value=>({rich_text:[{plain_text:value}]})
const quote={id:'quote-id',properties:{Client:rich('Client test'),Description:rich('Tattoo'),Notes:rich('RDV: 2026-11-01 à 10:00'),Prix:{number:200},Acompte:{number:50},Statut:{select:{name:'✅ Réservé'}}}}
const checkout={id:'checkout-id',checkout_reference:`BT-${token}-123456`,amount:50,currency:'EUR',status:'PAID',date:'2026-10-26T10:00:00Z'}
test('a paid checkout records actual amount and stable payment id even on an already reserved quote',async()=>{
 const writes=[];const original=global.fetch
 global.fetch=async(url,options)=>{
   const path=new URL(url).pathname
   if(path.includes('/databases/')) {
     if(path.includes('b6d33466')) return {ok:true,json:async()=>({results:[quote]})}
     return {ok:true,json:async()=>({results:[],has_more:false})}
   }
   writes.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'new-row'})}
 }
 try {
   const result=await completePayment(checkout,token)
   assert.equal(result.paid,true)
   assert.equal(writes.length,2)
   const deposit=writes.find(x=>x.properties.Type?.select?.name==='💰 Versement client')
   assert.equal(deposit.properties.Prix.number,50)
   assert.match(deposit.properties.Notes.rich_text[0].text.content,/PAYMENT_ID:checkout-id/)
   assert.match(deposit.properties.Notes.rich_text[0].text.content,/DEVIS_TOKEN:TESTTOKEN/)
 } finally {global.fetch=original}
})
test('a second payment notification does not add a payment or appointment',async()=>{
 let writes=0;const original=global.fetch
 global.fetch=async(url,options)=>{
   const path=new URL(url).pathname
   if(path.includes('b6d33466')) return {ok:true,json:async()=>({results:[quote]})}
   if(path.includes('/databases/')) {
     const body=JSON.parse(options.body)
     return {ok:true,json:async()=>({results:body.filter.or ? [{properties:{Type:{select:{name:'🖤 Tattoo Tony'}}}}] : [{id:'existing-payment'}],has_more:false})}
   }
   writes++;return {ok:true,json:async()=>({})}
 }
 try {assert.equal((await completePayment(checkout,token)).reconciled,false);assert.equal(writes,0)}
 finally{global.fetch=original}
})
test('a checkout for another quote cannot reserve this quote',async()=>{
 await assert.rejects(completePayment({...checkout,checkout_reference:'BT-OTHER-123456'},token),/correspondance/)
})
test('unpaid checkouts never create accounting entries',async()=>{
 const original=global.fetch;global.fetch=async()=>{throw new Error('must not call')}
 try{assert.equal((await completePayment({...checkout,status:'PENDING'},token)).paid,false)}finally{global.fetch=original}
})
