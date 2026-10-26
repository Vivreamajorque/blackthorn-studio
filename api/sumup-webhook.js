const { sumup, completePayment } = require('../server/payments.cjs')
module.exports = async (req,res) => {
  if (req.method !== 'POST') return res.status(405).end()
  const id=req.body?.id || req.body?.checkout_id || req.body?.payload?.id
  if (!/^[a-zA-Z0-9-]{6,100}$/.test(id || '')) return res.status(400).json({error:'Référence invalide'})
  try {
    // Never trust webhook amount/status: verify against the merchant's SumUp account.
    const checkout=await sumup(`checkouts/${id}`)
    const token=checkout.checkout_reference?.match(/^BT-([a-zA-Z0-9-]+)-\d+$/)?.[1]
    if (!token) return res.status(200).json({received:true,ignored:true})
    await completePayment(checkout,token)
    return res.status(200).json({received:true})
  } catch (_) { return res.status(502).json({error:'Traitement à réessayer'}) }
}
