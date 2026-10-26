const { notion, queryAll, quoteForToken, DBS } = require('../server/notion.cjs')
const { createAppointment, getText, rich } = require('../server/payments.cjs')
const { sameOrigin } = require('../server/session.cjs')

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store')
  if (!sameOrigin(req)) return res.status(403).json({error:'Origine non autorisée'})
  try {
    const input = req.method === 'GET' ? req.query : req.body || {}
    const { token, action='quote' } = input
    const quote = await quoteForToken(token)
    if (!quote) return res.status(404).json({error:'Lien invalide ou expiré'})
    if (req.method === 'GET' && action === 'quote') {
      const properties = Object.fromEntries(['Client','Description','Prix','Acompte','Statut','Durée','Tatouages'].filter(key=>quote.properties[key]).map(key=>[key,quote.properties[key]]))
      return res.status(200).json({results:[{id:quote.id,properties}]})
    }
    if (req.method === 'GET' && action === 'availability') {
      const rows = await queryAll(DBS.sessions,{filter:{or:[{property:'Statut',select:{equals:'🗓 Prévu'}},{property:'Statut',select:{equals:'✅ Confirmé'}}]}})
      // Expose only occupied times and duration, never client identities/notes.
      return res.status(200).json({results:rows.filter(row=>row.properties.Type?.select?.name !== '💰 Versement client').map(row=>({id:row.id,properties:{Date:row.properties.Date,Statut:row.properties.Statut,Notes:{rich_text:[{plain_text:`DUREE:${getText(row,'Notes').match(/DUREE:(\d+)/)?.[1] || 120}`}]}}}))})
    }
    if (req.method === 'GET' && action === 'slots') {
      const { from,to }=input
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || (new Date(to)-new Date(from))/86400000 > 100) return res.status(400).json({error:'Période invalide'})
      const rows=await queryAll(DBS.creneaux,{filter:{and:[{property:'Date',date:{on_or_after:from}},{property:'Date',date:{on_or_before:to}}]}})
      return res.status(200).json({results:rows.map(row=>({id:row.id,properties:{Date:row.properties.Date,Heure:row.properties.Heure,Statut:row.properties.Statut}}))})
    }
    if (req.method === 'POST' && action === 'reserve') {
      if ((quote.properties.Acompte?.number || 0) > 0) return res.status(403).json({error:'Paiement requis'})
      if (quote.properties.Statut?.select?.name === '✅ Réservé') return res.status(200).json({success:true})
      await createAppointment(quote,token,input.day,input.time,0)
      const notes=getText(quote,'Notes')
      await notion(`pages/${quote.id}`,'PATCH',{properties:{Statut:{select:{name:'✅ Réservé'}},Notes:rich(`${notes} · RDV: ${input.day} à ${input.time}`)}})
      return res.status(200).json({success:true})
    }
    return res.status(405).json({error:'Action non autorisée'})
  } catch (_) { return res.status(502).json({error:'Réservation temporairement indisponible'}) }
}
