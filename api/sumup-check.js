const { sumup, completePayment } = require('../server/payments.cjs')
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','private, no-store')
  if (req.method !== 'GET') return res.status(405).end()
  const {checkoutId,token}=req.query
  if (!/^[a-zA-Z0-9-]{6,100}$/.test(token || '') || !/^[a-zA-Z0-9-]{6,100}$/.test(checkoutId || '')) return res.status(400).json({error:'Référence invalide'})
  try { return res.status(200).json(await completePayment(await sumup(`checkouts/${checkoutId}`),token)) }
  catch (_) { return res.status(502).json({error:'Vérification du paiement impossible'}) }
}
