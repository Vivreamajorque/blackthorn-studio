import React from 'react'
import { formatDate, inActivityYear, monthEnd } from '../lib/gestoria-calendar.mjs'
import { forecastPayments, irpfForecast, minoracion } from '../lib/gestoria-irpf.mjs'
import { rentWithholdings } from '../lib/gestoria-filing-audit.mjs'
import { models, vatSummary } from '../lib/gestoria-models.mjs'
import { studioEstimateEntries } from '../lib/gestoria-quarter-estimates.mjs'
import GestoriaIrpf from './GestoriaIrpf'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const money = cents => euro.format(cents / 100)

function vatLabel(cents) {
  if (cents == null) return 'À calculer'
  if (cents === 0) return money(0)
  return money(Math.abs(cents)) + (cents > 0 ? ' à payer' : ' de solde en ta faveur')
}

function TaxCell({ official, estimate, filed, vat, paid, proof, qualification }) {
  const format = vat ? vatLabel : value => value == null ? 'À calculer' : value < 0
    ? money(Math.abs(value)) + ' de résultat négatif' : money(value)
  if (filed) return <><strong>{official == null ? 'Montant à renseigner' : format(official)}</strong>
    <small>{proof ? 'Déclaré · pièce jointe' : 'Dépôt indiqué · reçu à joindre'}{paid && ' · paiement pointé'}</small></>
  return <><strong>{format(estimate)}</strong><small>{estimate == null ? 'Données à compléter' : qualification || 'Estimation'}</small></>
}

function FilingDate({ row, onOpen }) {
  return <button type="button" className="mg-quarter-date" onClick={onOpen}>
    {row.date ? 'Échéance ' + (row.indicative ? 'indicative · ' : '· ') + formatDate(row.date) : 'Échéance à vérifier'}
    {row.status === 'unknown' && ' · si applicable'} <span aria-hidden="true">→</span>
  </button>
}

export default function GestoriaTaxDashboard({ dossier, year, quarter, entries, settings, today, contributions, studio, canSave, onSave, onOpen }) {
  const { id, name, startDate, filings } = dossier
  const fiscalEntries = [...entries, ...contributions.confirmedRows]
  const scenario = studioEstimateEntries(fiscalEntries, studio?.data?.receipts, { year, startDate, today })
  const irpfEntries = [...forecastPayments(scenario.entries, today), ...contributions.projectedRows]
  const forecastOptions = { year, startDate, today: year + '-12-31' }
  const forecast = irpfForecast(irpfEntries, { ...forecastOptions, settings })
  const current = filings.filter(row => row.quarter === quarter)
  const irpf = current.find(row => row.model === '130')
  const vat = current.find(row => row.model === '303')
  const rentFiling = current.find(row => row.model === '115')
  const rent = rentFiling && rentFiling.status !== 'not_applicable'
    ? rentWithholdings(entries, { year, quarter, startDate, today }) : null
  const calculation = vatSummary(scenario.entries, { year, quarter, startDate, today })
  const tax = forecast.quarters[quarter - 1]
  const archivedDraft303 = dossier.record.archives?.some(item =>
    item.type === 'draft' && item.model === '303' && item.quarter === quarter)
  const quarterContributions = contributions.periods.filter(row => row.applicable && Math.ceil(row.month / 3) === quarter)
  const paidContributions = quarterContributions.filter(row => row.confirmed != null)
  const plannedContributions = quarterContributions.filter(row => row.projected != null)
  const paidTotal = paidContributions.reduce((sum, row) => sum + row.confirmed, 0)
  const plannedTotal = plannedContributions.reduce((sum, row) => sum + row.projected, 0)
  const missingContributions = quarterContributions.length - paidContributions.length - plannedContributions.length
  const actual130 = irpf?.evidence?.amountCents ?? tax.filed?.box19
  const actual303 = vat?.evidence?.amountCents
  const filed130 = irpf?.status === 'filed' || Boolean(tax.filed)
  const filed303 = vat?.status === 'filed'
  const quarterEnd = monthEnd(year, quarter * 3)
  const studioRevenue = scenario.entries.some(row => row.kind === 'invoice' && row.taxAmountCents != null &&
    inActivityYear(row.date, year, startDate) && row.date <= quarterEnd)
  const estimate130 = studio && !studioRevenue ? null : tax.due
  const estimate303 = studio && !studioRevenue ? null : calculation.balance
  const priorMissing = settings?.priorNetCents == null
  const reductionScenario = priorMissing && !filed130 && estimate130 != null
    ? irpfForecast(irpfEntries, { ...forecastOptions, settings: { ...settings, priorNetCents: 900000 } }).quarters[quarter - 1].due
    : null
  const earlierIrpfEstimated = forecast.quarters.slice(0, quarter - 1).some(prior =>
    prior.fields['07'] > 0 && !prior.filed &&
    filings.some(row => row.model === '130' && row.quarter === prior.quarter && row.status !== 'not_applicable'))
  const vatPending = entries.filter(row => {
    if (row.kind !== 'expense' || !row.vat?.category.startsWith('buy_') ||
        !(row.vat.quotaCents > row.vat.deductibleCents) || ['personal', 'social'].includes(row.expenseCategory)) return false
    const date = row.vat.date || row.date
    return inActivityYear(date, year, startDate) && date <= today && Math.ceil(Number(date.slice(5, 7)) / 3) === quarter
  })
  const outstandingVat = row => row.vat.quotaCents - row.vat.deductibleCents
  const pendingVatTotal = vatPending.reduce((sum, row) => sum + outstandingVat(row), 0)
  const pendingRentVat = id === 'blackthorn' ? vatPending.filter(row => row.vat.category === 'buy_es' &&
    row.attachment && row.documentAmounts?.rentWithholdingCents != null).reduce((sum, row) => sum + outstandingVat(row), 0) : 0
  const taxAmounts = [
    irpf && irpf.status !== 'not_applicable' && { paid: irpf.evidence?.paid, amount: filed130 ? actual130 : estimate130 },
    vat && vat.status !== 'not_applicable' && { paid: vat.evidence?.paid, amount: filed303 ? actual303 : estimate303 },
  ].filter(Boolean)
  const knownTaxAmounts = taxAmounts.filter(row => row.paid || row.amount != null)
  const reserve = knownTaxAmounts.reduce((sum, row) => sum + (row.paid ? 0 : Math.max(0, row.amount)), 0)
  const otherModels = current.filter(row => !['130', '303'].includes(row.model) && row.status !== 'not_applicable')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const active = entries.filter(row => inActivityYear(row.date, year, startDate))
  const unqualified = active.filter(row => row.kind === 'expense' && (row.taxAmountCents == null || !row.vat || row.taxReview))
  const noProof = active.filter(row => row.kind === 'expense' && row.taxAmountCents !== 0 && !row.attachment)
  const vatToCheck = active.filter(row => row.kind === 'expense' && row.vat?.quotaCents > 0 && !row.taxReview &&
    row.vat?.deductibleCents === 0 && !['personal', 'social'].includes(row.expenseCategory))
  const notEntered = filings.filter(row => ['130', '303'].includes(row.model) && row.status === 'filed' &&
    row.evidence?.amountCents == null && (row.model !== '130' || !settings?.filed?.[row.quarter]))
  const registered130 = filings.some(row => row.model === '130' && row.status !== 'not_applicable')
  return <>
    <section className="mg-panel" aria-labelledby="mg-quarterly-tax">
      <div className="mg-panel-heading"><div><p className="mg-section-label">{name.toUpperCase()}</p>
        <h2 id="mg-quarterly-tax">Estimatif du trimestre · T{quarter}</h2></div></div>
      <p className="mg-muted">Les dates concernent le dépôt. Les estimations évoluent avec tes écritures et les justificatifs que tu ajoutes.</p>
      {knownTaxAmounts.length > 0 && <div className="mg-quarter-reserve">
        <span>À mettre de côté pour Hacienda · 130 + 303</span><strong>{money(reserve)}</strong>
        <small>{knownTaxAmounts.length < taxAmounts.length ? 'Total partiel · montant d’un modèle à compléter' : 'Montants déclarés ou estimés · paiements pointés déduits'}</small>
      </div>}
      {!irpf && !vat && <p className="mg-muted">Aucune échéance de déclaration suivie pour ce trimestre dans ce dossier.</p>}
      <div className="mg-quarter-tax">
        {irpf && <article>
          <h3>Acompte sur le revenu · 130</h3>
          {irpf.status === 'not_applicable' ? <span>Non applicable</span> : <>
            <TaxCell official={actual130} estimate={estimate130}
              filed={filed130} paid={irpf.evidence?.paid} proof={irpf.evidence?.attachment}
              qualification={priorMissing ? 'Estimation · case 13 à vérifier' : 'Estimation · case 13 incluse'} />
            {reductionScenario != null && <small>Si la réduction de 100 € s’applique · {money(reductionScenario)} à payer</small>}
            {!filed130 && estimate130 != null && earlierIrpfEstimated &&
              <small>Les acomptes précédents sont estimés. Renseigne les cases des 130 déposés pour fiabiliser ce montant.</small>}
            {!filed130 && estimate130 != null && tax.fields['02'] != null &&
              <small>Charges et forfait retenus depuis janvier · {money(tax.fields['02'])}</small>}
            <FilingDate row={irpf} onOpen={() => onOpen(id, 'tasks', '130', true)} />
          </>}
        </article>}
        {vat && <article>
          <h3>TVA · 303</h3>
          {vat.status === 'not_applicable' ? <span>Non applicable</span> : <>
            <TaxCell vat official={actual303} estimate={estimate303} filed={filed303} paid={vat.evidence?.paid} proof={vat.evidence?.attachment}
              qualification={calculation.missing.length ? 'Estimation partielle · lignes à vérifier' : 'Estimation avant reports'} />
            <FilingDate row={vat} onOpen={() => onOpen(id, 'tasks', '303', true)} />
            {archivedDraft303 && vat.status !== 'filed' && <small>Brouillon archivé · dépôt à vérifier</small>}
            {calculation.balance != null && <small>TVA collectée {money(calculation.boxes['27'])} · TVA déductible retenue {money(calculation.boxes['45'])}</small>}
            {pendingVatTotal > 0 && <details className="mg-chart-details">
              <summary>{money(pendingVatTotal)} de TVA sur les dépenses à vérifier</summary>
              <ul>{vatPending.map(row => <li key={row.id}>
                <strong>{row.label} · {money(outstandingVat(row))}</strong>
                <small>{row.taxReview || 'Vérifie la part récupérable sur la facture.'}</small>
              </li>)}</ul>
              <button type="button" onClick={() => onOpen(id, 'finance')}>Ouvrir les dépenses →</button>
            </details>}
            {!filed303 && estimate303 != null && pendingRentVat > 0 &&
              <small>Si la TVA du loyer est récupérable · {vatLabel(estimate303 - pendingRentVat)} avec {money(pendingRentVat)} de déduction supplémentaire.</small>}
          </>}
        </article>}
        {quarterContributions.length > 0 && <article>
          <h3>Sécurité sociale · RETA</h3>
          <strong>{paidContributions.length ? money(paidTotal) : 'À renseigner'}</strong>
          <small>{paidContributions.length ? 'Cotisations confirmées du trimestre' : 'Aucun montant confirmé pour ce trimestre'}</small>
          {plannedContributions.length > 0 && <small>{money(plannedTotal)} à prévoir ou à rapprocher du compte</small>}
          {missingContributions > 0 && <small>{missingContributions} mois à renseigner</small>}
          <details className="mg-chart-details">
            <summary>Voir le détail par mois</summary>
            <ul>{quarterContributions.map(row => <li key={row.period}>
              {row.period.slice(5)}/{year} · {row.confirmed != null ? money(row.confirmed) + ' confirmés'
                : row.projected != null ? money(row.projected) + ' à vérifier' : 'À renseigner'}
            </li>)}</ul>
          </details>
          <button className="mg-quarter-date" type="button" onClick={() => onOpen(id, 'tasks', 'RETA')}>Renseigner les prélèvements →</button>
          <a href={models.RETA.url} target="_blank" rel="noreferrer">Voir les reçus Importass ↗</a>
        </article>}
      </div>
      {rent && (rent.documented > 0 || rent.missing > 0) && <div className="mg-card-note">
        <strong>Retenues sur le loyer · Modelo 115</strong>
        {rent.documented > 0 && <p>{money(rent.documented)} de retenues sur les factures. {money(rent.confirmed)} rattachés à un paiement pointé et daté.</p>}
        {rent.pending > 0 && <p>Rapproche les paiements du bailleur avant d’affecter la retenue au trimestre.</p>}
        {rent.missing > 0 && <p>{rent.missing} loyer(s) dont le justificatif ou la retenue reste à renseigner.</p>}
        <FilingDate row={rentFiling} onOpen={() => onOpen(id, 'tasks', '115', true)} />
      </div>}
      {otherModels.length > 0 && <details className="mg-more">
        <summary>Autres modèles du trimestre, selon tes obligations</summary>
        <ul className="mg-action-list">
          {otherModels.map(row => <li key={row.key}>
            <strong>Modelo {row.model}</strong>{row.status === 'filed' && <small> · Déposé</small>}
            <FilingDate row={row} onOpen={() => onOpen(id, 'tasks', row.model, true)} />
          </li>)}
        </ul>
      </details>}
      {scenario.usingHub && <p className="mg-muted">Pour Blackthorn, l’estimation suppose que les ventes encaissées du Hub sont TTC à 21 % en Espagne.
        {scenario.overlapping > 0 && ' Les mois couverts par le Hub utilisent ses ventes dans cette simulation. Le registre fiscal conserve tes factures.'}
        {' '}Rapproche les factures et le Hub avant le dépôt.
        {studio.data.reconciliationWarnings > 0 && ' Des ventes du Hub sont à rapprocher.'}</p>}
      {studio && <p className="mg-muted">L’acompte 130 suppose l’estimation directe simplifiée. Vérifie le régime de Tony avant le dépôt.</p>}
      {studio?.status === 'error' && <p className="mg-muted">Ventes du Hub indisponibles. <button type="button" onClick={studio.reload}>Réessayer</button></p>}
      {quarterContributions.length > 0 && <p className="mg-muted">Les cotisations diminuent le résultat retenu pour l’IRPF et ne génèrent pas de TVA récupérable.
        {contributions.projectedRows.some(row => row.date <= quarterEnd) &&
          ' L’estimation IRPF inclut les cotisations projetées jusqu’à la fin du trimestre.'}</p>}
      <div className="mg-card-actions">
        <button type="button" onClick={() => onOpen(id, 'tasks', 'all', true)}>Vérifier avant un dépôt →</button>
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
    {registered130 && <GestoriaIrpf key={id + ':' + year} year={year} startDate={startDate} entries={fiscalEntries} filings={filings}
      settings={settings} canSave={canSave} onSave={onSave} activityName={name} onFinance={() => onOpen(id, 'finance')} />}
      </div>
    </details>
  </>
}
