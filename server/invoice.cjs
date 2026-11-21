// Calcul et écriture d'une facture émise, identiques à l'onglet Clients (src/pages/GestoriaClients.jsx).
const crypto = require('crypto')

const EU_CODES = { France: 'FR', Belgique: 'BE', Allemagne: 'DE', Italie: 'IT', Portugal: 'PT', 'Pays-Bas': 'NL', Luxembourg: 'LU', Irlande: 'IE', Autriche: 'AT' }
const REGIMES = { es21: 'IVA 21 %', eu: 'Autoliquidation UE (0 %)', other: 'Hors UE (0 %)' }

function defaultRegime(client) {
  const pays = client.pays || 'Espagne'
  const pro = client.type !== 'particulier'
  if (pays === 'Espagne') return { regime: 'es21', irpf: pro ? 15 : 0 }
  if (EU_CODES[pays]) return { regime: pro ? 'eu' : 'es21', irpf: 0 }
  return { regime: 'other', irpf: 0 }
}

function computeInvoice(lignes, regime, irpf) {
  const lines = lignes.map(l => ({ ...l, totalCents: Math.round((Number(l.quantite) || 0) * (l.prixCents || 0)) }))
  const base = lines.reduce((s, l) => s + l.totalCents, 0)
  const quota = regime === 'es21' ? Math.round(base * 0.21) : 0
  const withholding = Math.round(base * (Number(irpf) || 0) / 100)
  return { lines, base, quota, withholding, total: base + quota - withholding }
}

function nextReference(entries, serie, year) {
  const prefix = serie + '-' + year + '-'
  const max = entries.filter(e => e.kind === 'invoice' && e.reference.startsWith(prefix))
    .map(e => parseInt(e.reference.slice(prefix.length), 10)).filter(Number.isFinite).reduce((m, n) => Math.max(m, n), 0)
  return prefix + String(max + 1).padStart(3, '0')
}

function buildEntry({ client, projet, date, reference, regime, irpf, echeance, t }) {
  const vat = {
    category: regime === 'es21' ? 'sale_es' : regime === 'eu' ? 'sale_eu' : 'sale_other', date,
    baseCents: t.base, quotaCents: t.quota, deductibleCents: 0,
    ...(regime === 'es21' && { rate: 21 }), ...(regime === 'eu' && { country: EU_CODES[client.pays] }),
  }
  return {
    id: 'inv_' + crypto.randomBytes(6).toString('hex'), kind: 'invoice', date,
    label: (client.nom + (projet ? ' · ' + projet.nom : '')).slice(0, 160), reference: reference.slice(0, 100),
    amountCents: t.total, payment: 'pending', source: client.source || 'direct', taxAmountCents: t.base,
    ...(t.withholding > 0 && { withholdingCents: t.withholding }), ...(echeance && { expectedPaymentDate: echeance }), vat,
  }
}

module.exports = { EU_CODES, REGIMES, defaultRegime, computeInvoice, nextReference, buildEntry }
