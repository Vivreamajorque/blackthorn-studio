import React from 'react'
import { vatCategories } from '../lib/gestoria-models.mjs'

export function editVat(vat, date) {
  return { category: vat?.category || '', date: vat?.date || date, rate: String(vat?.rate ?? 21),
    base: vat?.baseCents == null ? '' : String(vat.baseCents / 100),
    quota: vat?.quotaCents == null ? '' : String(vat.quotaCents / 100),
    deductible: vat?.deductibleCents == null ? '' : String(vat.deductibleCents / 100),
    country: vat?.country || '', id: vat?.id || '' }
}

export function saveVat(value) {
  if (!value.category) return undefined
  if (value.category === 'excluded') return { category: 'excluded' }
  const country = value.country.trim().toUpperCase()
  const id = value.id.replace(/[.\s-]/g, '').toUpperCase()
  const sale = value.category.startsWith('sale_')
  const eu = ['sale_eu', 'buy_eu'].includes(value.category)
  const cents = amount => Math.round(Number(amount) * 100)
  return {
    category: value.category, date: value.date, baseCents: cents(value.base),
    quotaCents: sale && value.category !== 'sale_es' ? 0 : cents(value.quota),
    deductibleCents: sale ? 0 : cents(value.deductible),
    ...(value.category === 'sale_es' && { rate: Number(value.rate) }),
    ...(eu && country && { country }),
    ...(eu && id && { id: country && id.startsWith(country) ? id.slice(2) : id }),
  }
}

export default function GestoriaVatFields({ value, invoice, onChange }) {
  const options = Object.entries(vatCategories).filter(([key]) => key === 'excluded' || key.startsWith(invoice ? 'sale_' : 'buy_'))
  const eu = ['sale_eu', 'buy_eu'].includes(value.category)
  const needsQuota = !['sale_other', 'sale_eu'].includes(value.category)
  const update = (key, input) => onChange({ ...value, [key]: input })
  return <fieldset className="mg-tax-settings">
    <legend>Préparation TVA et Modelo 349</legend>
    <label>Type d’opération vérifié <select value={value.category} onChange={e => update('category', e.target.value)}>
      <option value="">À vérifier</option>
      {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {value.category && value.category !== 'excluded' && <>
      <label>Date fiscale TVA <input type="date" required value={value.date} onChange={e => update('date', e.target.value)} /></label>
      <label>Base TVA en € <input required type="number" step="0.01" min="-100000000" max="100000000"
        value={value.base} onChange={e => update('base', e.target.value)} /></label>
      {value.category === 'sale_es' && <label>Taux <select value={value.rate} onChange={e => update('rate', e.target.value)}>
        {[0, 4, 10, 21].map(rate => <option key={rate}>{rate}</option>)}</select></label>}
      {needsQuota && <label>Montant de TVA en € <input required type="number" step="0.01" min="-100000000" max="100000000"
        value={value.quota} onChange={e => update('quota', e.target.value)} /></label>}
      {!invoice && <label>Part de TVA déductible en € <input type="number" step="0.01" min="-100000000" max="100000000"
        value={value.deductible} onChange={e => update('deductible', e.target.value)} /></label>}
      {eu && <>
        <label>Pays TVA <input maxLength={2} value={value.country} onChange={e => update('country', e.target.value)} /></label>
        <label>N° TVA intracommunautaire vérifié <input maxLength={24} value={value.id} onChange={e => update('id', e.target.value)} /></label>
      </>}
    </>}
  </fieldset>
}
