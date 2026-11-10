import React, { useState } from 'react'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { forecastPayments, irpfForecast } from '../lib/gestoria-irpf.mjs'
import { debtUrl, models, vatSummary } from '../lib/gestoria-models.mjs'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const money = cents => euro.format(cents / 100)
const numeric = entries => Object.entries(entries).sort(([a], [b]) => Number(a) - Number(b))
const irpfLabels = { '01': 'Revenus', '02': 'Charges et forfait', '03': 'Bénéfice net', '04': '20 % du bénéfice',
  '05': 'Acomptes précédents', '06': 'Retenues', '07': 'Acompte avant réductions', '13': 'Réduction', '15': 'Reports', '19': 'Résultat estimé' }

function BoxTable({ fields, rates, labels }) {
  if (!Object.keys(fields).length) return <p className="mg-muted">Ajoute les écritures fiscales dans Compta pour préparer ce calcul.</p>
  return <div className="mg-tax-table"><table>
    <thead><tr><th scope="col">Case</th><th scope="col">Valeur à vérifier</th></tr></thead>
    <tbody>{numeric(fields).map(([box, value]) => <tr key={box}>
      <th scope="row">[{box}]{labels?.[box] && ' · ' + labels[box]}</th>
      <td>{rates?.has(box) ? value + ' %' : money(value)}</td>
    </tr>)}</tbody>
  </table></div>
}

export function ModelPreparation({ row, year, entries, startDate, settings, personal, onFinance }) {
  const [open, setOpen] = useState(false)
  const model = models[row.model]
  const today = todayInSpain()
  const irpf = open && personal && row.model === '130' ? irpfForecast(entries, { year, startDate, today, settings }) : null
  const vat = open && personal && ['303', '349', '390'].includes(row.model)
    ? vatSummary(entries, { year, startDate, today, quarter: row.quarter }) : null
  return <details className="mg-filing-evidence" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Préparer {row.model === 'RETA' ? 'le contrôle du prélèvement' : 'le Modelo ' + row.model}</summary>
    {open && <div className="mg-preparation">
      <p>{model.sources}</p>
      <p>Exercice {year}{row.quarter ? ' · ' + row.quarter + 'T' : ''}
        {row.date ? ' · échéance ' + formatDate(row.date) : ' · échéance à confirmer'}</p>
      {irpf && <>
        <BoxTable fields={irpf.quarters[row.quarter - 1].fields} labels={irpfLabels} />
        <p className="mg-muted">Vérifie les cases des trimestres déposés et les écritures qui restent à compléter dans « IRPF à prévoir ».</p>
      </>}
      {vat && <>
        {vat.missing.length > 0 && <p className="mg-card-note">{vat.missing.length} écriture(s) du registre à qualifier pour la TVA.</p>}
        {row.model === '303' && <>
          <BoxTable fields={vat.boxes} rates={vat.rates} />
          <p className="mg-muted">Régime général, opérations courantes saisies. Vérifie les reports, rectifications, régularisations et autres cases dans Pre303.</p>
        </>}
        {row.model === '349' && <>
          {vat.missingIds.length > 0 && <p className="mg-card-note">{vat.missingIds.length} opération(s) avec numéro TVA ou pays à compléter.</p>}
          {vat.counterparts.length > 0 ? <div className="mg-tax-table"><table>
            <thead><tr><th>Opérateur</th><th>Pays</th><th>NIF TVA</th><th>Clé</th><th>Base</th></tr></thead>
            <tbody>{vat.counterparts.map(item => <tr key={[item.country, item.id, item.operation].join(':')}>
              <th scope="row">{item.label}</th><td>{item.country}</td><td>{item.id}</td><td>{item.operation}</td><td>{money(item.baseCents)}</td>
            </tr>)}</tbody>
          </table></div> : <p className="mg-muted">Aucun opérateur intracommunautaire complet à afficher.</p>}
        </>}
        {row.model === '390' && vat.count > 0 && <dl className="mg-amounts">
          <div><dt>IVA collectée dans le registre</dt><dd>{money(vat.boxes['27'])}</dd></div>
          <div><dt>IVA déductible dans le registre</dt><dd>{money(vat.boxes['45'])}</dd></div>
        </dl>}
      </>}
      <div className="mg-card-actions">
        <a href={model.url} target="_blank" rel="noopener noreferrer">Ouvrir {row.model === 'RETA' ? 'Importass · Recibos' : 'Hacienda · Modelo ' + row.model} ↗</a>
        {row.model === 'RETA' && <a href={debtUrl} target="_blank" rel="noopener noreferrer">Vérifier les dettes ↗</a>}
        {personal && (irpf || vat) && <button type="button" onClick={onFinance}>Compléter dans Compta</button>}
      </div>
    </div>}
  </details>
}

export function GestoriaPayments({ year, dossier, data, onOpen }) {
  const { id, startDate, filings, notices } = dossier
  const today = todayInSpain()
  const personal = id === 'independent'
  const settings = data.irpf?.[year]
  const irpf = personal ? irpfForecast(data.entries, { year, startDate, today, settings }) : null
  const projected = personal ? irpfForecast(forecastPayments(data.entries, today),
    { year, startDate, today: year + '-12-31', settings }) : null
  const historical = Object.entries(data.records).filter(([key]) => key.startsWith(id + ':') && Number(key.slice(-4)) <= year)
    .flatMap(([key, record]) => Object.entries(record.filingDetails || {}).map(([period, evidence]) => ({
      key: key + ':' + period, period, evidence, filed: record.filings[period] === 'filed',
    }))).filter(item => item.period.endsWith(':RETA') && item.filed && item.evidence.amountCents > 0)
    .sort((a, b) => b.key.localeCompare(a.key))[0]?.evidence?.amountCents
  const lastReceipt = dossier.record.portalChecks?.receipts?.rows
    .filter(row => row.period <= today.slice(0, 7))
    .sort((a, b) => b.period.localeCompare(a.period))[0]?.amountCents
  const rows = filings.filter(row => row.status !== 'not_applicable' && !['349', '390'].includes(row.model) &&
    (row.status !== 'filed' || row.evidence?.amountCents > 0)).map(row => {
    let amount = row.evidence?.amountCents
    let caption = 'Montant à vérifier'
    if (amount != null) caption = row.status === 'filed' && row.model === 'RETA' ? 'Prélevé' : 'Montant saisi · paiement à rapprocher'
    else if (row.model === '130' && irpf && row.status !== 'filed') {
      const actual = irpf.quarters[row.quarter - 1]?.due
      const projection = row.date >= today ? projected.quarters[row.quarter - 1]?.due : null
      amount = projection ?? actual
      caption = projection != null && projection !== actual ? 'Projection IRPF · dates prévues incluses' : 'Estimation IRPF'
    } else if (row.model === '303' && personal && row.status !== 'filed') {
      const vat = vatSummary(data.entries, { year, startDate, today, quarter: row.quarter })
      amount = vat.balance == null ? null : Math.max(0, vat.balance)
      caption = 'Estimation IVA avant reports' + (vat.missing.length ? ' · ' + vat.missing.length + ' écriture(s) à qualifier' : '')
    } else if (row.model === 'RETA' && row.date >= today && (lastReceipt != null || historical != null)) {
      amount = lastReceipt ?? historical
      caption = lastReceipt != null ? 'Projection · dernier reçu émis dans Importass' : 'Projection · dernier prélèvement renseigné'
    }
    return { ...row, amount, caption }
  }).filter(row => row.status !== 'filed' || row.model !== 'RETA')
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const debts = notices.filter(item => item.kind === 'debt' && !item.done)
  return <>
    <section className="mg-panel">
      <div className="mg-panel-heading"><div><p className="mg-section-label">TRÉSORERIE</p><h2>Ce que je dois prévoir</h2></div></div>
      <p className="mg-muted">Les projections IRPF incluent les encaissements et paiements prévus que tu renseignes dans Compta. Les dates indicatives et les échéances passées restent à vérifier. Le statut du dépôt et le paiement se rapprochent séparément.</p>
      <div className="mg-tax-table"><table>
        <thead><tr><th>Échéance</th><th>Obligation</th><th>Montant</th><th>Origine</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}>
          <td>{row.date ? formatDate(row.date) : 'À confirmer'}{row.indicative && row.date && ' · indicative'}</td>
          <th scope="row"><button type="button" onClick={() => onOpen(id, 'tasks', row.model)}>{row.title}</button></th>
          <td>{row.amount == null ? 'À vérifier' : money(row.amount)}</td><td>{row.amount == null ? 'Données à compléter' : row.caption}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section className="mg-panel" style={{ marginTop: 16 }}>
      <h2>Retards et dettes Seguridad Social</h2>
      <p className="mg-muted">Montants enregistrés. Vérifie le solde et les délais dans Importass avant de t’appuyer dessus.</p>
      {debts.length ? <ul>{debts.map(item => <li key={item.id}>
        {item.title}{item.amountCents != null && ' · ' + money(item.amountCents)}{item.date && ' · ' + formatDate(item.date)}
      </li>)}</ul> : <p>Aucune dette renseignée dans ce dossier. Consulte le résultat officiel dans Importass.</p>}
      <div className="mg-card-actions">
        <a href={debtUrl} target="_blank" rel="noopener noreferrer">Ouvrir la consultation officielle des dettes ↗</a>
        <button type="button" onClick={() => onOpen(id, 'portals')}>Récupérer le tableau Importass</button>
      </div>
    </section>
  </>
}
