import React, { useState } from 'react'
import { overviewAgenda, isComplete, ledgerSummary } from '../lib/gestoria-dashboard.mjs'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import GestoriaControl from './GestoriaControl'
import GestoriaIrpf from './GestoriaIrpf'
import './gestoria-dashboard.css'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
const money = cents => euro.format(cents / 100)
const months = Array.from({ length: 12 }, (_, i) => monthFormat.format(new Date(Date.UTC(2000, i, 1))))
const ledgers = {
  independent: { income: 'Facturé', expenses: 'Dépenses saisies', source: 'Factures et dépenses ajoutées dans Mi Gestoría' },
  blackthorn: { income: 'Encaissé', expenses: 'Dépenses saisies', source: 'Données du Hub Blackthorn en lecture seule' },
}
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

function MonthlyChart({ ledger, activity, startMonth = 0 }) {
  const caption = ledgers[activity]
  if (!ledger || !ledger.months.some(month => month.income !== 0 || month.expenses !== 0)) {
    return <p className="mg-muted">{ledger ? 'Aucun mouvement à afficher sur cet exercice.' : 'Données du Hub en attente.'}</p>
  }
  const visibleMonths = ledger.months.slice(startMonth)
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
  const [horizon, setHorizon] = useState(90)
  const [selectedActivity, setActivity] = useState('independent')
  const personal = dossiers.find(dossier => dossier.id === 'independent')
  const activity = dossiers.find(dossier => dossier.id === selectedActivity)?.id || dossiers[0].id
  const startMonth = activity === 'independent' && personalStart?.startsWith(year + '-')
    ? Number(personalStart.slice(5, 7)) - 1 : 0
  const today = todayInSpain()
  const { priorities, upcoming } = overviewAgenda(dossiers, today)
  const visible = upcoming.filter(item => !horizon || item.days <= horizon)
  const next = upcoming.find(item => item.status !== 'unknown' && !item.indicative)
  const summaries = {
    independent: personal ? ledgerSummary(entries, year, false, personalStart) : null,
    blackthorn: studio.data ? ledgerSummary([
      ...studio.data.receipts,
      ...studio.data.expenses.map(row => ({ ...row, kind: 'expense' })),
    ], year, true) : null,
  }

  return <div className="mg-dashboard">
    <section className="mg-hero" aria-labelledby="mg-home-title">
      <div>
        <p className="mg-eyebrow"><span /> VUE D’ENSEMBLE · EXERCICE {year}</p>
        <h1 id="mg-home-title">Ton bureau de gestion</h1>
        <p className="mg-hero-description">{personal
          ? (personalStart ? 'Mon activité est suivie à partir du ' + formatDate(personalStart) + '. Blackthorn a son propre suivi.'
            : 'Tes chiffres, tes échéances et les démarches à avancer pour tes deux activités.')
          : 'Cet exercice affiche le suivi de Blackthorn Tattoo.'}</p>
      </div>
      <div className="mg-hero-next">
        <span className="mg-hero-label">Prochaine échéance confirmée</span>
        {next ? <>
          <strong>{deadlineLabel(next)}</strong>
          <span>{next.title} · {formatDate(next.date)}</span>
          <button type="button" onClick={() => onOpen(next.entity, next.tab, next.model)}>Voir le dossier <span aria-hidden="true">↗</span></button>
        </> : <>
          <strong>À confirmer</strong>
          <span>Les dates à vérifier sont dans ton agenda.</span>
          <a href="#mg-agenda">Voir l’agenda <span aria-hidden="true">↓</span></a>
        </>}
      </div>
    </section>

    {personal && <GestoriaControl dossier={personal} entries={entries} year={year} today={today} irpf={irpf} onOpen={onOpen} />}

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

    {personal && <GestoriaIrpf key={year} year={year} startDate={personalStart} entries={entries} filings={personal.filings}
      settings={irpf} canSave={canSave} onSave={onIrpf} onFinance={() => onOpen('independent', 'finance')} />}

    <section className="mg-panel mg-evolution" aria-labelledby="mg-evolution">
      <div className="mg-panel-heading">
        <div><p className="mg-section-label">MONTANTS ENREGISTRÉS</p><h2 id="mg-evolution">Évolution mensuelle</h2></div>
        <div className="mg-switch" role="group" aria-label="Activité affichée dans le graphique">
          {dossiers.map(({ id, name }) => <button type="button" key={id} aria-pressed={id === activity} onClick={() => setActivity(id)}>{name}</button>)}
        </div>
      </div>
      <MonthlyChart ledger={summaries[activity]} activity={activity} startMonth={startMonth} />
    </section>
  </div>
}
