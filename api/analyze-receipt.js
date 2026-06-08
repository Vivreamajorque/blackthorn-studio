const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { image, mediaType } = req.body
  if (!image) return res.status(400).json({ error: 'image requise' })

  if (!ANTHROPIC_KEY) {
    // Sans clé API : retourner un objet vide pour saisie manuelle
    return res.status(200).json({ manual: true })
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `Analyse ce ticket/facture. Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "montant": <nombre en euros, sans symbole>,
  "fournisseur": "<nom du commerce>",
  "date": "<date au format YYYY-MM-DD si visible, sinon null>",
  "categorie": "<une de : Matériel tatouage, Consommables, Marketing, Équipement, Charges fixes, Déplacements, Autre>",
  "iva_pct": <taux IVA en % si visible, sinon 21>,
  "description": "<description courte en français>"
}`
            }
          ]
        }]
      })
    })
    const data = await r.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (e) {
    return res.status(200).json({ manual: true, error: e.message })
  }
}
