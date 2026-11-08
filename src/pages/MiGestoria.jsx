import React, { useState } from 'react'
import { PersonalData, StudioData } from './GestoriaData'
import GestoriaGuide from './GestoriaGuide'
import { filingDeadline, formatDate } from '../lib/gestoria-calendar.mjs'
import { useGestoriaWorkspace } from '../lib/gestoria-workspace'

const ENTITIES = [
  { id: 'independent', name: 'Mon activité', subtitle: 'Prestations et accompagnement' },
  { id: 'blackthorn', name: 'Blackthorn Tattoo', subtitle: 'Activité du studio de tatouage' },
]

const AEAT = 'https://sede.agenciatributaria.gob.es/Sede'
const TASKS = [
  {
    id: 'census', title: 'Reconstituer l’inscription fiscale',
    detail: 'Comparer les Modelo 036 déposés avec les dates d’activité, le régime d’IVA et les obligations affichées par Hacienda.',
    url: AEAT + '/mi-area-personal.html', link: 'Mon espace Hacienda',
  },
  {
    id: 'residence', title: 'Vérifier la résidence fiscale, si concerné',
    detail: 'Retrouver la dernière décision, réunir les preuves de présence et conserver le reçu de toute remise de pièces.',
    url: AEAT + '/procedimientoini/ZN01.shtml', link: 'Notifications Hacienda',
  },
  {
    id: 'reta', title: 'Rapprocher l’affiliation et les cotisations',
    detail: 'Récupérer les résolutions d’alta et de baja, la vida laboral et les cotisations versées. Repérer les écarts avec les dates fiscales.',
    url: 'https://portal.seg-social.gob.es/wps/portal/importass/importass/inicio', link: 'Importass',
  },
  {
    id: 'sales', title: 'Rassembler les recettes',
    detail: 'Regrouper les factures émises et rapprocher dates, montants et encaissements du compte professionnel ou du terminal de paiement.',
  },
  {
    id: 'malt', title: 'Rassembler les factures Malt', entity: 'independent',
    detail: 'Dans tes missions Malt, récupère les factures de projet et de frais. Compare ensuite les versements avec Revolut Pro.',
    url: 'https://help.malt.com/hc/fr/articles/29540886429586-Comment-fonctionnent-la-facturation-et-le-paiement', link: 'Aide Malt',
  },
  {
    id: 'expenses', title: 'Rassembler les dépenses',
    detail: 'Classer les factures, cotisations, frais bancaires et loyers professionnels. Vérifier séparément l’IVA déductible et les retenues.',
  },
  {
    id: 'filings', title: 'Identifier les déclarations à régulariser',
    detail: 'Comparer les obligations officielles aux justificatifs de dépôt. Pour chaque modèle, confirmer la période et vérifier les notifications associées.',
    url: AEAT + '/ayuda/calendario-contribuyente/calendario-contribuyente-2026.html', link: 'Calendrier Hacienda 2026',
  },
  {
    id: 'roi', title: 'Vérifier le ROI et les opérations UE, si concerné',
    detail: 'Consulter la décision finale, vérifier le NIF-IVA et déterminer si un Modelo 349 est requis et à quelle périodicité.',
    url: AEAT + '/iva/iva-operaciones-comercio-exterior/identificacion-realizar-operaciones-otros-empresarios-ue.html', link: 'Guide officiel ROI et VIES',
  },
  {
    id: 'annual', title: 'Contrôler les obligations annuelles',
    detail: 'Selon le régime et les opérations, vérifier la déclaration de revenus et les éventuels récapitulatifs d’IVA ou de retenues.',
  },
]

const FORMS = [
  { id: '303', detail: 'Autoliquidation d’IVA, si obligation trimestrielle confirmée' },
  { id: '130', detail: 'Acomptes IRPF en estimation directe, si applicable' },
  { id: '115', detail: 'Retenues sur loyer professionnel, si applicable' },
  { id: '111', detail: 'Retenues sur salaires ou honoraires, si applicable' },
]

const TASK_STATUS = {
  unknown: 'À vérifier',
  in_progress: 'En cours',
  blocked: 'Bloqué',
  complete: 'Vérifié ou terminé',
  not_applicable: 'Non concerné',
}

const FILING_STATUS = {
  unknown: 'À vérifier',
  missing: 'Dépôt manquant à confirmer',
  to_prepare: 'À préparer après vérification',
  filed: 'Déposée avec justificatif',
  not_applicable: 'Non applicable après vérification',
}

const YEARS = [2025, 2026]
const QUARTERS = [1, 2, 3, 4]
const FILING_ROWS = QUARTERS.flatMap(quarter => FORMS.map(form => ({
  key: 'T' + quarter + ':' + form.id,
  quarter,
  model: form.id,
  title: 'T' + quarter + ' · Modelo ' + form.id,
  detail: form.detail,
})))
const card = { background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 14, padding: 16, marginBottom: 16 }
const muted = { color: 'var(--txt2, #777)', fontSize: 13 }
const rowStyle = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderTop: '1px solid var(--border, #ddd)' }
const buttonStyle = { padding: '9px 12px', cursor: 'pointer' }

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isValidStatuses(value, keys, statuses) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([key, status]) => keys.includes(key) && typeof status === 'string' && Object.hasOwn(statuses, status))
}

function StatusSelect({ title, status, options, onChange, disabled }) {
  return <select aria-label={title} disabled={disabled} value={status || 'unknown'} onChange={event => onChange(event.target.value)}
    style={{ padding: 8, maxWidth: '100%' }}>
    {Object.entries(options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select>
}

export default function MiGestoria() {
  const [entity, setEntity] = useState('independent')
  const [year, setYear] = useState(2026)
  const [tab, setTab] = useState('guide')
  const [bank, setBank] = useState([])
  const { data, loadState, saving, feedback: saveFeedback, save, reload } = useGestoriaWorkspace()
  const canSave = loadState === 'ready' && !saving
  const [formFilter, setFormFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const scope = entity + ':' + year
  const current = ENTITIES.find(item => item.id === entity)
  const record = data.records[scope] || { tasks: {}, filings: {}, notices: [] }
  const filings = FILING_ROWS.map(row => ({ ...row, ...filingDeadline(year, row.quarter, row.model), status: record.filings[row.key] || 'unknown' }))
  const tasks = TASKS.filter(task => !task.entity || task.entity === entity)
  const completed = tasks.filter(task => ['complete', 'not_applicable'].includes(record.tasks[task.id])).length
  const fileBase = 'mi-gestoria-' + entity + '-' + year

  function updateRecord(changes) {
    return save(current => ({
      ...current, records: { ...current.records, [scope]: { ...record, ...changes } },
    }))
  }

  function setStatus(group, key, status) {
    return updateRecord({ [group]: { ...record[group], [key]: status } })
  }

  async function restoreBackup(event) {
    const input = event.currentTarget
    const file = input.files[0]
    input.value = ''
    if (!file) return
    try {
      if (file.size > 10000) throw new Error()
      const data = JSON.parse(await file.text())
      if (data?.version !== 1 || data.entity !== entity || data.year !== year ||
          !isValidStatuses(data.tasks, TASKS.map(task => task.id), TASK_STATUS) ||
          !isValidStatuses(data.filings, FILING_ROWS.map(row => row.key), FILING_STATUS)) throw new Error()
      const saved = await updateRecord({
        tasks: { ...data.tasks, ...record.tasks },
        filings: { ...data.filings, ...record.filings },
      })
      if (saved) setFeedback({ scope, text: 'Sauvegarde chargée pour ' + current.name + ' · ' + year + '. Les statuts du dossier sont prioritaires.' })
    } catch {
      setFeedback({ scope, text: 'Sauvegarde illisible ou incompatible. Vérifie que le fichier correspond au dossier et à l’année affichés.' })
    }
  }

  function exportChecklist() {
    const lines = ['Mi Gestoría — suivi préparatoire', current.name + ' · ' + year, '', 'Démarches et pièces']
    for (const task of tasks) lines.push(task.title + ' · ' + TASK_STATUS[record.tasks[task.id] || 'unknown'])
    lines.push('', 'Déclarations trimestrielles à vérifier')
    for (const row of FILING_ROWS) lines.push(row.title + ' · ' + FILING_STATUS[record.filings[row.key] || 'unknown'])
    download(fileBase + '.txt', lines.join('\n'), 'text/plain;charset=utf-8')
  }

  return <main style={{ padding: '24px 16px 100px', maxWidth: 900, margin: '0 auto', color: 'var(--txt, #222)' }}>
    <a href="/" style={muted}>← Retour au Hub</a>
    <h1 style={{ margin: '12px 0 4px' }}>Mi Gestoría</h1>
    <p style={muted}>Suivi de la régularisation · Deux dossiers distincts</p>

    <section style={card}>
      <label htmlFor="gestoria-entity" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>Dossier</label>
      <select id="gestoria-entity" value={entity} onChange={event => { setEntity(event.target.value); setFeedback(null) }}
        style={{ width: '100%', padding: 10 }}>
        {ENTITIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p style={muted}>{current.subtitle}</p>
      <label>Année <select value={year} onChange={event => { setYear(Number(event.target.value)); setFeedback(null) }}>
        {YEARS.map(item => <option key={item} value={item}>{item}</option>)}
      </select></label>
    </section>

    <nav aria-label="Sections de Mi Gestoría" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {[['guide', 'À faire'], ['finance', 'Compta'], ['tasks', 'Démarches']].map(([id, label]) =>
        <button key={id} aria-pressed={tab === id} style={{ ...buttonStyle, fontWeight: tab === id ? 700 : 400 }}
          onClick={() => setTab(id)}>{label}</button>)}
    </nav>
    {loadState === 'loading' && <p role="status">Chargement de ton dossier privé…</p>}
    {loadState === 'error' && <div role="alert">
      <p>Le dossier privé n’a pas pu être chargé.</p>
      <button onClick={reload}>Réessayer</button>
    </div>}
    {saveFeedback && <div role={saveFeedback.error ? 'alert' : 'status'}>
      <p>{saveFeedback.text}</p>
      {saveFeedback.error && <button disabled={saving} onClick={reload}>Recharger le dossier</button>}
    </div>}
    {tab === 'guide' && loadState === 'ready' &&
      <GestoriaGuide key={scope} year={year} notices={record.notices} filings={filings}
        tasks={tasks.map(task => ({ ...task, status: record.tasks[task.id] }))}
        canSave={canSave} onNotices={notices => updateRecord({ notices })} onTasks={() => setTab('tasks')} />}
    {tab === 'finance' && (entity === 'blackthorn' ? <StudioData key={year} year={year} /> :
      loadState === 'ready' && <PersonalData key={scope} year={year} entries={data.entries} canSave={canSave}
        onEntries={entries => save(current => ({ ...current, entries }))} bank={bank} onBank={setBank} />)}
    {tab === 'tasks' && loadState === 'ready' && <>

    <section style={card}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Démarches et pièces</h2>
      <p style={muted}>{completed} sur {tasks.length} vérifiées, terminées ou non concernées.</p>
      {tasks.map(task => <div key={task.id} style={rowStyle}>
        <div style={{ flex: '1 1 260px' }}>
          <strong>{task.title}</strong>
          <div style={muted}>{task.detail}</div>
          {task.url && <a style={muted} href={task.url} target="_blank" rel="noopener noreferrer">{task.link} ↗</a>}
        </div>
        <StatusSelect title={task.title} status={record.tasks[task.id]} options={TASK_STATUS} disabled={!canSave}
          onChange={status => setStatus('tasks', task.id, status)} />
      </div>)}
    </section>

    <section style={card}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Déclarations trimestrielles</h2>
      <p style={muted}>Les lignes sont des points de contrôle. Vérifie l’obligation et la période sur Hacienda avant de conclure à un retard.</p>
      <label>Filtrer par modèle <select value={formFilter} onChange={event => setFormFilter(event.target.value)}>
        <option value="all">Tous</option>
        {FORMS.map(form => <option key={form.id} value={form.id}>Modelo {form.id}</option>)}
      </select></label>
      <div style={{ marginTop: 12 }}>
        {filings.filter(row => formFilter === 'all' || row.key.endsWith(':' + formFilter)).map(row => <div key={row.key} style={rowStyle}>
          <div><strong>{row.title}</strong><div style={muted}>{row.detail} · {formatDate(row.date)}{row.indicative && ' (date à confirmer)'}</div></div>
          <StatusSelect title={'Statut ' + row.title} status={record.filings[row.key]} options={FILING_STATUS} disabled={!canSave}
            onChange={status => setStatus('filings', row.key, status)} />
        </div>)}
      </div>
    </section>

    <section style={card}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Exporter ou reprendre</h2>
      <p style={muted}>Chaque export concerne uniquement le dossier et l’année affichés. Les statuts sont enregistrés dans ton dossier. Cette copie facultative contient les statuts des démarches et déclarations.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={exportChecklist} style={buttonStyle}>Exporter la checklist</button>
        <button onClick={() => download(fileBase + '.json', JSON.stringify({ version: 1, entity, year, tasks: record.tasks, filings: record.filings }, null, 2), 'application/json')}
          style={buttonStyle}>Télécharger la sauvegarde</button>
      </div>
      <label style={{ display: 'block', marginTop: 12 }}>
        Reprendre une sauvegarde
        <input type="file" accept=".json,application/json" disabled={!canSave} onChange={restoreBackup} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} />
      </label>
      {feedback?.scope === scope && <p role="status" style={muted}>{feedback.text}</p>}
    </section>
    </>}
  </main>
}
