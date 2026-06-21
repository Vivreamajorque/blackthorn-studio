const BREVO_KEY = process.env.BREVO_API_KEY

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, client, lang, date, style } = req.body
  if (!email) return res.status(400).json({ error: 'email requis' })

  // Langue → sujet adapté
  const subjects = {
    fr: '🖤 Prends soin de ton tatouage — Blackthorn Tattoo',
    en: '🖤 Take care of your tattoo — Blackthorn Tattoo',
    es: '🖤 Cuida tu tatuaje — Blackthorn Tattoo',
    de: '🖤 Pflege dein Tattoo — Blackthorn Tattoo',
    ca: '🖤 Cuida el teu tatuatge — Blackthorn Tattoo',
  }
  const subject = subjects[lang] || subjects.fr

  const payload = {
    templateId: 9,
    to: [{ email, name: client || 'Client' }],
    sender: { name: 'Blackthorn Tattoo', email: 'Blackthorntattoo.campos@gmail.com' },
    subject,
    params: {
      CLIENT: client || '',
      DATE: date || '',
      STYLE: style || '',
    }
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    const data = await resp.json()
    if (!resp.ok) return res.status(500).json({ error: data.message || 'Erreur Brevo' })
    return res.json({ ok: true, messageId: data.messageId })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
// redeploy 1782057188
// force 1782057365
