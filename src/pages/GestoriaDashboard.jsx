import React, { useState } from 'react'
import { overviewAgenda, isComplete, ledgerSummary } from '../lib/gestoria-dashboard.mjs'
import { contributionInputs } from '../lib/gestoria-quarter-estimates.mjs'
import { daysUntil, formatDate, monthEnd, todayInSpain } from '../lib/gestoria-calendar.mjs'
import GestoriaControl from './GestoriaControl'
import GestoriaTaxDashboard from './GestoriaTaxDashboard'
import './gestoria-dashboard.css'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
const money = cents => euro.format(cents / 100)
const months = Array.from({ length: 12 }, (_, i) => monthFormat.format(new Date(Date.UTC(2000, i, 1))))
const ledgers = {
  independent: { income: 'Facturé hors TVA renseigné', expenses: 'Dépenses saisies', source: 'Factures et dépenses ajoutées dans Mi Gestoría' },
  blackthorn: { income: 'Encaissé', expenses: 'Dépenses saisies', source: 'Ventes du Hub · charges de Mi Gestoría' },
}
const quarterLabels = ['Janvier – mars', 'Avril – juin', 'Juillet – septembre', 'Octobre – décembre']
const horizons = [{ id: 30, title: '30 jours' }, { id: 90, title: '90 jours' }, { id: 0, title: 'Tout voir' }]

function deadlineLabel(item) {
  if (item.kind === 'task') return 'Démarche bloquée'
  if (!item.date) return 'Date à vérifier'
  if (item.days < 0) {
    if (item.kind === 'notice') return 'Date passée'
    if (item.kind === 'contribution') return 'Prélèvement à vérifier'
    return item.status === 'unknown' ? 'Applicabilité à vérifier' : 'Dépôt à vérifier'
  }
  if (item.days === 0) return 'Aujourd’hui'
  return 'J − ' + item.days
}

function deadlineTone(item) {
  if (item.days !== null && item.days <= 0 && item.status !== 'unknown') return 'critical'
  if (!item.date || item.days <= 7 || item.status === 'unknown') return 'warning'
  return 'calm'
}

function DeadlineRow({ item, onOpen }) {
  return <li className="mg-deadline">
    <button type="button" className="mg-deadline-link" onClick={() => onOpen(item.entity, item.tab, item.model)}>
      <span className="mg-deadline-text">
        <strong>{item.title}</strong>
        <span>{item.entityName}{item.date && ' · ' + formatDate(item.date)}</span>
        {(item.indicative || item.kind === 'filing' && item.status === 'unknown') &&
          <span>{[item.indicative && 'Date indicative', item.status === 'unknown' && 'Applicabilité à vérifier'].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className="mg-deadline-aside"><span className={'mg-tag ' + deadlineTone(item)}>{deadlineLabel(item)}</span><span aria-hidden="true">↗</span></span>
    </button>
  </li>
}

function ActivityCard({ dossier, ledger, studioStatus, warnings, reload, onOpen }) {
  const id = dossier.id
  const captions = ledgers[id]
  const done = dossier.tasks.filter(task => isComplete(task.status)).length
  const total = dossier.tasks.length
  return <article className={'mg-panel mg-activity ' + (id === 'blackthorn' ? 'mg-studio' : 'mg-personal')}>
    <div className="mg-card-title">
      <span className="mg-monogram" aria-hidden="true">{id === 'blackthorn' ? 'BT' : 'MA'}</span>
      <div><h3>{dossier.name}</h3><p>{captions.source}</p></div>
    </div>
    {ledger ? <dl className="mg-amounts">
      <div><dt>{captions.income}</dt><dd>{money(ledger.income)}</dd></div>
      <div><dt>{captions.expenses}</dt><dd>{money(ledger.expenses)}</dd></div>
    </dl> : studioStatus === 'loading' ?
      <p className="mg-muted" role="status">Chargement des données du Hub…</p> :
      <div className="mg-inline-error"><p>Montants du Hub indisponibles.</p><button type="button" onClick={reload}>Réessayer</button></div>}
    {ledger && id === 'independent' && ledger.pending > 0 &&
      <p className="mg-card-note">{ledger.pending} facture{ledger.pending === 1 ? '' : 's'} avec paiement à vérifier ou en attente</p>}
    {ledger && id === 'blackthorn' && warnings > 0 &&
      <p className="mg-card-note">{warnings} écriture{warnings === 1 ? '' : 's'} à rapprocher</p>}
    <div className="mg-progress-text"><span>Démarches vérifiées</span><strong>{done} / {total}</strong></div>
    <progress value={done} max={total || 1} aria-label={'Démarches vérifiées · ' + dossier.name} />
    <div className="mg-card-actions">
      <button type="button" onClick={() => onOpen(id, 'finance')}>Voir la compta <span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => onOpen(id, 'tasks')}>Démarches</button>
    </div>
  </article>
}

function MonthlyChart({ ledger, activity, startMonth }) {
  const caption = ledgers[activity]
  if (!ledger) return <p className="mg-muted">Données du Hub en attente.</p>
  const visibleMonths = ledger.months.slice(startMonth, startMonth + 3)
  if (!visibleMonths.some(month => month.income || month.expenses)) {
    return <p className="mg-muted">Aucun montant saisi pour ces trois mois.</p>
  }
  const values = visibleMonths.flatMap(month => [month.income, month.expenses])
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const position = value => ((value - min) / (max - min)) * 100
  const zero = position(0)
  const bar = value => ({ bottom: Math.min(zero, position(value)) + '%', height: Math.abs(position(value) - zero) + '%' })
  return <>
    <div className="mg-legend"><span>{caption.income}</span><span>{caption.expenses}</span></div>
    <div className="mg-chart" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${visibleMonths.length}, minmax(0, 1fr))` }}>
      {visibleMonths.map((month, i) => <div className="mg-chart-month" key={i}>
        <div className="mg-plot">
          <i className="mg-baseline" style={{ bottom: zero + '%' }} />
          <i className="mg-bar income" style={bar(month.income)} />
          <i className="mg-bar expenses" style={bar(month.expenses)} />
        </div>
        <span>{months[i + startMonth]}</span>
      </div>)}
    </div>
    <details className="mg-chart-details">
      <summary>Voir les montants par mois</summary>
      <table>
        <thead><tr><th scope="col">Mois</th><th scope="col">{caption.income}</th><th scope="col">{caption.expenses}</th></tr></thead>
        <tbody>{visibleMonths.map((month, i) => <tr key={i}>
          <th scope="row">{months[i + startMonth]}</th><td>{money(month.income)}</td><td>{money(month.expenses)}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </>
}

export default function GestoriaDashboard({ year, dossiers, personalStart, entries, studio, onOpen, irpf, canSave, onIrpf, selectedActivity, onActivity, inboxCount = 0, onQuickAction }) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCalculations, setShowCalculations] = useState(false)
  const [horizon, setHorizon] = useState(90)
  const [quarters, setQuarters] = useState({})
  const personal = dossiers.find(dossier => dossier.id === 'independent')
  const selected = dossiers.find(dossier => dossier.id === selectedActivity) || dossiers[0]
  const activity = selected.id
  const personalEntries = entries.filter(row => !row.entity || row.entity === 'independent')
  const activityEntries = activity === 'independent' ? personalEntries : entries.filter(row => row.entity === activity)
  const activityIrpf = activity === 'independent' ? irpf : selected.record.irpf
  const today = todayInSpain()
  const currentYear = Number(today.slice(0, 4))
  const quarter = quarters[year] || (year < currentYear ? 4 : year > currentYear ? 1 : Math.ceil(Number(today.slice(5, 7)) / 3))
  const startMonth = (quarter - 1) * 3
  const contributions = contributionInputs(activityEntries, selected, year, today)
  const studioExpenses = entries.filter(row => row.entity === 'blackthorn' && row.kind === 'expense' && (!row.currency || row.currency === 'EUR'))
  const confirmedQuarterExpenses = contributions.confirmedRows.reduce((sum, row) =>
    sum + (row.taxDate >= year + '-' + String(startMonth + 1).padStart(2, '0') + '-01' && row.taxDate <= monthEnd(year, quarter * 3) ? row.amountCents : 0), 0)
  const { priorities, upcoming } = overviewAgenda(dossiers, today)
  const visible = upcoming.filter(item => !horizon || item.days <= horizon)
  const focus = selected
  const debts = focus.notices.filter(notice => notice.kind === 'debt' && !notice.done)
  const debtTotal = debts.reduce((sum, notice) => sum + (notice.amountCents || 0), 0)
  const openDatedNotice = focus.notices.filter(notice => !notice.done && notice.date && notice.kind !== 'debt')
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const next = upcoming.find(item => item.entity === focus.id && !item.reviewOnly)
  const nearNotice = openDatedNotice && daysUntil(openDatedNotice.date, today) <= 7
  const action = nearNotice
    ? { title: 'Relis ton courrier', note: openDatedNotice.title, tab: 'guide' }
    : debts.length
      ? { title: 'Vérifie tes cotisations', note: 'Compare les dettes relevées avec le tableau actuel d’Importass.', tab: 'portals' }
      : next
        ? { title: 'Vérifie ta prochaine échéance', note: next.title + ' · ' + formatDate(next.date), tab: 'tasks', model: next.model }
        : { title: 'Vérifie tes portails', note: 'Commence par les dépôts et courriers sur Hacienda, puis les cotisations sur Importass.', tab: 'portals' }
  const summaries = {
    independent: personal ? ledgerSummary(personalEntries, year, false, personalStart) : null,
    blackthorn: studio.data ? ledgerSummary([
      ...studio.data.receipts,
      ...studioExpenses.map(row => ({ ...row, amount: row.amountCents / 100 })),
    ], year, true) : null,
  }

  const ledger = summaries[activity]
  const quarterMonths = ledger?.months.slice(startMonth, startMonth + 3)
  const quarterIncome = quarterMonths?.reduce((sum, month) => sum + month.income, 0)
  const expenseMonths = quarterMonths || ledgerSummary(studioExpenses, year, false).months.slice(startMonth, startMonth + 3)
  const quarterExpenses = expenseMonths.reduce((sum, month) => sum + month.expenses, 0)
  const missingIncome = activity === 'independent' && activityEntries.filter(row =>
    row.kind === 'invoice' && row.taxAmountCents == null && row.date.startsWith(year + '-') &&
    (!personalStart || row.date >= personalStart) && Math.ceil(Number(row.date.slice(5, 7)) / 3) === quarter
  ).length

  const firstActions = [...priorities, ...upcoming.filter(item => item.days <= 30)]
    .filter((item, index, all) => all.findIndex(other => other.key === item.key) === index).slice(0, 4)
  const expenseChecks = activityEntries.filter(row => row.kind === 'expense' && row.date?.startsWith(year + '-') &&
    (row.taxAmountCents == null || !row.vat || row.taxReview)).length

  return <div className="mg-dashboard mg-clean-dashboard">
    <header className="mg-clean-heading"><div><p className="mg-section-label">MON ESPACE DE GESTION</p><h1>Mon trimestre</h1></div><span>{quarterLabels[quarter - 1]} {year}</span></header>
    <section className="mg-clean-context" aria-label="Activité et trimestre affichés">
      <div className="mg-switch" role="group" aria-label="Choisir l’activité">{dossiers.map(({id,name}) => <button type="button" key={id} aria-pressed={id === activity} onClick={() => onActivity(id)}>{name}</button>)}</div>
      <div className="mg-switch" role="group" aria-label="Choisir le trimestre">{quarterLabels.map((label,index) => <button type="button" key={label} aria-label={'T' + (index + 1) + ' · ' + label} aria-pressed={quarter === index + 1} onClick={() => setQuarters(previous => ({...previous,[year]:index+1}))}>T{index+1}</button>)}</div>
    </section>
    <section className="mg-fast-bar" aria-label="Actions rapides du dossier">
      {activity === 'independent' && <button type="button" className="mg-primary" onClick={() => onQuickAction(activity, 'create-invoice')}>＋ Créer une facture</button>}
      <button type="button" onClick={() => onQuickAction(activity, 'expense')}>＋ Ajouter une dépense</button>
      {activity === 'blackthorn' && <button type="button" onClick={() => onOpen(activity, 'inbox')}>Déposer des justificatifs{inboxCount > 0 ? ' (' + inboxCount + ')' : ''}</button>}
    </section>
    <section className="mg-start-grid mg-quarter-grid" aria-label="Chiffres du trimestre">
      <article className="mg-start-card mg-start-estimate">
        <span className="mg-section-label">{ledgers[activity].income.toUpperCase()}</span>
        <strong>{ledger ? money(quarterIncome) : 'En attente'}</strong>
        <p>{missingIncome > 0 ? `Montant hors TVA à compléter sur ${missingIncome} facture(s).` : ledgers[activity].source}</p>
      </article>
      <article className="mg-start-card mg-start-date">
        <span className="mg-section-label">DÉPENSES SAISIES</span>
        <strong>{money(quarterExpenses + confirmedQuarterExpenses)}</strong>
        <p>Dépenses en euros, cotisations confirmées comprises.</p>
      </article>
    <GestoriaTaxDashboard compact key={activity + ':' + year} dossier={selected} year={year} quarter={quarter} entries={activityEntries}
      settings={activityIrpf} today={today} contributions={contributions} studio={activity === 'blackthorn' ? studio : undefined} canSave={canSave} onSave={settings => onIrpf(activity, settings)} onOpen={onOpen} />
    </section>
    <section className="mg-clean-next" aria-label="Prochaine action"><div><p className="mg-section-label">PROCHAINE ÉTAPE</p><strong>{action.title}</strong><p>{action.note}</p></div><button type="button" onClick={() => onOpen(focus.id, action.tab, action.model)}>Voir →</button></section>
    <div className="mg-clean-links"><button type="button" onClick={() => onOpen(activity,'payments')}>Calendrier & prélèvements →</button><button type="button" onClick={() => onOpen(activity,'finance')}>Factures & paiements →</button></div>
    <details className="mg-clean-detail" onToggle={event => setShowCalculations(event.currentTarget.open)}><summary>Comprendre les montants et vérifier les calculs</summary>
      {showCalculations && <GestoriaTaxDashboard dossier={selected} year={year} quarter={quarter} entries={activityEntries} settings={activityIrpf} today={today} contributions={contributions} studio={activity === 'blackthorn' ? studio : undefined} canSave={canSave} onSave={settings => onIrpf(activity, settings)} onOpen={onOpen} />}
    </details>
    <details className="mg-clean-detail"><summary>Mes points à compléter & mon aide</summary><div className="mg-clean-extra">
    {(expenseChecks > 0 || activity === 'blackthorn' && inboxCount > 0) && <p className="mg-muted">{expenseChecks} dépense(s) à vérifier{activity === 'blackthorn' && ` · ${inboxCount} pièce(s) à trier`}. <button type="button" onClick={() => onOpen(activity,'finance')}>Compléter le dossier →</button></p>}


    <details className="mg-panel mg-plain-guide"><summary>Je découvre la compta espagnole : comment lire ces chiffres ?</summary>
      <div className="mg-glossary"><article><h3>Ce que je gagne</h3><p>Le chiffre d’affaires correspond aux ventes ou prestations. Ce n’est pas ce qu’il te reste après les charges et les impôts.</p></article>
      <article><h3>TVA / IVA · Modelo 303</h3><p>La TVA facturée aux clients et la TVA récupérable sur les dépenses sont suivies séparément. Un crédit de TVA ne signifie pas qu’un remboursement immédiat est prévu.</p></article>
      <article><h3>Impôt sur le revenu / IRPF · Modelo 130</h3><p>C’est un acompte sur ton impôt annuel. Le montant final sera calculé dans la Renta avec l’ensemble des revenus et ta situation familiale.</p></article>
      <article><h3>Sécurité sociale / RETA</h3><p>Ce sont les cotisations d’autónomo, suivies mois par mois. Un montant prévu doit encore être comparé au prélèvement réel.</p></article></div>
      <p><strong>Estimation</strong> : calcul qui évolue avec les pièces. <strong>Déposée</strong> : déclaration enregistrée avec son justificatif. <strong>Payée</strong> : paiement confirmé séparément.</p>
    </details>
    <details className="mg-panel mg-action-plan"><summary>Mes priorités · {firstActions.length} point(s) à consulter pour les deux activités</summary><div aria-labelledby="mg-plan-title">
      <div className="mg-panel-heading"><div><p className="mg-section-label">TES DEUX ACTIVITÉS · {year}</p>
        <h2 id="mg-plan-title">À faire dans cet ordre</h2></div><span className="mg-tag calm">Pas à pas</span></div>
      <p className="mg-muted">Les délais proches et les points anciens à vérifier passent en premier. « À vérifier » ne veut pas dire que tu es forcément en retard.</p>
      {firstActions.length ? <ol className="mg-action-list">{firstActions.map((item, index) => <li key={item.key}>
        <span className="mg-step-number" aria-hidden="true">{index + 1}</span>
        <div><span className={'mg-entity-label ' + item.entity}>{item.entityName}</span><h3>{item.title}</h3>
          <p>{item.reviewOnly ? 'On ne dispose pas encore d’une confirmation. Vérifie si cette déclaration te concerne et joins le reçu si tu l’as déjà déposée.' :
            item.kind === 'notice' ? 'Ouvre le courrier, regarde ce qui est demandé et conserve la preuve de ta réponse.' :
            item.kind === 'contribution' ? 'Compare ce montant avec Importass et ton compte bancaire avant de confirmer le paiement.' :
            'Ouvre le suivi pour vérifier les pièces, préparer les informations et enregistrer le justificatif.'}</p>
          <span className={'mg-tag ' + deadlineTone(item)}>{deadlineLabel(item)}{item.date && ' · ' + formatDate(item.date)}</span>
        </div><button type="button" onClick={() => onOpen(item.entity, item.tab, item.model)}>Je m’en occupe →</button>
      </li>)}</ol> : <p className="mg-empty">Aucune action urgente détectée dans les informations enregistrées. Tu peux compléter tes pièces ci-dessous.</p>}
      <p className="mg-muted">Ce suivi utilise les pièces enregistrées. Il ne confirme pas automatiquement ta situation auprès des administrations.</p>
    </div></details>

    <details className="mg-more">
      <summary>Voir les recettes et dépenses par mois</summary>
      <section className="mg-panel mg-evolution mg-more-body">
        <MonthlyChart ledger={ledger} activity={activity} startMonth={startMonth} />
        {activity === 'blackthorn' && studio.status === 'error' && <button type="button" onClick={studio.reload}>Réessayer la lecture du Hub</button>}
        <div className="mg-card-actions"><button type="button" onClick={() => onOpen(activity, 'finance')}>Ajouter une facture ou un ticket →</button></div>
      </section>
    </details>

    <details className="mg-more" onToggle={event => setShowDetails(event.currentTarget.open)}>
      <summary>Voir l’agenda et le suivi détaillé des deux activités</summary>
      {showDetails && <div className="mg-dashboard mg-more-body">
    {debts.length > 0 && <section className="mg-panel">
      <p className="mg-section-label">COTISATIONS À VÉRIFIER · {selected.name}</p>
      <h2>{debts.some(item => item.amountCents != null) ? money(debtTotal) : 'À consulter'}</h2>
      <p className="mg-muted">Le solde actuel se vérifie dans Importass.</p>
      <button type="button" onClick={() => onOpen(activity, 'payments')}>Voir les montants →</button>
    </section>}
    {personal && <GestoriaControl dossier={personal} entries={personalEntries} year={year} today={today} irpf={irpf} onOpen={onOpen} />}

    <div className="mg-agenda-grid">
      <section className="mg-panel" aria-labelledby="mg-priorities">
        <div className="mg-panel-heading">
          <div><p className="mg-section-label">POINTS À SURVEILLER</p><h2 id="mg-priorities">À traiter</h2></div>
          <span className="mg-tag warning">{priorities.length}</span>
        </div>
        <p className="mg-muted">Délais proches ou passés, courriers sans date et démarches bloquées.</p>
        {priorities.length ? <ul className="mg-deadlines">
          {priorities.map(item => <DeadlineRow key={item.key} item={item} onOpen={onOpen} />)}
        </ul> : <p className="mg-empty">Aucune priorité signalée pour {year}.</p>}
        <div className="mg-card-actions">
          {personal && <button type="button" onClick={() => onOpen('independent', 'guide')}>Suivre mes courriers <span aria-hidden="true">→</span></button>}
          <button type="button" onClick={() => onOpen('blackthorn', 'guide')}>Courriers du studio</button>
        </div>
      </section>

      <section className="mg-panel" aria-labelledby="mg-agenda" id="mg-agenda-panel">
        <div className="mg-panel-heading">
          <div><p className="mg-section-label">{longDate.format(new Date(today)).toUpperCase()}</p><h2 id="mg-agenda">Agenda des échéances</h2></div>
          <span className="mg-tag calm">{visible.length}</span>
        </div>
        <div className="mg-switch" role="group" aria-label="Horizon de l’agenda">
          {horizons.map(item => <button type="button" key={item.id} aria-pressed={horizon === item.id} onClick={() => setHorizon(item.id)}>{item.title}</button>)}
        </div>
        {visible.length ? <ul className="mg-deadlines">
          {visible.map(item => <DeadlineRow key={item.key} item={item} onOpen={onOpen} />)}
        </ul> : <p className="mg-empty">Aucune échéance dans cette période pour l’exercice {year}.</p>}
        <p className="mg-muted mg-agenda-foot">Les échéances générales restent à vérifier selon les obligations de chaque dossier.</p>
      </section>
    </div>

    <section aria-labelledby="mg-activities">
      <div className="mg-block-heading"><p className="mg-section-label">EXERCICE {year}</p><h2 id="mg-activities">{personal ? 'Tes deux activités' : 'Activité suivie'}</h2></div>
      <div className="mg-activity-grid">
        {dossiers.map(dossier => <ActivityCard key={dossier.id} dossier={dossier} ledger={summaries[dossier.id]}
          studioStatus={studio.status} warnings={studio.data?.reconciliationWarnings} reload={studio.reload} onOpen={onOpen} />)}
      </div>
    </section>

      </div>}
    </details>
    </div></details>
  </div>
}
