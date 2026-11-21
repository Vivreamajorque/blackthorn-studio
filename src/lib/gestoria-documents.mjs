// Devis et factures imprimables : un seul modèle pour les deux, en français avec les mentions espagnoles
// (Real Decreto 1619/2012 : numéro, date, émetteur et destinataire avec NIF et adresse, description, base,
// taux, cuota, total ; en autoliquidation, mention d'inversion du sujet passif et numéro de TVA du client).

const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const nl = v => esc(v).replace(/\n/g, '<br>')
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const money = cents => euro.format((cents || 0) / 100)
const day = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''
const iban = v => String(v || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

export const REGIME_LABEL = { es21: 'IVA 21 %', eu: 'Autoliquidation UE (0 %)', other: 'Hors UE (0 %)' }

// Mentions fiscales obligatoires selon le régime (texte espagnol de référence, puis français).
export const LEGAL_MENTION = {
  es21: { es: '', fr: '' },
  eu: {
    es: 'Operación no sujeta a IVA en España por reglas de localización (art. 69.Uno.1.º Ley 37/1992). Inversión del sujeto pasivo (art. 196 Directiva 2006/112/CE).',
    fr: 'Opération non soumise à la TVA espagnole. Autoliquidation de la TVA par le preneur.',
  },
  other: {
    es: 'Operación no sujeta a IVA en España por reglas de localización (art. 69 Ley 37/1992).',
    fr: 'Opération non soumise à la TVA espagnole.',
  },
}

export function totalsOf(lignes, regime, irpf = 0) {
  const lines = lignes.map(l => ({ ...l, cents: Math.round((Number(l.quantite) || 0) * (l.prixCents || 0)) }))
  const base = lines.reduce((s, l) => s + l.cents, 0)
  const quota = regime === 'es21' ? Math.round(base * 0.21) : 0
  const withholding = Math.round(base * (Number(irpf) || 0) / 100)
  return { lines, base, quota, withholding, total: base + quota - withholding }
}

// Ce qui manque pour qu'un document soit conforme (bloque l'émission d'une facture).
export function missingForInvoice({ emetteur = {}, client = {}, regime }) {
  const missing = []
  if (!String(emetteur.nom || '').trim()) missing.push('ton nom')
  if (!String(emetteur.nif || '').trim()) missing.push('ton NIF')
  if (!String(emetteur.adresse || '').trim()) missing.push('ton adresse')
  if (!String(client.raisonSociale || client.nom || '').trim()) missing.push('le nom du client')
  if (!String(client.adresse || '').trim()) missing.push('l’adresse du client')
  if (regime === 'eu' && !String(client.nif || '').trim()) missing.push('le numéro de TVA du client')
  return missing
}

const CSS = `
@page{size:A4;margin:16mm 16mm 18mm}
*{box-sizing:border-box}
body{font:13.5px/1.5 "Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;color:#14201e;margin:0;padding:28px;max-width:820px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.es{color:#6b7a76;font-weight:400}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #17575b}
.who strong{display:block;font-size:20px;letter-spacing:-.01em}.who span{color:#4b5d59}
.num{text-align:right}.num small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#17575b;font-weight:700}
.num b{display:block;font-size:26px;letter-spacing:-.02em;line-height:1.15}
.meta{display:flex;gap:28px;flex-wrap:wrap;margin:18px 0 6px}.meta div{min-width:120px}.meta small{display:block;font-size:11px;color:#6b7a76}.meta b{font-weight:600}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
.card{background:#f3f7f6;border-radius:10px;padding:14px 16px}.card small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#17575b;font-weight:700;margin-bottom:4px}
.card p{margin:0}.card .nm{font-weight:700;font-size:14.5px}
.intro{margin:6px 0 14px}
table{border-collapse:collapse;width:100%;margin-top:6px}
th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7a76;text-align:left;padding:8px 10px;border-bottom:1.5px solid #14201e}
td{padding:11px 10px;border-bottom:1px solid #dde6e3;vertical-align:top}
th.n,td.n{text-align:right;white-space:nowrap}
.tot{width:320px;margin:16px 0 0 auto}.tot div{display:flex;justify-content:space-between;padding:5px 10px}
.tot .g{background:#17575b;color:#fff;border-radius:8px;font-size:16px;font-weight:700;margin-top:6px;padding:10px}
.legal{margin:18px 0 0;padding:12px 14px;border-left:3px solid #e3b13a;background:#fbf5e3;font-size:12.5px}
.legal p{margin:0 0 4px}.legal p:last-child{margin:0}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#17575b;margin:24px 0 6px}
ul{margin:4px 0 0;padding-left:20px}li{margin:2px 0}
.pay{display:grid;grid-template-columns:auto 1fr;gap:3px 16px;margin-top:6px}.pay span{color:#6b7a76}
.sig{display:grid;grid-template-columns:1.4fr 1fr 1.6fr;gap:22px;margin-top:14px}.sig div{border-top:1px solid #14201e;padding-top:6px;min-height:78px;font-size:12px;color:#4b5d59}
.muted{color:#4b5d59;font-size:12.5px}
footer{margin-top:30px;padding-top:10px;border-top:1px solid #dde6e3;font-size:11.5px;color:#6b7a76;text-align:center}
.avoid{break-inside:avoid}
`

export function buildDocumentHtml({ kind, numero, date, due, serviceDate, validite, regime, irpf, lignes, note, intro, perimetre = [], echeances = [], outils,
  devisRef, projet, client, emetteur }) {
  const isDevis = kind === 'devis'
  const t = totalsOf(lignes, regime, irpf)
  const legal = LEGAL_MENTION[regime] || LEGAL_MENTION.es21
  const clientName = client.raisonSociale || client.nom
  const rows = t.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${esc(String(l.quantite).replace('.', ','))}</td><td class="n">${money(l.prixCents)}</td><td class="n">${money(l.cents)}</td></tr>`).join('')
  const meta = [
    ['Date d’émission <span class="es">· Fecha</span>', day(date)],
    isDevis && validite ? ['Valable jusqu’au <span class="es">· Válido hasta</span>', day(validite)] : null,
    !isDevis && due ? ['Échéance <span class="es">· Vencimiento</span>', day(due)] : null,
    !isDevis && serviceDate && serviceDate !== date ? ['Date de l’opération <span class="es">· Fecha de operación</span>', day(serviceDate)] : null,
    projet ? ['Projet', esc(projet)] : null,
    !isDevis && devisRef ? ['Devis', esc(devisRef)] : null,
  ].filter(Boolean).map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')
  const schedule = isDevis && echeances.length ? `<div class="avoid"><h2>Échéancier</h2><table><thead><tr><th>Échéance</th><th>Date</th><th class="n">Montant</th></tr></thead><tbody>${
    echeances.map(e => `<tr><td>${esc(e.label)}</td><td>${e.date ? day(e.date) : '—'}</td><td class="n">${money(e.montantCents)}</td></tr>`).join('')
  }<tr><td><strong>Total à régler</strong></td><td></td><td class="n"><strong>${money(echeances.reduce((s, e) => s + e.montantCents, 0))}</strong></td></tr></tbody></table></div>` : ''
  const vatLine = regime === 'eu' && client.nif ? `<p><b>TVA du client :</b> ${esc(client.nif)}</p>` : ''
  const legalBlock = legal.es || vatLine || note ? `<div class="legal avoid">${vatLine}${legal.es ? `<p>${esc(legal.es)}</p><p class="muted">${esc(legal.fr)}</p>` : ''}${note ? `<p>${esc(note)}</p>` : ''}</div>` : ''
  const payment = !isDevis && emetteur.iban ? `<div class="avoid"><h2>Paiement <span class="es">· Pago</span></h2><div class="pay"><span>Virement</span><b>${esc(iban(emetteur.iban))}</b>
    <span>Bénéficiaire</span><b>${esc(emetteur.nom)}</b><span>Référence</span><b>${esc(numero)}</b></div></div>` : ''
  const title = isDevis ? 'Devis <span class="es">· Presupuesto</span>' : 'Facture <span class="es">· Factura</span>'
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${isDevis ? 'Devis' : 'Facture'} ${esc(numero)}</title><style>${CSS}</style>
<header><div class="who"><strong>${esc(emetteur.nom)}</strong><span>${esc(emetteur.activite)}</span></div>
<div class="num"><small>${title}</small><b>${esc(numero)}</b></div></header>
<div class="meta">${meta}</div>
<div class="parties">
<div class="card"><small>${isDevis ? 'Prestataire' : 'Émetteur <span class="es">· Emisor</span>'}</small><p class="nm">${esc(emetteur.nom)}</p>
<p>${emetteur.nif ? 'NIF : ' + esc(emetteur.nif) + '<br>' : ''}${nl(emetteur.adresse)}${emetteur.email ? '<br>' + esc(emetteur.email) : ''}</p></div>
<div class="card"><small>${isDevis ? 'Cliente' : 'Client <span class="es">· Cliente</span>'}</small><p class="nm">${esc(clientName)}</p>
<p>${client.nif ? (regime === 'eu' ? 'TVA : ' : 'NIF : ') + esc(client.nif) + '<br>' : ''}${nl(client.adresse)}</p></div></div>
${intro ? `<p class="intro">${nl(intro)}</p>` : ''}
<table><thead><tr><th>${isDevis ? 'Prestation' : 'Description <span class="es">· Concepto</span>'}</th><th class="n">Qté</th><th class="n">Prix HT</th><th class="n">Montant HT</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot avoid"><div><span>Base imposable <span class="es">· Base imponible</span></span><span>${money(t.base)}</span></div>
<div><span>IVA ${regime === 'es21' ? '21' : '0'} %</span><span>${money(t.quota)}</span></div>
${t.withholding ? `<div><span>Retención IRPF ${esc(irpf)} %</span><span>− ${money(t.withholding)}</span></div>` : ''}
<div class="g"><span>${isDevis ? 'Total du devis' : 'Total à payer'}</span><span>${money(t.total)}</span></div></div>
${legalBlock}
${isDevis && perimetre.length ? `<div class="avoid"><h2>Périmètre</h2><ul>${perimetre.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="muted">Tout ce qui n’est pas listé est chiffré séparément, après accord de la cliente.</p></div>` : ''}
${schedule}
${isDevis && outils ? `<div class="avoid"><h2>Frais des outils</h2><p>${nl(outils)}</p></div>` : ''}
${payment}
${isDevis ? `<div class="avoid"><h2>Bon pour accord</h2><p class="muted">En signant, la cliente accepte les prestations, les prix et les modalités de règlement de ce devis.</p>
<div class="sig"><div>Nom et qualité</div><div>Date</div><div>Signature</div></div></div>` : ''}
<footer>${esc(emetteur.nom)}${emetteur.nif ? ' · NIF ' + esc(emetteur.nif) : ''}${emetteur.email ? ' · ' + esc(emetteur.email) : ''}</footer>
<script>window.onload=()=>window.print()</script></html>`
}

export function printDocument(options) {
  const url = URL.createObjectURL(new Blob([buildDocumentHtml(options)], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
