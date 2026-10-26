const { notion, queryAll, quoteForToken, DBS } = require('./notion.cjs')
const rich = content => ({rich_text:[{text:{content:String(content).slice(0,1900)}}]})
const getText = (page,key) => (page.properties[key]?.rich_text || []).map(x=>x.plain_text ?? x.text?.content ?? '').join('')
async function sumup(path, method='GET', body) {
  const key = process.env.CLESUMUP || process.env.SUMUP_KEY
  if (!key) throw new Error('Paiement temporairement indisponible')
  const response = await fetch(`https://api.sumup.com/v0.1/${path}`,{method,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})
  const data = await response.json()
  if (!response.ok) throw new Error('Vérification SumUp impossible')
  return data
}
const paid = checkout => ['PAID','SUCCESSFUL'].includes(String(checkout.status).toUpperCase())
async function completePayment(checkout, token) {
  if (!paid(checkout)) return {paid:false,status:checkout.status}
  if (!checkout.checkout_reference?.startsWith(`BT-${token}-`) || checkout.currency !== 'EUR' || !(checkout.amount > 0)) throw new Error('Paiement sans correspondance')
  const quote = await quoteForToken(token)
  if (!quote) throw new Error('Devis introuvable')
  const notes = getText(quote,'Notes')
  const match = notes.match(/RDV:\s*(\d{4}-\d{2}-\d{2})\s*à\s*(\d{2}:\d{2})/) || (checkout.description || '').match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
  const client = getText(quote,'Client') || 'Client'
  const desc = getText(quote,'Description')
  const tokenRows = await queryAll(DBS.sessions,{filter:{or:[{property:'Session',title:{contains:`SUMUP-${token}`}},{property:'Notes',rich_text:{contains:`DEVIS_TOKEN:${token}`}}]}})
  // Every payment is keyed by checkout id, not by a person's name or quote status.
  const paymentMarker = `PAYMENT_ID:${checkout.id}`
  const existing = await queryAll(DBS.sessions,{filter:{property:'Notes',rich_text:{contains:paymentMarker}}})
  const oldDeposit = tokenRows.find(row=>row.properties.Type?.select?.name === '💰 Versement client' && getText(row,'Notes').includes(checkout.checkout_reference))
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date(checkout.date || Date.now()))
  const deposit = Math.round(checkout.amount*100)/100
  let created = false
  if (!existing.length && !oldDeposit) {
    created = true
    await notion('pages','POST',{parent:{database_id:DBS.sessions},properties:{
      Session:{title:[{text:{content:`[VERSEMENT] ${client} · ${deposit}€ · SUMUP-${token}`}}]},
      Type:{select:{name:'💰 Versement client'}}, Prix:{number:deposit},
      'Acompte reçu':{number:deposit},'Solde reçu':{number:0}, Date:{date:{start:day}},
      Statut:{select:{name:'✅ Confirmé'}},'Client prénom':rich(client),'Style / Type':rich(desc),
      Notes:rich(`Acompte SumUp ${checkout.checkout_reference} · ${paymentMarker} · DEVIS_TOKEN:${token}`),
      Source:{select:{name:'🔗 Lien réservation'}}
    }})
  }
  const hasAppointment = tokenRows.some(row=>row.properties.Type?.select?.name !== '💰 Versement client')
  if (match && !hasAppointment) { await createAppointment(quote,token,match[1],match[2],deposit); created = true }
  if (quote.properties.Statut?.select?.name !== '✅ Réservé') await notion(`pages/${quote.id}`,'PATCH',{properties:{Statut:{select:{name:'✅ Réservé'}}}})
  return {paid:true,success:true,reconciled:created}
}
async function createAppointment(quote,token,day,time,deposit=0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Date ou heure invalide')
  const client=getText(quote,'Client') || 'Client'
  return notion('pages','POST',{parent:{database_id:DBS.sessions},properties:{
    Session:{title:[{text:{content:`[RDV] ${client} · ${day} · SUMUP-${token}`}}]},
    Type:{select:{name:'🖤 Tattoo Tony'}},Prix:{number:quote.properties.Prix?.number || 0},
    'Acompte reçu':{number:deposit},'Solde reçu':{number:0},Date:{date:{start:`${day}T${time}:00`}},
    Statut:{select:{name:'🗓 Prévu'}},'Client prénom':rich(client),'Style / Type':rich(getText(quote,'Description')),
    Notes:rich(`1 session(s) · DEVIS_TOKEN:${token} · DUREE:${quote.properties['Durée']?.number || 120}`),Source:{select:{name:'🔗 Lien réservation'}}
  }})
}
module.exports = { sumup, paid, completePayment, createAppointment, getText, rich }
