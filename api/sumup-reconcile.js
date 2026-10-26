const { requireSession } = require('../server/session.cjs')
const { queryAll, DBS } = require('../server/notion.cjs')
const { sumup, completePayment, getText } = require('../server/payments.cjs')
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store')
  if (!['GET','POST'].includes(req.method)) return res.status(405).end()
  const isCron=process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  if (!isCron && req.method !== 'POST') return res.status(405).end()
  if (!isCron && !await requireSession(req,res)) return
  try {
    const quotes=await queryAll(DBS.devis,{filter:{and:[{property:'Statut',select:{does_not_equal:'❌ Refusé'}},{property:'Statut',select:{does_not_equal:'❌ Annulé'}}]}})
    const results=[]
    for (const quote of quotes) {
      const id=getText(quote,'Notes').match(/CHECKOUT:([a-zA-Z0-9-]+)/)?.[1]
      const token=getText(quote,'Token')
      if (!id || !token) continue
      try {
        const result=await completePayment(await sumup(`checkouts/${id}`),token)
        results.push({reconciled:!!result.reconciled})
      } catch (_) { results.push({reconciled:false,error:'Vérification à réessayer'}) }
    }
    return res.status(200).json({ok:true,checked:results.length,results})
  } catch (_) { return res.status(502).json({error:'Rapprochement indisponible'}) }
}
