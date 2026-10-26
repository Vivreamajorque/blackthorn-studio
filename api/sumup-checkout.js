const { quoteForToken, notion } = require('../server/notion.cjs')
const { sumup, getText, rich } = require('../server/payments.cjs')
const { sameOrigin } = require('../server/session.cjs')
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!sameOrigin(req)) return res.status(403).end()
  try {
    const {token,day,time}=req.body || {}
    const quote=await quoteForToken(token)
    if (!quote || quote.properties.Statut?.select?.name === '✅ Réservé') return res.status(400).json({error:'Devis indisponible'})
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return res.status(400).json({error:'Créneau invalide'})
    const amount=quote.properties.Acompte?.number || 0
    if (!(amount > 0) || amount > (quote.properties.Prix?.number || 0)) return res.status(400).json({error:'Acompte invalide'})
    const checkout=await sumup('checkouts','POST',{
      checkout_reference:`BT-${token}-${Date.now()}`,amount,currency:'EUR',
      description:`Acompte tatouage — ${getText(quote,'Client')} — ${day} ${time}`.slice(0,100),
      merchant_code:process.env.SUMUP_MERCHANT_CODE,hosted_checkout:{enabled:true},
      notification_url:'https://blackthorn-studio.vercel.app/api/sumup-webhook',
      return_url:`https://blackthorn-studio.vercel.app/booking/${token}`
    })
    // Preserve notes, and save the authoritative checkout before exposing payment.
    const notes=getText(quote,'Notes').replace(/RDV:\s*\d{4}-\d{2}-\d{2}\s*à\s*\d{2}:\d{2}/g,'').replace(/CHECKOUT:[a-zA-Z0-9-]+/g,'')
    await notion(`pages/${quote.id}`,'PATCH',{properties:{Notes:rich(`RDV: ${day} à ${time} · CHECKOUT:${checkout.id} · ${notes}`)}})
    return res.status(200).json({checkoutId:checkout.id,payUrl:checkout.hosted_checkout_url || `https://pay.sumup.com/b2c/checkouts/${checkout.id}`,amount:checkout.amount})
  } catch (_) { return res.status(502).json({error:'Paiement temporairement indisponible'}) }
}
