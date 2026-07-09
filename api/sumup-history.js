// api/sumup-history.js
// DIAGNOSTIC — lecture seule. Liste les transactions SumUp des derniers jours
// pour retrouver manuellement des paiements reçus mais jamais remontés dans
// le Hub (cas antérieurs au correctif du 09/07 — pas de checkout id stocké
// dans Notion, donc sumup-reconcile.js ne peut pas les rattraper tout seul).
// N'écrit rien nulle part. À supprimer une fois le rattrapage terminé.

const https = require('https')

const SUMUP_KEY = process.env.CLESUMUP || process.env.SUMUP_KEY
const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE

const sumupCall = (path) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'api.sumup.com', port: 443,
    path, method: 'GET',
    headers: { 'Authorization': `Bearer ${SUMUP_KEY}` }
  }
  const r = https.request(opts, (resp) => {
    let d = ''
    resp.on('data', c => d += c)
    resp.on('end', () => {
      try { resolve({ statusCode: resp.statusCode, body: JSON.parse(d) }) }
      catch(e) { resolve({ statusCode: resp.statusCode, body: d }) }
    })
  })
  r.on('error', reject)
  r.end()
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (!SUMUP_KEY || !MERCHANT_CODE) {
    return res.status(200).json({ ok: false, error: 'SUMUP_KEY ou SUMUP_MERCHANT_CODE manquante' })
  }
  try {
    const days = parseInt(req.query?.days || '10')
    const oldest = new Date(Date.now() - days * 86400000).toISOString()
    const path = `/v2.1/merchants/${MERCHANT_CODE}/transactions/history?limit=100&order=descending&oldest_time=${encodeURIComponent(oldest)}`
    const { statusCode, body } = await sumupCall(path)
    if (statusCode !== 200) return res.status(200).json({ ok: false, statusCode, body })

    const items = (body.items || []).map(t => ({
      amount: t.amount,
      status: t.status,
      timestamp: t.timestamp,
      product_summary: t.product_summary,
      payment_type: t.payment_type,
      transaction_code: t.transaction_code,
      id: t.id
    }))
    return res.status(200).json({ ok: true, count: items.length, items })
  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message })
  }
}
