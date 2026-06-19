// api/sumup-checkout.js
const SUMUP_KEY       = process.env.CLESUMUP || process.env.SUMUP_KEY
const MERCHANT_CODE   = process.env.SUMUP_MERCHANT_CODE

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!SUMUP_KEY) return res.status(500).json({ error: 'SUMUP_KEY manquante' })

  const { amount, currency = 'EUR', description, reference } = req.body || {}
  if (!amount || !description) return res.status(400).json({ error: 'amount et description requis' })

  const https = require('https')

  const cleanRef = (reference || `BT-${Date.now()}`)
    .replace(/[^a-zA-Z0-9-]/g, '').substring(0, 90)

  const payload = JSON.stringify({
    checkout_reference: cleanRef,
    amount:             Math.round(parseFloat(amount) * 100) / 100,
    currency,
    description:        String(description).substring(0, 100),
    merchant_code:      MERCHANT_CODE,
    // Hosted Checkout — SumUp retourne hosted_checkout_url directement utilisable
    hosted_checkout: { enabled: true },
    return_url: 'https://blackthorn-studio.vercel.app/booking-confirm',
  })

  console.log('[SumUp] Payload:', payload)

  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.sumup.com', port: 443,
      path: '/v0.1/checkouts', method: 'POST',
      headers: {
        'Authorization':  `Bearer ${SUMUP_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const r = https.request(opts, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          console.log('[SumUp] Status:', resp.statusCode, '| Response:', JSON.stringify(parsed).substring(0, 400))
          if (resp.statusCode !== 200 && resp.statusCode !== 201) {
            res.status(resp.statusCode).json({
              error:   parsed.message || parsed.error_code || 'Erreur SumUp',
              details: parsed
            })
          } else {
            // Utiliser hosted_checkout_url si disponible, sinon fallback
            const payUrl = parsed.hosted_checkout_url
              || `https://pay.sumup.com/b2c/checkouts/${parsed.id}`
            console.log('[SumUp] payUrl:', payUrl)
            res.status(200).json({ checkoutId: parsed.id, payUrl, amount: parsed.amount })
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error', raw: data.substring(0, 200) })
        }
        resolve()
      })
    })

    r.on('error', (e) => { res.status(500).json({ error: e.message }); resolve() })
    r.write(payload)
    r.end()
  })
}
