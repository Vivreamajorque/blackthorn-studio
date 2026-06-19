// api/sumup-checkout.js
// Crée un checkout SumUp et retourne l'URL de paiement
// La clé reste côté serveur — jamais exposée au client

const SUMUP_KEY = process.env.SUMUP_KEY

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

  const payload = JSON.stringify({
    checkout_reference: reference || `BT-${Date.now()}`,
    amount:             parseFloat(amount),
    currency,
    description,
    merchant_code:      undefined, // SumUp le déduit de la clé
    pay_to_email:       undefined,
    redirect_url:       `${req.headers.origin || 'https://blackthorn-studio.vercel.app'}/booking-paid`
  })

  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.sumup.com',
      port: 443,
      path: '/v0.1/checkouts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUMUP_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }

    const r = https.request(opts, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (resp.statusCode !== 200 && resp.statusCode !== 201) {
            res.status(resp.statusCode).json({ error: parsed.message || 'Erreur SumUp', details: parsed })
          } else {
            // Retourner l'ID du checkout + URL de paiement
            const checkoutId  = parsed.id
            const payUrl = `https://pay.sumup.com/b2c/checkouts/${checkoutId}`
            res.status(200).json({ checkoutId, payUrl, amount: parsed.amount, status: parsed.status })
          }
        } catch(e) {
          res.status(500).json({ error: 'Parse error', raw: data })
        }
        resolve()
      })
    })

    r.on('error', (e) => { res.status(500).json({ error: e.message }); resolve() })
    r.write(payload)
    r.end()
  })
}
