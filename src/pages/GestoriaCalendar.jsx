import React, { useState } from 'react'
import { formatDate } from '../lib/gestoria-calendar.mjs'

const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const monthLabel = date => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
const iso = date => date.toISOString().slice(0, 10)
const source130 = 'https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html'
const sourceVat = 'https://sede.agenciatributaria.gob.es/Sede/iva/que-iva-soportado-puedo-deducir/que-requisitos-debo-cumplir-poder-iva.html'
const isPaid = row => row.model === 'RETA' ? row.status === 'filed' : Boolean(row.evidence?.paid)
const amountLabel = row => row.amount == null ? 'Montant à compléter' : row.amount < 0 ? money(-row.amount) + ' de solde en faveur' : money(row.amount)

export default function GestoriaCalendar({ year, dossier, rows, ledger, settings, today, onOpen }) {
  const [month, setMonth] = useState(() => today.startsWith(year + '-') ? Number(today.slice(5, 7)) - 1 : 0)
  const [selectedDay, setSelectedDay] = useState(null)
  const [listView, setListView] = useState(false)
  const date = new Date(Date.UTC(year, month, 1))
  const prefix = iso(date).slice(0, 7)
  const paymentPlans = dossier.record?.paymentPlans || []
  const installments = paymentPlans.flatMap(plan => (plan.schedule || Array.from({ length: plan.count }, (_, index) => {
    const date = new Date(plan.firstDate + 'T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + index)
    return { date: iso(date), amountCents: Math.floor(plan.principalCents / plan.count) + (index < plan.principalCents % plan.count ? 1 : 0) }
  })).map((term, index) => ({ key: plan.id + '-' + index, model: plan.model, taxYear: plan.taxYear,
    title: 'Échelonnement ' + plan.model + ' · T' + plan.quarter + ' ' + (plan.taxYear || year) + ' · mensualité ' + (index + 1) + '/' + plan.count,
    date: term.date, amount: term.amountCents, status: plan.status === 'approved' ? 'to_prepare' : 'unknown', tentative: plan.status !== 'approved',
    caption: plan.status === 'approved' ? 'Prélèvement prévu par l’accord · intérêts inclus · paiement à confirmer après débit' : 'Date demandée · montant indicatif hors intérêts · accord à joindre' })))
  const events = [...dossier.filings.filter(row => row.status !== 'not_applicable' && !(dossier.record?.socialReview?.paymentMode === 'quarterly' && row.model === 'RETA' && row.date >= today && row.status !== 'filed')).map(row => {
    const forecast = rows.find(item => item.key === row.key)
    const scheduled = paymentPlans.some(plan => plan.status === 'approved' && plan.model === row.model && plan.quarter === row.quarter && (!plan.taxYear || plan.taxYear === year))
    return forecast ? { ...forecast, scheduled } : { ...row, scheduled, amount: row.evidence?.amountCents, caption: row.status === 'filed' ? 'Dépôt enregistré' : 'Applicabilité et montant à vérifier' }
  }), ...installments]
  const lastMonth = Math.max(12, ...events.filter(row => row.date).map(row => (Number(row.date.slice(0, 4)) - year) * 12 + Number(row.date.slice(5, 7)) - 1))
  const visible = events.filter(row => row.date?.startsWith(prefix))
  const overdue = events.filter(row => row.date && row.date < today && !row.tentative && !isPaid(row) && row.status !== 'filed')
  const awaitingPayment = events.filter(row => row.status === 'filed' && !row.scheduled && !isPaid(row) && row.amount > 0)
  const undated = events.filter(row => !row.date)
  const outstanding = visible.filter(row => !isPaid(row) && !row.tentative && !row.scheduled && row.amount >= 0)
  const total = outstanding.reduce((sum, row) => sum + row.amount, 0)
  const missing = visible.filter(row => !isPaid(row) && row.amount == null && !['349', '390', '180'].includes(row.model)).length
  const credit = visible.filter(row => !isPaid(row) && row.amount < 0).reduce((sum, row) => sum - row.amount, 0)
  const dayEvents = selectedDay ? visible.filter(row => row.date === selectedDay) : visible
  const offset = (date.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const expenses = ledger.filter(row => row.kind === 'expense' && row.date?.startsWith(year + '-'))
  const missingProof = expenses.filter(row => !row.attachment)
  const pendingVat = expenses.filter(row => row.vat?.quotaCents > (row.vat?.deductibleCents || 0) && !['personal', 'social'].includes(row.expenseCategory))
  const recommendations = [
    ...(settings?.priorNetCents == null ? [{ title: 'Vérifier la réduction de ton acompte IRPF', detail: 'Renseigne le bénéfice net des activités de l’année précédente. La case 13 peut réduire l’acompte de 100 € par trimestre jusqu’à 9 000 € de bénéfice net antérieur ; les tranches suivantes prévoient 75, 50 ou 25 € jusqu’à 12 000 €. Ce seuil porte sur le bénéfice, pas sur le chiffre d’affaires.', tab: 'overview', label: 'Vérifier mes paramètres IRPF', source: source130 }] : []),
    ...(missingProof.length ? [{ title: `${missingProof.length} dépense(s) sans pièce jointe`, detail: 'Rassemble les factures correspondantes : le justificatif permet de contrôler le montant, l’usage professionnel et la déduction. L’absence de pièce jointe dans l’outil ne signifie pas que tu ne possèdes pas la facture.', tab: 'finance', label: 'Compléter les justificatifs', source: sourceVat }] : []),
    ...(pendingVat.length ? [{ title: `${pendingVat.length} facture(s) avec TVA restant à examiner`, detail: 'Une TVA facturée n’est pas automatiquement récupérable. Vérifie la facture, son lien avec l’activité, la part professionnelle et son inscription au registre. Aucun gain supplémentaire n’est compté ici.', tab: 'finance', label: 'Examiner les dépenses', source: sourceVat }] : []),
  ]
  function move(next) { setMonth(next); setSelectedDay(null) }
  return <>
    {paymentPlans.map(plan => <section className="mg-panel mg-calendar-alert" key={plan.id}>
      <p className="mg-section-label">MODELO {plan.model} · T{plan.quarter} · DEMANDE D’ÉCHELONNEMENT</p>
      <h2>{money(plan.principalCents)} · {plan.count} mensualités {plan.status === 'approved' ? 'accordées' : 'demandées'}</h2>
      <p><strong>{plan.status === 'requested' ? 'En cours de traitement — aucun prélèvement encore confirmé' : 'Accordé · prélèvements automatiques prévus, non encore payés'}</strong></p>
      <p>Demande du {formatDate(plan.requestedDate)} · référence {plan.reference}. {plan.status === 'approved' ? 'Premier prélèvement prévu' : 'Premier terme demandé'} : {formatDate(plan.firstDate)}.</p>
      {plan.status === 'approved' && plan.schedule ? <><p>Accord du {formatDate(plan.approvedDate)} · référence {plan.agreementReference}. Total prévu : <strong>{money(plan.schedule.reduce((sum, item) => sum + item.amountCents, 0))}</strong>, dont {money(plan.schedule.reduce((sum, item) => sum + item.interestCents, 0))} d’intérêts.</p>
      <div className="mg-tax-table"><table><thead><tr><th>Prélèvement prévu</th><th>Montant</th><th>Dont intérêts</th></tr></thead><tbody>{plan.schedule.map(term => <tr key={term.date}><td>{formatDate(term.date)}</td><td>{money(term.amountCents)}</td><td>{money(term.interestCents)}</td></tr>)}</tbody></table></div><p>Garde le solde disponible avant chaque date. Ces échéances ne sont pas marquées payées automatiquement.</p></> : <p>Environ {money(Math.round(plan.principalCents / plan.count))} par mois, hors intérêts. Échéances demandées exclues du budget tant que l’accord n’est pas enregistré.</p>}
      <a href={'/api/gestoria-file?id=' + plan.attachment.id} target="_blank" rel="noopener noreferrer">{plan.status === 'approved' ? 'Ouvrir l’accord officiel' : 'Ouvrir le justificatif de demande'} ↗</a>
      <p><a href="https://sede.agenciatributaria.gob.es/Sede/recaudacion/aplazamientos-fraccionamientos/aplazamiento-fraccionamiento-deudas/gestiones.html" target="_blank" rel="noopener noreferrer">Consulter la décision et les dates accordées sur Hacienda ↗</a></p>
    </section>)}
    <section className="mg-panel mg-calendar" aria-label={'Calendrier de ' + dossier.name}>
      <div className="mg-panel-heading"><div><p className="mg-section-label">{dossier.name} · ÉCHÉANCES DE L’EXERCICE {year}</p><h2>Mon calendrier à prévoir</h2></div>
        <button type="button" onClick={() => setListView(value => !value)}>{listView ? 'Vue calendrier' : 'Vue liste'}</button></div>
      <p className="mg-muted">Les dates sont celles des dépôts ou prélèvements suivis. Elles ne constituent pas toutes une date de débit bancaire ; la domiciliation peut avoir une date limite plus tôt.</p>
      <div className="mg-calendar-nav"><button type="button" aria-label="Mois précédent" disabled={month === 0} onClick={() => move(month - 1)}>←</button><h3 aria-live="polite">{monthLabel(date)}</h3><button type="button" aria-label="Mois suivant" disabled={month === lastMonth} onClick={() => move(month + 1)}>→</button>
        <button type="button" onClick={() => move(today.startsWith(year + '-') ? Number(today.slice(5, 7)) - 1 : 0)}>Mois de référence</button></div>
      <div className="mg-calendar-summary"><article><span>À prévoir ce mois · montants renseignés</span><strong>{outstanding.length ? money(total) : missing ? 'À compléter' : '—'}</strong><small>{missing ? `${missing} montant(s) manquant(s) : total partiel` : 'Montants saisis ou estimés, paiements confirmés exclus'}</small></article>
        <article><span>Échéances dans ce mois</span><strong>{visible.length}</strong><small>{visible.filter(isPaid).length} paiement(s) confirmé(s)</small></article>
        {credit > 0 && <article><span>Soldes en faveur renseignés</span><strong>{money(credit)}</strong><small>Non déduits du budget et sans remboursement automatique</small></article>}</div>
      {!listView && <><div className="mg-calendar-week" aria-hidden="true">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="mg-calendar-grid">{Array.from({ length: offset }, (_, i) => <div key={'blank' + i} className="mg-calendar-blank" />)}
          {Array.from({ length: days }, (_, i) => { const day = prefix + '-' + String(i + 1).padStart(2, '0'); const items = visible.filter(row => row.date === day); return <button type="button" key={day} className={'mg-calendar-day' + (day === today ? ' today' : '') + (selectedDay === day ? ' selected' : '')} aria-pressed={selectedDay === day} aria-label={formatDate(day) + ' · ' + items.length + ' échéance(s)'} onClick={() => setSelectedDay(selectedDay === day ? null : day)}>
            <span className="mg-calendar-day-number">{i + 1}</span>{items.length > 0 && <><span className="mg-calendar-mobile-count">{items.length}</span>{items.map(row => <span key={row.key} className={'mg-calendar-event ' + (isPaid(row) ? 'paid' : row.status === 'unknown' ? 'unconfirmed' : 'planned')}><b>{row.model === 'RETA' ? 'Cotisation' : row.model}</b><span>{isPaid(row) ? 'Payé' : row.amount == null ? 'À vérifier' : money(row.amount)}</span></span>)}</>}
          </button> })}</div></>}
      <p className="mg-muted">Vert : paiement confirmé · Ambre : applicabilité à vérifier · Bleu : montant saisi ou estimé. Clique sur un jour pour voir ses détails.</p>
      <div className="mg-calendar-events" aria-live="polite"><h3>{selectedDay ? 'Le ' + formatDate(selectedDay) : 'Détails du mois'}</h3>
        {dayEvents.length ? dayEvents.map(row => <article key={row.key}><div><strong>{row.title}</strong>{row.tentative && <span className="mg-tag warning">Demandé · non accordé</span>}<p>{formatDate(row.date)}{row.indicative ? ' · date indicative' : ''} · {row.status === 'unknown' ? 'Applicabilité à vérifier' : row.status === 'filed' ? 'Dépôt enregistré' : 'À préparer / vérifier'}</p><small>{row.caption}</small></div><div><strong>{isPaid(row) ? 'Paiement confirmé' : amountLabel(row)}</strong><button type="button" onClick={() => onOpen(dossier.id, 'tasks', row.model, false, row.taxYear)}>Ouvrir le suivi →</button></div></article>) : <p className="mg-muted">Aucune échéance enregistrée {selectedDay ? 'ce jour' : 'ce mois'}. Cela ne confirme pas l’absence d’obligations officielles.</p>}</div>
      {(overdue.length > 0 || awaitingPayment.length > 0 || undated.length > 0) && <details className="mg-calendar-alert"><summary>{overdue.length} échéance(s) passée(s) à vérifier · {awaitingPayment.length} paiement(s) à rapprocher · {undated.length} date(s) manquante(s)</summary><p>Un justificatif peut manquer dans l’outil alors que la démarche a déjà été faite. Vérifie le portail avant de conclure à un retard.</p>{[...overdue, ...awaitingPayment, ...undated].map(row => <p key={row.key}><button type="button" onClick={() => onOpen(dossier.id, 'tasks', row.model, false, row.taxYear)}>{row.title} · {row.date ? formatDate(row.date) : 'Date à confirmer'} →</button></p>)}</details>}
    </section>
    <section className="mg-panel mg-recommendations"><p className="mg-section-label">MES POINTS DE CONTRÔLE · {dossier.name}</p><h2>Mieux préparer, sans déduire au hasard</h2><p className="mg-muted">Pistes basées sur les informations enregistrées, à vérifier avant toute modification fiscale. Ajouter une charge représente une dépense réelle, pas une économie du même montant.</p>
      {recommendations.length ? recommendations.map(item => <article key={item.title}><span className="mg-tag warning">À vérifier</span><h3>{item.title}</h3><p>{item.detail}</p><button type="button" onClick={() => onOpen(dossier.id, item.tab)}>{item.label} →</button> <a href={item.source} target="_blank" rel="noopener noreferrer">Règle officielle AEAT ↗</a></article>) : <p>Aucun point automatique détecté sur ces contrôles. Les calculs restent liés à la complétude des pièces.</p>}
      <small>Règles consultées le 11 novembre 2026.</small>
    </section>
  </>
}
