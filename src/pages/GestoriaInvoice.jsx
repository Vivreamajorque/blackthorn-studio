import React, { useEffect, useRef, useState } from 'react'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const money = cents => euro.format(cents / 100)
const textFields = [
  ['issuer', 'Nom ou raison sociale de l’émetteur'], ['issuerId', 'NIF de l’émetteur'], ['issuerAddress', 'Adresse de l’émetteur'],
  ['client', 'Nom ou raison sociale du client'], ['clientId', 'NIF / TVA du client, si applicable'], ['clientAddress', 'Adresse et pays du client'],
  ['reference', 'Numéro et série à vérifier'], ['description', 'Description de la prestation'],
]

export default function GestoriaInvoice({ date, onPrepare, initiallyOpen = false }) {
  const [draft, setDraft] = useState({ date, rate: '21', serviceDate: '', note: '', withholding: '' })
  const panel = useRef(null)
  useEffect(() => {
    if (initiallyOpen) { panel.current?.scrollIntoView({ block: 'start' }); panel.current?.querySelector('input')?.focus({ preventScroll: true }) }
  }, [initiallyOpen])
  const [preview, setPreview] = useState('')
  function update(key, value) { setDraft(previous => ({ ...previous, [key]: value })) }
  const base = Math.round(Number(draft.base || 0) * 100)
  const quota = Math.round(base * Number(draft.rate) / 100)
  const withholding = Math.round(base * Number(draft.withholding || 0) / 100)
  const total = base + quota - withholding

  function renderDraft(event) {
    event.preventDefault()
    const doc = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Borrador de factura</title><style>
    body{font:16px system-ui,sans-serif;max-width:760px;margin:50px auto;padding:18px;color:#17362d}h1{margin-bottom:0}
    section{display:flex;gap:36px;margin:24px 0}section div{flex:1}table{border-collapse:collapse;width:100%}
    th,td{padding:12px;text-align:left;border-bottom:1px solid #cedbd5}dt{font-weight:700}dd{margin:0}
    </style><h1>Borrador de factura</h1><p>${escape(draft.reference)} · ${escape(draft.date)}</p>
    <section><div><strong>Emisor</strong><p>${escape(draft.issuer)}<br>${escape(draft.issuerId)}<br>${escape(draft.issuerAddress)}</p></div>
    <div><strong>Cliente</strong><p>${escape(draft.client)}<br>${escape(draft.clientId || '')}<br>${escape(draft.clientAddress)}</p></div></section>
    <p>${draft.serviceDate ? 'Fecha de operación: ' + escape(draft.serviceDate) : ''}</p>
    <table><thead><tr><th>Concepto</th><th>Base</th><th>IVA</th><th>Retención IRPF</th><th>Total a pagar</th></tr></thead>
    <tbody><tr><td>${escape(draft.description)}</td><td>${money(base)}</td><td>${escape(draft.rate)} % · ${money(quota)}</td>
    <td>${money(withholding)}</td><td>${money(total)}</td></tr></tbody></table>
    <p>${escape(draft.note || '')}</p></html>`
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' })))
  }

  return <details ref={panel} open={initiallyOpen || undefined} className="mg-chart-details mg-invoice-composer">
    <summary>＋ Créer une facture · préparer le brouillon</summary>
    <form className="mg-tax-settings" onSubmit={renderDraft}>
      <p className="mg-muted">Le brouillon peut être enregistré en PDF depuis l’impression du navigateur. Vérifie la série, le régime et les mentions avant émission.</p>
      <div className="mg-tax-boxes">
        {textFields.map(([key, label]) => <label key={key}>{label}
          <input required={key !== 'clientId'} maxLength={key === 'reference' ? 100 : 160} value={draft[key] || ''} onChange={e => update(key, e.target.value)} />
        </label>)}
        <label>Date d’émission <input type="date" required value={draft.date} onChange={e => update('date', e.target.value)} /></label>
        <label>Date de prestation, si différente <input type="date" value={draft.serviceDate} onChange={e => update('serviceDate', e.target.value)} /></label>
        <label>Base HT en € <input type="number" step="0.01" min="0.01" max="100000000" required value={draft.base || ''} onChange={e => update('base', e.target.value)} /></label>
        <label>Taux TVA <select value={draft.rate} onChange={e => update('rate', e.target.value)}>
          {[0, 4, 10, 21].map(rate => <option key={rate}>{rate}</option>)}
        </select></label>
        <label>Retenue IRPF en %, si applicable <input type="number" step="0.01" min="0" max="100" value={draft.withholding} onChange={e => update('withholding', e.target.value)} /></label>
      </div>
      <label>Mention fiscale ou conditions de paiement
        <input required={draft.rate === '0'} maxLength={400} value={draft.note} onChange={e => update('note', e.target.value)} />
      </label>
      <p>Total à payer <strong>{money(total)}</strong></p>
      <button type="submit">Préparer l’aperçu</button>
      {preview && <a href={preview} target="_blank" rel="noopener noreferrer">Ouvrir et imprimer le brouillon ↗</a>}
      {preview && <button type="button" onClick={() => onPrepare({ label: draft.client, reference: draft.reference, date: draft.date,
        taxDate: draft.serviceDate, amount: String(total / 100), taxAmount: String(base / 100), withholding: String(withholding / 100) })}>Préremplir l’écriture de la facture émise</button>}
    </form>
  </details>
}
