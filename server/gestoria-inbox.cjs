const { createHash } = require('node:crypto')
const { parseAttachment, storeAttachment } = require('./gestoria-attachments.cjs')
const { readWorkspace } = require('../api/gestoria-workspace.js')

const path = 'mi-gestoria/personal/v1/workspace.json'
const fold = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const amount = '(?:-?\\d{1,3}(?:[ .]\\d{3})*|-?\\d+)[,.]\\d{2}'

function findCategory(name, text, mime) {
  const clues = fold(name + ' ' + text.slice(0, 4000))
  if (/sum\s*up|comision(?:es)? de transaccion|commission[s]? de paiement/.test(clues)) return 'fees'
  if (/modelo\s*0?(?:30|36|100|115|130|180|303|349|390)\b|certificado de situacion censal|autoliquidacion|justificante de presentacion/.test(clues)) return 'filing'
  if (/importass|seguridad social|\breta\b|cotizaciones|cotisation/.test(clues)) return 'social'
  if (/endesa|iberdrola|telefonica|vodafone|movistar|\bp26con\d+/.test(clues)) return 'utilities'
  if (/arrendamiento|\bloyer\b|alquiler|lloguer/.test(clues)) return 'rent'
  if (/fibra|internet|electricidad|electricite|suministro|factura de agua/.test(clues)) return 'utilities'
  if (/seguro|assurance|poliza/.test(clues)) return 'insurance'
  if (/agujas|cartuchos|tintas|aiguilles|tattoo supplies|consommable|material|materiel|killer ink/.test(clues)) return 'equipment'
  if (mime === 'text/csv' || /extracto|releve|informe de pagos|rapport de versement|report/.test(clues)) return 'statement'
  return 'other'
}

function matchCents(text, labels) {
  const pattern = new RegExp('(?:^|\\n)[ \\t]*(?:' + labels + ')[ \\t:€]*(' + amount + ')(?![\\d.,%])', 'gim')
  const values = [...text.matchAll(pattern)].map(match => {
    return toCents(match[1])
  }).filter(value => Number.isSafeInteger(value) && Math.abs(value) <= 1e10)
  return new Set(values).size === 1 ? values[0] : undefined
}

function toCents(text) {
  return Math.round(Number(text.replace(/\s/g, '').replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) * 100)
}

function findDate(text) {
  const match = text.match(/(?:fecha (?:de )?(?:emision(?: de)? factura|factura|documento)|date (?:de )?facture|(?:^|\n)\s*(?:fecha|date))\s*:?\s*(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/im)
  const columns = text.match(/(?:^|\n)[ \t]*numero[ \t]+fecha[ \t]*\n[ \t]*[a-z0-9/-]+[ \t]+(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/i)
  const parts = match || columns
  if (!parts) return
  const date = parts[3] + '-' + parts[2].padStart(2, '0') + '-' + parts[1].padStart(2, '0')
  const parsed = new Date(date)
  if (Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date) return date
}

function analyseText(name, text, mime) {
  const cleaned = fold(text)
  const category = findCategory(name, cleaned, mime)
  if (!cleaned.trim() || mime === 'text/csv') return { category, analysis: cleaned.trim() ? 'text' : 'filename' }
  const date = findDate(cleaned)
  const reference = (cleaned.match(/\b(?:n[.º° ]{1,5}(?:de )?factura|factura n[.º° ]{1,5}|numero (?:de )?factura)[ \t]*:?[ \t]*([a-z0-9][a-z0-9/-]{2,39})\b/i)?.[1] || cleaned.match(/(?:^|\n)[ \t]*numero[ \t]+fecha[ \t]*\n[ \t]*([a-z0-9/-]{3,39})[ \t]+\d/i)?.[1])?.toUpperCase()
  const electricity = category === 'utilities' &&
    cleaned.match(new RegExp('iva normal [0-9]+[ \\t]*%[ \\t]+s/[ \\t]*(' + amount + ')[. \\t]+(' + amount + ')[ \\t]*€', 'i'))
  const rent = category === 'rent' &&
    cleaned.match(new RegExp('base imponible[ \\t]*\\n[ \\t]*[0-9.,]+%[ \\t]*iva[ \\t]*\\n[ \\t]*[0-9.,]+%[ \\t]*irpf[ \\t]*\\n[ \\t]*(' + amount + ')[ \\t]*\\n[ \\t]*(' + amount + ')[ \\t]*\\n', 'i'))
  const pair = electricity || rent
  const baseCents = pair ? toCents(pair[1]) : matchCents(cleaned, 'base imponible|total ht')
  const vatCents = pair ? toCents(pair[2]) : matchCents(cleaned, 'cuota iva|total iva|total tva')
  const totalCents = (rent ? baseCents + vatCents : undefined) ?? matchCents(cleaned, 'total factura|importe total|total ttc|total')
  return { category, analysis: 'text', ...(date && { date }), ...(reference && { reference }),
    ...(totalCents !== undefined && { totalCents }), ...(baseCents !== undefined && { baseCents }), ...(vatCents !== undefined && { vatCents }) }
}

async function textFromAttachment(attachment) {
  if (attachment.mime === 'text/csv') return attachment.bytes.subarray(0, 8192).toString('utf8')
  if (attachment.mime !== 'application/pdf') return ''
  try {
    const { getDocumentProxy } = await import('unpdf')
    const doc = await getDocumentProxy(new Uint8Array(attachment.bytes), { isEvalSupported: false, stopAtErrors: true, verbosity: 0 })
    try {
      const pages = []
      for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''))
      }
      return pages.join('\n').slice(0, 24000)
    } finally {
      await doc.destroy()
    }
  } catch {
    return ''
  }
}

async function receiveInboxFile(blob, file) {
  const parsed = parseAttachment(file)
  if (!parsed) return { error: 'Choisis un PDF, une image ou un CSV de 3 Mo maximum.' }
  const sha = createHash('sha256').update(parsed.bytes).digest('hex')
  const id = [sha.slice(0,8), sha.slice(8,12), sha.slice(12,16), sha.slice(16,20), sha.slice(20,32)].join('-')
  const { hasInboxAttachment } = await import('../src/lib/gestoria-inbox.mjs')
  let item
  for (let attempt = 0; attempt < 4; attempt++) {
    const { revision, data } = await readWorkspace(blob, path)
    if (hasInboxAttachment(data, id)) return { duplicate: true }
    if ((data.inbox || []).length >= 180) return { error: 'La boîte de réception est pleine. Classe quelques pièces dans Mi Gestoría.' }
    if (!item) {
      const analysis = analyseText(parsed.name, await textFromAttachment(parsed), parsed.mime)
      const attachment = await storeAttachment(blob, file, id)
      item = { attachment, addedAt: new Date().toISOString(), ...analysis }
    }
    try {
      await blob.put(path, JSON.stringify({ ...data, inbox: [...(data.inbox || []), item] }), {
        access: 'private', addRandomSuffix: false, allowOverwrite: revision !== null, contentType: 'application/json',
        ...(revision !== null && { ifMatch: revision }),
      })
      return { received: true }
    } catch (error) {
      if (!(error instanceof blob.BlobPreconditionFailedError) &&
          !(revision === null && await blob.get(path, { access: 'private', useCache: false }))) throw error
    }
  }
  throw new Error('Concurrent inbox changes')
}

module.exports = { receiveInboxFile, analyseText, textFromAttachment }
