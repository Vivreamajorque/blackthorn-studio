// api/consent-submit.js — Reçoit la fiche de consentement signée et met à jour Notion
const https = require('https')
const NOTION_KEY  = process.env.NOTION_KEY
const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'

const notion = (path, method, body) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const opts = {
    hostname: 'api.notion.com', port: 443,
    path: `/v1/${path}`, method,
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }
  }
  const r = https.request(opts, resp => {
    let d = ''; resp.on('data', c => d += c)
    resp.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
  })
  r.on('error', reject)
  if (payload) r.write(payload)
  r.end()
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { sessionId, data, signature, lang } = req.body || {}
  if (!sessionId || !data) return res.status(400).json({ error: 'sessionId et data requis' })

  try {
    // Construire le résumé de la fiche dans les notes
    const contraStr = Object.entries(data.contras || {})
      .filter(([,v]) => v === true)
      .map(([k]) => k).join(', ') || 'Aucune'

    const notes = [
      `📋 CONSENTEMENT SIGNÉ — ${new Date().toLocaleString('fr-FR')}`,
      `Nom : ${data.nom || '—'} | DNI/Passeport : ${data.dni || '—'}`,
      `Né(e) le : ${data.dateNaissance || '—'} | Nationalité : ${data.nationalite || '—'}`,
      `Majeur(e) : ${data.majeur ? 'OUI' : 'NON'}`,
      `Contre-indications déclarées : ${contraStr}`,
      `Photo réseaux : ${data.photoOk ? 'OUI' : 'NON'}`,
      `RGPD accepté : OUI`,
      `Langue formulaire : ${lang || 'fr'}`,
      signature ? '✍️ Signature numérique : OUI' : '✍️ Signature : NON'
    ].join('\n')

    // Mettre à jour la session dans Notion
    await notion(`pages/${sessionId}`, 'PATCH', {
      properties: {
        'Fiche signée': { checkbox: true },
        'Notes': { rich_text: [{ text: { content: notes.substring(0, 1900) } }] },
        'Client prénom': { rich_text: [{ text: { content: (data.nom || '').substring(0, 200) } }] },
      }
    })

    return res.status(200).json({ success: true })
  } catch(e) {
    console.error('[consent-submit]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
