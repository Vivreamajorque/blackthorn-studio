import React, { useState } from 'react'
import { filingDeadline, formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { irpfForecast, minoracion } from '../lib/gestoria-irpf.mjs'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
const money = amount => euro.format(amount / 100)
const boxes = [['box07', '07'], ['box13', '13'], ['box15', '15'], ['box16', '16'], ['box19', '19']]
const euros = cents => cents == null ? '' : String(cents / 100)
const cents = value => Math.round(Number(value) * 100)

function Settings({ settings, canSave, onSave }) {
  const [basis, setBasis] = useState(settings.basis || 'accrual')
  const [priorNet, setPriorNet] = useState(euros(settings.priorNetCents))
  const [filed, setFiled] = useState(() => Object.fromEntries(Object.entries(settings.filed || {}).map(
    ([quarter, fields]) => [quarter, Object.fromEntries(boxes.map(([key]) => [key, euros(fields[key])]))],
  )))

  async function submit(event) {
    event.preventDefault()
    const reported = Object.fromEntries(Object.entries(filed).map(
      ([quarter, fields]) => [quarter, Object.fromEntries(boxes.filter(([key]) => key !== 'box13' || fields[key] !== '').map(([key]) => [key, cents(fields[key])]))],
    ))
    await onSave({ basis, ...(priorNet !== '' && { priorNetCents: cents(priorNet) }), filed: reported })
  }

  function toggleFiling(quarter, checked) {
    const next = { ...filed }
    if (checked) next[quarter] = { box07: '', box13: '', box15: '', box16: '', box19: '' }
    else delete next[quarter]
    setFiled(next)
  }

  return <details className="mg-chart-details">
    <summary>Vérifier la réduction du Modelo 130 et les réglages</summary>
    <form className="mg-tax-settings" onSubmit={submit}>
      <label>Critère IRPF <select value={basis} onChange={e => setBasis(e.target.value)}>
        <option value="accrual">Date de la prestation ou de la dépense (devengo)</option>
        <option value="cash">Date d’encaissement ou de paiement (cobros y pagos)</option>
      </select></label>
      <label>Bénéfice net fiscal des activités de l’année précédente, en €
        <input type="number" step="0.01" min="-100000000" max="100000000" placeholder="Montant à vérifier"
          value={priorNet} onChange={e => setPriorNet(e.target.value)} />
      </label>
      <p className="mg-muted">Jusqu’à 9 000 € de bénéfice net fiscal, la case 13 est de 100 € par trimestre. S’il n’y a eu aucune activité économique l’an dernier, saisis 0. Si tu as exercé, reprends le bénéfice net dans la Renta de l’année précédente.</p>
      {priorNet !== '' && <p role="status"><strong>Case 13 calculée · {money(minoracion(cents(priorNet)))}</strong></p>}
      <a href="https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html"
        target="_blank" rel="noopener noreferrer">Instructions de Hacienda pour la case 13 ↗</a>
      <p className="mg-muted">Renseigne les cases de tes déclarations déposées pour reprendre correctement leurs acomptes et reports dans le calcul suivant.</p>
      {[1, 2, 3, 4].map(quarter => <div className="mg-tax-filing" key={quarter}>
        <label><input type="checkbox" checked={Boolean(filed[quarter])}
          onChange={e => toggleFiling(quarter, e.target.checked)} /> T{quarter} déposé</label>
        {filed[quarter] && <div className="mg-tax-boxes">
          {boxes.map(([key, label]) => <label key={key}>Case [{label}]
            <input type="number" step="0.01" min={['box13', 'box15', 'box16'].includes(key) ? '0' : '-100000000'}
              max="100000000" required={key !== 'box13'} placeholder="0 si vide sur le 130" value={filed[quarter][key]}
              onChange={e => setFiled({ ...filed, [quarter]: { ...filed[quarter], [key]: e.target.value } })} />
          </label>)}
        </div>}
      </div>)}
      <div className="mg-card-actions"><button type="submit" disabled={!canSave}>Enregistrer les réglages</button></div>
    </form>
  </details>
}

export default function GestoriaIrpf({ year, startDate, entries, filings, settings = {}, canSave, onSave, onFinance, activityName = 'Mon activité' }) {
  const today = todayInSpain()
  const currentMonth = today.startsWith(year + '-') ? Number(today.slice(5, 7)) : 12
  const firstMonth = startDate?.startsWith(year + '-') ? Number(startDate.slice(5, 7)) - 1 : 0
  const forecast = irpfForecast(entries, { year, startDate, today, settings })
  const { missingAmount, missingDate, awaitingPayment } = forecast.excluded
  const unconfirmedFilings = filings.filter(row => row.model === '130' && row.status === 'filed' && !settings.filed?.[row.quarter])
  return <section className="mg-panel mg-evolution" aria-labelledby="mg-irpf">
    <div className="mg-panel-heading">
      <div><p className="mg-section-label">{activityName.toUpperCase()} · ESTIMATION</p><h2 id="mg-irpf">IRPF à prévoir</h2></div>
      <span className="mg-tag calm">Modelo 130</span>
    </div>
    <p className="mg-muted">Le 130 estimé se recalcule quand tu enregistres une facture ou une charge avec son montant fiscal. Il s’appuie sur le régime simplifié et les écritures suivies dans Mi Gestoría.
      {startDate?.startsWith(year + '-') && ' Pour ton 130, vérifie aussi les éventuelles opérations antérieures au ' + formatDate(startDate) + '.'}
    </p>
    <p className="mg-muted">{settings.basis === 'cash' ? 'Critère utilisé · Encaissements et paiements' : 'Critère utilisé · Date de rattachement (devengo)'}
      {' · '}{settings.priorNetCents == null ? 'Réduction [13] non intégrée · bénéfice antérieur à renseigner' : 'Réduction [13] intégrée · ' + money(forecast.deduction) + ' par trimestre'}</p>
    {(missingAmount > 0 || missingDate > 0 || awaitingPayment > 0) &&
      <div className="mg-inline-error">
        <p>{[
          missingAmount > 0 && missingAmount + ' montant(s) fiscal(aux) à compléter',
          missingDate > 0 && missingDate + ' date(s) de paiement à vérifier',
          awaitingPayment > 0 && awaitingPayment + ' facture(s) en attente de paiement',
        ].filter(Boolean).join(' · ')}.</p>
        <button type="button" onClick={onFinance}>Vérifier dans Compta</button>
      </div>}
    {!settings.basis && <p className="mg-card-note">Vérifie le critère dans les réglages avant d’utiliser cette estimation.</p>}
    {unconfirmedFilings.length > 0 &&
      <p className="mg-card-note">Cases du 130 déposé à renseigner pour {unconfirmedFilings.map(row => 'T' + row.quarter).join(', ')}.</p>}
    <div className="mg-tax-table">
      <table>
        <thead><tr><th scope="col">Trimestre</th><th scope="col">Échéance</th><th scope="col">Estimation</th><th scope="col">Montant déclaré</th></tr></thead>
        <tbody>{forecast.quarters.slice(Math.floor(firstMonth / 3)).map(({ quarter, due, filed }) => {
          const deadline = filingDeadline(year, quarter, '130')
          return <tr key={quarter}>
            <th scope="row">T{quarter}</th>
            <td>{formatDate(deadline.date)}{deadline.indicative && ' · à confirmer'}</td>
            <td>{due == null ? 'À calculer' : money(due)}</td>
            <td>{filed ? money(filed.box19) : '—'}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
    <details className="mg-chart-details">
      <summary>Voir la réserve mois par mois</summary>
      <p className="mg-muted">Variation à mettre de côté pendant le mois et réserve estimée pour le trimestre en cours à cette date.</p>
      <div className="mg-tax-table"><table>
        <thead><tr><th scope="col">Mois</th><th scope="col">Variation du mois</th><th scope="col">Réserve du trimestre</th></tr></thead>
        <tbody>{forecast.months.slice(firstMonth, currentMonth).map((month, i) => <tr key={i}>
          <th scope="row">{monthName.format(new Date(Date.UTC(year, firstMonth + i, 1)))}</th>
          <td>{month.hasData ? money(month.change) : '—'}</td><td>{month.hasData ? money(month.reserve) : '—'}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
    <Settings settings={settings} canSave={canSave} onSave={onSave} />
  </section>
}
