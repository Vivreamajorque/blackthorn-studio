import React from 'react'
import { formatDate, inActivityYear } from '../lib/gestoria-calendar.mjs'
import { forecastPayments, irpfForecast, minoracion } from '../lib/gestoria-irpf.mjs'
import { vatSummary } from '../lib/gestoria-models.mjs'
import GestoriaIrpf from './GestoriaIrpf'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const money = cents => euro.format(cents / 100)

function vatLabel(cents) {
  if (cents == null) return 'À calculer'
  if (cents === 0) return money(0)
  return money(Math.abs(cents)) + (cents > 0 ? ' à payer' : ' de solde en ta faveur')
}

function TaxCell({ official, estimate, filed, vat, paid, qualification }) {
  const format = vat ? vatLabel : value => value == null ? 'À calculer' : value < 0
    ? money(Math.abs(value)) + ' de résultat négatif' : money(value)
  if (filed) return <><strong>{official == null ? 'Montant à renseigner' : format(official)}</strong>
    <small>{paid ? 'Déposé · paiement confirmé' : 'Déposé'}</small></>
  return <><strong>{format(estimate)}</strong><small>{estimate == null ? 'Données à compléter' : qualification || 'Estimation'}</small></>
}

function FilingDate({ row, onOpen }) {
  return <button type="button" className="mg-quarter-date" onClick={onOpen}>
    {row.date ? 'Échéance ' + (row.indicative ? 'indicative · ' : '· ') + formatDate(row.date) : 'Échéance à vérifier'}
    {row.status === 'unknown' && ' · si applicable'} <span aria-hidden="true">→</span>
  </button>
}

export default function GestoriaTaxDashboard({ dossier, year, quarter, entries, settings, today, canSave, onSave, onOpen }) {
  const { id, name, startDate, filings } = dossier
  const forecast = irpfForecast(forecastPayments(entries, today), { year, startDate, today: year + '-12-31', settings })
  const current = filings.filter(row => row.quarter === quarter)
  const irpf = current.find(row => row.model === '130')
  const vat = current.find(row => row.model === '303')
  const calculation = vatSummary(entries, { year, quarter, startDate, today })
  const tax = forecast.quarters[quarter - 1]
  const otherModels = current.filter(row => !['130', '303'].includes(row.model) && row.status !== 'not_applicable')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const active = entries.filter(row => inActivityYear(row.date, year, startDate))
  const unqualified = active.filter(row => row.kind === 'expense' && (row.taxAmountCents == null || !row.vat || row.taxReview))
  const noProof = active.filter(row => row.kind === 'expense' && row.taxAmountCents !== 0 && !row.attachment)
  const vatToCheck = active.filter(row => row.kind === 'expense' && row.vat?.quotaCents > 0 && !row.taxReview &&
    row.vat?.deductibleCents === 0 && !['personal', 'social'].includes(row.expenseCategory))
  const priorMissing = settings?.priorNetCents == null
  const notEntered = filings.filter(row => ['130', '303'].includes(row.model) && row.status === 'filed' &&
    row.evidence?.amountCents == null && (row.model !== '130' || !settings?.filed?.[row.quarter]))
  const registered130 = filings.some(row => row.model === '130' && row.status !== 'not_applicable')
  return <>
    <section className="mg-panel" aria-labelledby="mg-quarterly-tax">
      <div className="mg-panel-heading"><div><p className="mg-section-label">{name.toUpperCase()}</p>
        <h2 id="mg-quarterly-tax">Ce que je dois déclarer ou prévoir · T{quarter}</h2></div></div>
      <p className="mg-muted">Les dates concernent le dépôt. Les estimations évoluent avec tes écritures et les justificatifs que tu ajoutes.</p>
      {!irpf && !vat && <p className="mg-muted">Aucune échéance de déclaration suivie pour ce trimestre dans ce dossier.</p>}
      <div className="mg-quarter-tax">
        {irpf && <article>
          <h3>Acompte sur le revenu · 130</h3>
          {irpf.status === 'not_applicable' ? <span>Non applicable</span> : <>
            <TaxCell official={irpf.evidence?.amountCents ?? tax.filed?.box19} estimate={id === 'blackthorn' && !settings ? null : tax.due}
              filed={irpf.status === 'filed' || Boolean(tax.filed)} paid={irpf.evidence?.paid}
              qualification={priorMissing ? 'Estimation sans la case 13' : 'Estimation · case 13 incluse'} />
            <FilingDate row={irpf} onOpen={() => onOpen(id, 'tasks', '130', true)} />
          </>}
        </article>}
        {vat && <article>
          <h3>TVA · 303</h3>
          {vat.status === 'not_applicable' ? <span>Non applicable</span> : <>
            <TaxCell vat official={vat.evidence?.amountCents} estimate={calculation.balance} filed={vat.status === 'filed'} paid={vat.evidence?.paid}
              qualification={calculation.missing.length ? 'Estimation partielle · lignes à vérifier' : 'Estimation avant reports'} />
            <FilingDate row={vat} onOpen={() => onOpen(id, 'tasks', '303', true)} />
            {calculation.balance != null && <small>TVA due brute {money(calculation.boxes['27'])} · TVA déductible {money(calculation.boxes['45'])}</small>}
          </>}
        </article>}
      </div>
      {otherModels.length > 0 && <details className="mg-more">
        <summary>Autres modèles du trimestre, selon tes obligations</summary>
        <ul className="mg-action-list">
          {otherModels.map(row => <li key={row.key}>
            <strong>Modelo {row.model}</strong>{row.status === 'filed' && <small> · Déposé</small>}
            <FilingDate row={row} onOpen={() => onOpen(id, 'tasks', row.model, true)} />
          </li>)}
        </ul>
      </details>}
      {id === 'blackthorn' && <p className="mg-muted">Le Hub fournit les encaissements. Les estimations fiscales utilisent les écritures qualifiées dans Mi Gestoría.</p>}
      <div className="mg-card-actions">
        <button type="button" onClick={() => onOpen(id, 'tasks', 'all', true)}>Voir les déclarations →</button>
        <button type="button" onClick={() => onOpen(id, 'archives')}>Ouvrir les archives →</button>
      </div>
    </section>
    <details className="mg-more">
      <summary>Voir les contrôles et le calcul détaillé des impôts</summary>
      <div className="mg-dashboard mg-more-body">
    <section className="mg-panel" aria-labelledby="mg-actions">
      <div className="mg-panel-heading"><div><p className="mg-section-label">À VÉRIFIER POUR CE DOSSIER</p>
        <h2 id="mg-actions">Les contrôles qui peuvent changer le montant</h2></div></div>
      <ul className="mg-action-list">
        {registered130 && <li><strong>{priorMissing ? 'Case 13 · réduction à vérifier' : 'Case 13 · ' + money(minoracion(settings.priorNetCents)) + ' intégrés à l’estimation'}</strong>
          <p>{priorMissing ? 'Si ton bénéfice net de l’année précédente est de 9 000 € ou moins, la réduction peut être de 100 € par trimestre.' : 'Le calcul se base sur le bénéfice net fiscal que tu as renseigné.'}</p></li>}
        {unqualified.length > 0 && <li><strong>{unqualified.length} dépense(s) à qualifier</strong>
          <p>Vérifie séparément la charge déductible et la TVA récupérable. Les montants inconnus peuvent fausser la prévision.</p>
          <button type="button" onClick={() => onOpen(id, 'finance')}>Vérifier les dépenses →</button></li>}
        {vatToCheck.length > 0 && <li><strong>{vatToCheck.length} dépense(s) avec de la TVA saisie et aucune part déduite</strong>
          <p>Si la dépense donne droit à déduction, complète sa part récupérable après avoir vérifié le justificatif. Laisse 0 si la TVA est effectivement exclue.</p>
          <button type="button" onClick={() => onOpen(id, 'finance')}>Vérifier la TVA →</button></li>}
        {noProof.length > 0 && <li><strong>{noProof.length} dépense(s) sans pièce rattachée</strong>
          <p>Ajoute le justificatif ou demande une facture si le ticket ne suffit pas.</p>
          <button type="button" onClick={() => onOpen(id, 'finance')}>Ajouter des justificatifs →</button></li>}
        {notEntered.length > 0 && <li><strong>{notEntered.length} montant(s) de déclaration à recopier</strong>
          <p>Renseigne les chiffres des formulaires déposés pour pouvoir comparer avec le registre.</p>
          <button type="button" onClick={() => onOpen(id, 'tasks', notEntered[0].model, true)}>Ouvrir les déclarations →</button></li>}
      </ul>
      {!registered130 && !unqualified.length && !vatToCheck.length && !noProof.length && !notEntered.length && <p>Aucun contrôle détecté sur les écritures renseignées.</p>}
    </section>
    {registered130 && <GestoriaIrpf key={id + ':' + year} year={year} startDate={startDate} entries={entries} filings={filings}
      settings={settings} canSave={canSave} onSave={onSave} activityName={name} onFinance={() => onOpen(id, 'finance')} />}
      </div>
    </details>
  </>
}
