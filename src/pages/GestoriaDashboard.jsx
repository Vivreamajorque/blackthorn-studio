import React, { useState } from 'react'
import { overviewAgenda, isComplete, ledgerSummary } from '../lib/gestoria-dashboard.mjs'
import { daysUntil, formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
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

export default function GestoriaDashboard({ year, dossiers, personalStart, entries, studio, onOpen, irpf, canSave, onIrpf }) {
  const [showDetails, setShowDetails] = useState(false)
  const [horizon, setHorizon] = useState(90)
  const [selectedActivity, setActivity] = useState('independent')
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
      ...entries.filter(row => row.entity === 'blackthorn' && row.kind === 'expense' && (!row.currency || row.currency === 'EUR'))
        .map(row => ({ ...row, amount: row.amountCents / 100 })),
    ], year, true) : null,
  }

  const ledger = summaries[activity]
  const quarterMonths = ledger?.months.slice(startMonth, startMonth + 3)
  const quarterIncome = quarterMonths?.reduce((sum, month) => sum + month.income, 0)
  const quarterExpenses = quarterMonths?.reduce((sum, month) => sum + month.expenses, 0)
  const missingIncome = activity === 'independent' && activityEntries.filter(row =>
    row.kind === 'invoice' && row.taxAmountCents == null && row.date.startsWith(year + '-') &&
    (!personalStart || row.date >= personalStart) && Math.ceil(Number(row.date.slice(5, 7)) / 3) === quarter
  ).length

  return <div className="mg-dashboard">
    <section className="mg-hero" aria-labelledby="mg-home-title">
      <div>
        <p className="mg-eyebrow"><span /> {longDate.format(new Date(today)).toUpperCase()} · EXERCICE {year}</p>
        <h1 id="mg-home-title">Mon trimestre</h1>
        <p className="mg-hero-description">{'Tes recettes, tes dépenses et les échéances Hacienda.'}</p>
      </div>
      <div className="mg-hero-next">
        <span className="mg-hero-label">PAR QUOI COMMENCER</span>
        <strong>{action.title}</strong>
        <span>{action.note}</span>
        <button type="button" onClick={() => onOpen(focus.id, action.tab, action.model)}>Ouvrir mon suivi <span aria-hidden="true">→</span></button>
      </div>
    </section>

    <section className="mg-panel mg-dashboard-filter">
      <div><p className="mg-section-label">DOSSIER AFFICHÉ</p><h2>{selected.name}</h2></div>
      <div className="mg-switch" role="group" aria-label="Choisir l’activité du tableau de bord">
        {dossiers.map(({ id, name }) => <button type="button" key={id} aria-pressed={id === activity} onClick={() => setActivity(id)}>{name}</button>)}
      </div>
    </section>
    <section className="mg-panel mg-dashboard-filter" aria-label="Trimestre affiché">
      <div><p className="mg-section-label">T{quarter} · {year}</p><h2>{quarterLabels[quarter - 1]}</h2></div>
      <div className="mg-switch" role="group" aria-label="Choisir le trimestre">
        {quarterLabels.map((label, index) => <button type="button" key={label} aria-label={'T' + (index + 1) + ' · ' + label}
          aria-pressed={quarter === index + 1} onClick={() => setQuarters(previous => ({ ...previous, [year]: index + 1 }))}>T{index + 1}</button>)}
      </div>
    </section>

    <section className="mg-start-grid mg-quarter-grid" aria-label="Chiffres du trimestre">
      <article className="mg-start-card mg-start-estimate">
        <span className="mg-section-label">{ledgers[activity].income.toUpperCase()}</span>
        <strong>{ledger ? money(quarterIncome) : 'En attente'}</strong>
        <p>{missingIncome > 0 ? `Montant hors TVA à compléter sur ${missingIncome} facture(s).` : ledgers[activity].source}</p>
      </article>
      <article className="mg-start-card mg-start-date">
        <span className="mg-section-label">DÉPENSES SAISIES</span>
        <strong>{ledger ? money(quarterExpenses) : 'En attente'}</strong>
        <p>Total des dépenses en euros enregistrées pour ce trimestre.</p>
      </article>
    </section>
    <GestoriaTaxDashboard key={activity + ':' + year} dossier={selected} year={year} quarter={quarter} entries={activityEntries}
      settings={activityIrpf} today={today} canSave={canSave} onSave={settings => onIrpf(activity, settings)} onOpen={onOpen} />

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
  </div>
}
