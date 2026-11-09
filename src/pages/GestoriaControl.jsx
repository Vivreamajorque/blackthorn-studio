import React from 'react'
import { inActivityYear } from '../lib/gestoria-calendar.mjs'
import { needsFilingReview } from '../lib/gestoria-dashboard.mjs'

export default function GestoriaControl({ dossier, entries, year, today, irpf, onOpen }) {
  const { filings, id, startDate } = dossier
  const pending = filings.filter(row => row.model !== 'RETA' &&
    (needsFilingReview(row, today) || ['missing', 'to_prepare'].includes(row.status)))
  const contributions = filings.filter(row => row.model === 'RETA' && row.date <= today &&
    !['filed', 'not_applicable'].includes(row.status))
  const proofs = filings.filter(row => row.status === 'filed' && !row.evidence?.reference)
  const invoices = entries.filter(row => inActivityYear(row.date, year, startDate) &&
    (row.taxAmountCents == null || (irpf?.basis === 'cash' && row.payment === 'paid' && !row.paymentDate)))
  const checks = [
    { label: 'Déclarations à vérifier', count: pending.length, action: 'Ouvrir les démarches', tab: 'tasks', model: pending[0]?.model },
    { label: 'Cotisations à pointer', count: contributions.length, action: 'Suivre la Seguridad Social', tab: 'tasks', model: 'RETA' },
    { label: 'Justificatifs à référencer', count: proofs.length, action: 'Enregistrer les reçus', tab: 'tasks', model: proofs[0]?.model },
    { label: 'Écritures à compléter', count: invoices.length, action: 'Ouvrir les factures et charges', tab: 'finance' },
  ]
  return <section className="mg-panel" aria-labelledby="mg-control">
    <div className="mg-panel-heading">
      <div><p className="mg-section-label">MON ACTIVITÉ · SUIVI</p><h2 id="mg-control">Ce qui reste à faire</h2></div>
    </div>
    <div className="mg-control-grid">
      {checks.map(({ label, count, action, tab, model }) => <button type="button" key={label}
        className="mg-control-card" onClick={() => onOpen(id, tab, model)}>
        <span className={count ? 'mg-tag warning' : 'mg-tag calm'}>{count}</span>
        <strong>{label}</strong><span>{action} <span aria-hidden="true">↗</span></span>
      </button>)}
    </div>
  </section>
}
