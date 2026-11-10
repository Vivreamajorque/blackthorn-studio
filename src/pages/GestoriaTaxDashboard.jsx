import React from 'react'
import { inActivityYear } from '../lib/gestoria-calendar.mjs'
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

export default function GestoriaTaxDashboard({ dossier, year, entries, settings, today, canSave, onSave, onOpen }) {
  const { id, name, startDate, filings } = dossier
  const forecast = irpfForecast(forecastPayments(entries, today), { year, startDate, today: year + '-12-31', settings })
  const quarters = filings.filter(row => row.model === '130').map(irpf => {
    const vat = filings.find(row => row.model === '303' && row.quarter === irpf.quarter)
    const calculation = vatSummary(entries, { year, quarter: irpf.quarter, startDate, today })
    return { irpf, vat, calculation, tax: forecast.quarters[irpf.quarter - 1] }
  })
  const active = entries.filter(row => inActivityYear(row.date, year, startDate))
  const unqualified = active.filter(row => row.kind === 'expense' && (row.taxAmountCents == null || !row.vat || row.taxReview))
  const noProof = active.filter(row => row.kind === 'expense' && row.taxAmountCents !== 0 && !row.attachment)
  const vatToCheck = active.filter(row => row.kind === 'expense' && row.vat?.quotaCents > 0 && !row.taxReview &&
    row.vat?.deductibleCents === 0 && !['personal', 'social'].includes(row.expenseCategory))
  const priorMissing = settings?.priorNetCents == null
  const notEntered = filings.filter(row => ['130', '303'].includes(row.model) && row.status === 'filed' &&
    row.evidence?.amountCents == null && (row.model !== '130' || !settings?.filed?.[row.quarter]))
  const registered130 = quarters.some(({ irpf }) => irpf.status !== 'not_applicable')
  return <>
    <section className="mg-panel" aria-labelledby="mg-quarterly-tax">
      <div className="mg-panel-heading"><div><p className="mg-section-label">{name.toUpperCase()}</p>
        <h2 id="mg-quarterly-tax">Impôts et TVA par trimestre</h2></div></div>
      <p className="mg-muted">Une estimation peut évoluer. Le montant déclaré vient des chiffres que tu as enregistrés avec ta déclaration.</p>
      <div className="mg-tax-table"><table>
        <thead><tr><th scope="col">Trimestre</th><th scope="col">Impôt sur le revenu · 130</th><th scope="col">TVA · 303</th><th scope="col">Détail TVA estimée</th></tr></thead>
        <tbody>{quarters.map(({ irpf, vat, tax, calculation }) => <tr key={irpf.key}>
          <th scope="row">T{irpf.quarter}</th>
          <td>{irpf.status === 'not_applicable' ? 'Non applicable' : <TaxCell
            official={irpf.evidence?.amountCents ?? tax.filed?.box19} estimate={id === 'blackthorn' && !settings ? null : tax.due}
            filed={irpf.status === 'filed' || Boolean(tax.filed)} paid={irpf.evidence?.paid}
            qualification={priorMissing ? 'Estimation sans la case 13' : 'Estimation · case 13 incluse'} />}</td>
          <td>{vat.status === 'not_applicable' ? 'Non applicable' : <TaxCell vat official={vat.evidence?.amountCents}
            estimate={calculation.balance} filed={vat.status === 'filed'} paid={vat.evidence?.paid}
            qualification={calculation.missing.length ? 'Estimation partielle · lignes à vérifier' : 'Estimation avant reports'} />}</td>
          <td>{calculation.balance == null ? '—' : <><small>TVA due brute {money(calculation.boxes['27'])}</small>
            <small>TVA déductible {money(calculation.boxes['45'])}</small></>}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="mg-muted">Un solde de TVA en ta faveur peut généralement être reporté. Les conditions de remboursement dépendent de ta situation.</p>
      <p className="mg-muted">Le Modelo 130 se calcule pour le contribuable. Si plusieurs activités relèvent du même NIF, rapproche leurs écritures dans une seule déclaration.</p>
      {id === 'blackthorn' && <p className="mg-muted">Les estimations du studio partent des écritures fiscales ajoutées dans Mi Gestoría et des réglages de ce dossier. Le Hub reste la source des graphiques d’activité.</p>}
      <button type="button" onClick={() => onOpen(id, 'tasks', 'all', true)}>Enregistrer une déclaration ou son justificatif →</button>
    </section>
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
  </>
}
