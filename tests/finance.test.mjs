import test from 'node:test'
import assert from 'node:assert/strict'
import { receipts, inMonth, between, sum, sessionCount, splitPayments, forecast, forecastSum, financials, includedVat, expenseVat, dataWarnings } from '../src/lib/finance.mjs'
import { collectPages } from '../src/lib/pagination.mjs'

const row = (id,price,date,{client='Alex',deposit=0,type='🖤 Tattoo Tony',status='✅ Confirmé',notes='',title='[CASH] séance'}={}) => ({id,properties:{Prix:{number:price},Date:{date:{start:date}},Type:{select:{name:type}},Statut:{select:{name:status}},Session:{title:[{plain_text:title}]},'Acompte reçu':{number:deposit},'Solde reçu':{number:price},'Client prénom':{rich_text:[{plain_text:client}]},Notes:{rich_text:[{plain_text:notes}]}}})
const quote = (id,price,deposit,token,notes='',status='✅ Réservé') => ({id,properties:{Prix:{number:price},Acompte:{number:deposit},Token:{rich_text:[{plain_text:token}]},Notes:{rich_text:[{plain_text:notes}]},Statut:{select:{name:status}}}})
const expense=(amount,rate=21,recover=true)=>({properties:{Montant:{number:amount},Notes:{rich_text:[{plain_text:`[IVA:${rate}]`}]},'IVA récupérable':{checkbox:recover}}})

test('deposit and balance in same month both count; never deduplicate a name',()=>{
  const rows=[row('a',50,'2026-10-02',{type:'💰 Versement client'}),row('b',150,'2026-10-04')]
  assert.equal(sum(receipts(rows,'2026-10-26')),200)
  assert.equal(sessionCount(rows),1)
})
test('same first name on two different appointments stays distinct',()=>assert.equal(sum(receipts([row('a',120,'2026-10-02'),row('b',80,'2026-10-03')],'2026-10-26')),200))
test('deposit previous month and balance today stay in their periods',()=>{
  const rows=receipts([row('a',50,'2026-09-02',{type:'💰 Versement client'}),row('b',150,'2026-10-04')],'2026-10-26')
  assert.equal(sum(inMonth(rows,'2026-10')),150)
  assert.equal(sum(between(rows,'2026-10-04','2026-10-04')),150)
})
test('duplicates of a Notion id or checkout id count once',()=>{
  const first=row('a',50,'2026-10-02',{type:'💰 Versement client',notes:'PAYMENT_ID:checkout-123'})
  const duplicate={...first,id:'b'}
  assert.equal(sum(receipts([first,first,duplicate],'2026-10-26')),50)
})
test('planned, cancelled, no-show, future, and Amely entries are not collected cash',()=>{
  const rows=[row('a',100,'2026-10-27'),row('b',100,'2026-10-01',{status:'🗓 Prévu'}),row('c',100,'2026-10-01',{status:'❌ Annulé'}),row('d',100,'2026-10-01',{status:'👻 No-show'}),row('e',100,'2026-10-01',{type:'Amely'})]
  assert.equal(sum(receipts(rows,'2026-10-26')),0)
})
test('SumUp deposit is card, transfer is separate, unknown is never cash',()=>{
  const rows=[row('a',30,'2026-10-01',{title:'[VERSEMENT]',notes:'Acompte SumUp'}),row('b',70,'2026-10-01',{title:'[VERSEMENT]',notes:'virement'}),row('c',10,'2026-10-01',{title:'[VERSEMENT]'})]
  assert.deepEqual(splitPayments(rows),{cash:0,carte:30,virement:70,inconnu:10})
})
test('quote plus its appointment count as one remaining amount',()=>{
  const result=forecast([row('r',200,'2026-10-28',{status:'🗓 Prévu',deposit:50,title:'[RDV] SUMUP-ABCDEF'})],[quote('q',200,50,'ABCDEF','RDV: 2026-10-28 à 10:00')],'2026-10-26')
  assert.equal(forecastSum(result.items),150)
})
test('completed appointments and past reserved quotes leave forecast',()=>{
  const result=forecast([row('r',150,'2026-10-01',{notes:'DEVIS_TOKEN:ABCDEF'})],[quote('q',200,50,'ABCDEF','RDV: 2026-10-01 à 10:00')],'2026-10-26')
  assert.equal(forecastSum(result.items),0)
})
test('undated quotes are separate, next-month quotes do not inflate current month',()=>{
  const result=forecast([],[quote('a',200,50,'ABCDEF'),quote('b',300,50,'UVWXYZ','RDV: 2026-11-01 à 10:00')],'2026-10-26')
  assert.equal(result.undated,150)
  assert.equal(forecastSum(result.items.filter(x=>x.date.startsWith('2026-10'))),0)
})
test('VAT is extracted from TTC at the invoice rate',()=>{
  assert.equal(includedVat(121),21)
  assert.equal(expenseVat(expense(110,10)),10)
  assert.equal(expenseVat(expense(100,0)),0)
  assert.equal(expenseVat(expense(121,21,false)),0)
})
test('actual expenses replace assumed costs, losses remain negative',()=>{
  const result=financials(0,[expense(956,0,false)])
  assert.equal(result.cashBalance,-956)
  assert.equal(result.net,-956)
  assert.equal(result.irpf,0)
})
test('cash after provisions reconciles to recorded TTC movements',()=>{
  const result=financials(1210,[expense(121)])
  assert.equal(result.caHt,1000)
  assert.equal(result.ben,900)
  assert.equal(result.irpf,180)
  assert.equal(result.ivaNette,189)
  assert.equal(result.net,720)
  assert.equal(result.net,result.cashBalance-result.irpf-result.ivaNette)
})
test('money aggregation does not accumulate binary rounding errors',()=>assert.equal(sum([row('a',0.1,'2026-10-01'),row('b',0.2,'2026-10-01')]),0.3))
test('conflicting historic amounts are surfaced and never rewritten',()=>{
  const r=row('a',90,'2026-10-01',{deposit:30});r.properties['Solde reçu'].number=125
  const before=JSON.stringify(r)
  assert.equal(dataWarnings([r]).length,1)
  assert.equal(JSON.stringify(r),before)
})
test('pagination collects 134 records instead of truncating to 100',async()=>{
  const calls=[]
  const result=await collectPages(async body=>{calls.push(body);return body.start_cursor ? {results:Array.from({length:34},(_,i)=>({id:String(i+100)})),has_more:false} : {results:Array.from({length:100},(_,i)=>({id:String(i)})),has_more:true,next_cursor:'next'}})
  assert.equal(result.results.length,134)
  assert.equal(calls[0].page_size,100)
  assert.equal(calls[1].start_cursor,'next')
})
test('pagination error is visible rather than returning partial totals',async()=>{
  await assert.rejects(collectPages(async()=>({results:[],has_more:true})),/incomplet/)
})
