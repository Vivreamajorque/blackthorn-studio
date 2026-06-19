// api/consent-submit.js
const https   = require('https')
const NOTION_KEY  = process.env.NOTION_KEY
const SESSIONS_DB = 'd5c3846e-3d3c-4eae-ade8-2e7efa3c896f'
// ID du dossier Google Drive "Fiches de consentement"
const DRIVE_FOLDER_ID = '1hKI1f8Ur7oVQ4PF6WMjwoSAhDttQB-Z2'

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

// Upload PDF vers Vercel Blob Storage
const uploadToBlob = async (pdfBase64, filename) => {
  try {
    const { put } = await import('@vercel/blob')
    const buffer = Buffer.from(pdfBase64.split(',')[1] || pdfBase64, 'base64')
    const blob = await put(`consentements/${filename}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    })
    return blob.url
  } catch(e) {
    console.warn('[consent-submit] Blob upload failed:', e.message)
    return null
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { sessionId, data, signature, lang, pdfData } = req.body || {}
  if (!sessionId || !data) return res.status(400).json({ error: 'sessionId et data requis' })

  try {
    const now = new Date().toLocaleString('fr-FR')
    const contraStr = Object.entries(data.contras || {})
      .filter(([,v]) => v === true).map(([k]) => k).join(', ') || 'Aucune'

    // Upload PDF vers Vercel Blob
    let pdfUrl = null
    const filename = `${data.nom?.replace(/\s+/g,'-') || 'client'}-${Date.now()}.pdf`
    if (pdfData) {
      pdfUrl = await uploadToBlob(pdfData, filename)
      console.log('[consent-submit] PDF URL:', pdfUrl)
    }

    const notes = [
      `📋 CONSENTEMENT SIGNÉ — ${now}`,
      `Nom : ${data.nom || '—'} | DNI/Passeport : ${data.dni || '—'}`,
      `Né(e) le : ${data.dateNaissance || '—'} | Nationalité : ${data.nationalite || '—'}`,
      `Email : ${data.email || '—'}`,
      `Majeur(e) : ${data.majeur ? 'OUI' : 'NON'}`,
      `Contre-indications : ${contraStr}`,
      `Photo réseaux : ${data.photoOk ? 'OUI' : 'NON'}`,
      `RGPD : OUI | Langue : ${lang || 'fr'}`,
      signature ? '✍️ Signature numérique : OUI' : '',
      pdfUrl ? `📄 PDF : ${pdfUrl}` : '',
    ].filter(Boolean).join('\n')

    await notion(`pages/${sessionId}`, 'PATCH', {
      properties: {
        'Fiche signée': { checkbox: true },
        'Notes': { rich_text: [{ text: { content: notes.substring(0, 1900) } }] },
        'Client prénom': { rich_text: [{ text: { content: (data.nom || '').substring(0, 200) } }] },
      }
    })

    return res.status(200).json({ success: true, pdfUrl })
  } catch(e) {
    console.error('[consent-submit]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
