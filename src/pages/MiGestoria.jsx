import React, { useEffect, useState } from 'react'
import { PersonalData, StudioData, useStudioLedger } from './GestoriaData'
import { GestoriaPayments, ModelPreparation } from './GestoriaModels'
import GestoriaFilingDetails from './GestoriaFilingDetails'
import GestoriaGuide from './GestoriaGuide'
import GestoriaDashboard from './GestoriaDashboard'
import GestoriaInbox from './GestoriaInbox'
import { resolveInboxItem } from '../lib/gestoria-inbox.mjs'
import GestoriaArchives from './GestoriaArchives'
import GestoriaPortals from './GestoriaPortals'
import { applyPortalCheck, captureKey, readPortalCapture } from '../lib/gestoria-portal.mjs'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { contributionInputs } from '../lib/gestoria-quarter-estimates.mjs'
import { dossierFor, isComplete } from '../lib/gestoria-dashboard.mjs'
import { useGestoriaWorkspace } from '../lib/gestoria-workspace'

const ENTITIES = [
  { id: 'independent', name: 'Mon activité', subtitle: 'Prestations et accompagnement' },
  { id: 'blackthorn', name: 'Blackthorn Tattoo', subtitle: 'Activité du studio de tatouage' },
]

const sections = [
  ['overview', 'Aujourd’hui', 'M3 12l9-8 9 8v8h-6v-6H9v6H3z'],
  ['finance', 'Factures & dépenses', 'M4 4h16v16H4zM4 9h16M9 9v11m4-7h4m-4 3h4'],
  ['payments', 'À prévoir', 'M4 4v16h16M7 15l4-5 3 2 6-7'],
  ['tasks', 'Déclarations & suivi', 'M7 4h10l3 3v13H7zM10 10h7m-7 4h7m-7 3h5'],
  ['inbox', 'Pièces à trier', 'M3 12l3-6h12l3 6v7H3zM3 12h5l2 3h4l2-3h5'],
  ['archives', 'Archives', 'M3 7h18v4H3zM5 11v9h14v-9m-9 4h4'],
  ['guide', 'Courriers à traiter', 'M4 6h16v12H4zM4 7l8 6 8-6'],
  ['portals', 'Portails officiels', 'M5 20h14M7 20V9m5 11V9m5 11V9M3 8l9-4 9 4z'],
]
const pageCopy = {
  finance: ['Factures, dépenses et paiements', 'Retrouve une écriture, ouvre sa pièce ou pointe son paiement.'],
  payments: ['Ce qu’il faut prévoir', 'Retrouve les échéances, les montants déclarés et ce qu’il reste à vérifier.'],
  tasks: ['Déclarations et cotisations', 'Prépare un dépôt, garde son justificatif et confirme le paiement.'],
  inbox: ['Boîte de réception Blackthorn', 'Retrouve les pièces déposées depuis le Hub et valide leur classement.'],
  archives: ['Archives fiscales', 'Retrouve les pièces privées de ce dossier et de cet exercice.'],
  guide: ['Courriers et rappels', 'Regroupe les notifications, dates limites et actions à suivre.'],
  portals: ['Hacienda et Importass', 'Accède aux sites officiels et ramène les résultats dans ton dossier.'],
}

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
  { id: '349', detail: 'Opérations intracommunautaires. Vérifier si la périodicité est trimestrielle ou mensuelle.' },
  { id: '115', detail: 'Retenues sur loyer professionnel, si applicable' },
  { id: '111', detail: 'Retenues sur salaires ou honoraires, si applicable' },
]

const EXTRA_FORMS = [
  { id: '180', title: 'Modelo 180 · Retenues annuelles sur les loyers', detail: 'Vérifier le récapitulatif annuel des retenues déclarées sur les loyers professionnels.' },
  { id: '390', title: 'Modelo 390 · Récapitulatif annuel de TVA', detail: 'Vérifier si tu dois le déposer ou si tu es dispensée.' },
  { id: '100', title: 'Modelo 100 · Renta annuelle', detail: 'Vérifier les revenus, la situation familiale et les acomptes IRPF.' },
  { id: 'RETA', title: 'Cotisations Seguridad Social', detail: 'Prélèvement habituel le dernier jour ouvrable du mois. Vérifier le montant et le reçu dans Importass.' },
]
const MODELS = [...FORMS, ...EXTRA_FORMS]
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })

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

const YEARS = [2025, 2026, 2027]
const QUARTERS = [1, 2, 3, 4]
const FILING_ROWS = [
  ...QUARTERS.flatMap(quarter => FORMS.map(form => ({
    key: 'T' + quarter + ':' + form.id, quarter, model: form.id,
    title: 'T' + quarter + ' · Modelo ' + form.id, detail: form.detail,
  }))),
  ...EXTRA_FORMS.filter(form => form.id !== 'RETA').map(({ id, title, detail }) => ({
    key: 'A:' + id, model: id, title, detail,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    key: 'M' + String(i + 1).padStart(2, '0') + ':RETA', model: 'RETA', month: i + 1,
    title: 'Cotisation · ' + monthName.format(new Date(Date.UTC(2026, i, 1))),
    detail: EXTRA_FORMS.find(form => form.id === 'RETA').detail,
  })),
]
const RETA_STATUS = { ...FILING_STATUS, missing: 'Prélèvement à vérifier', to_prepare: 'À prévoir',
  filed: 'Payée, à rapprocher du reçu' }

const muted = { color: 'var(--txt2, #777)', fontSize: 13 }

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
  const [selectedEntity, setEntity] = useState('independent')
  const [year, setYear] = useState(() => Math.min(2027, Math.max(2025, Number(todayInSpain().slice(0, 4)))))
  const [capture, setCapture] = useState(readPortalCapture)
  const [tab, setTab] = useState(() => capture ? 'portals' : 'overview')
  useEffect(() => {
    function receiveCapture() {
      const incoming = readPortalCapture()
      if (!incoming) return
      setCapture(incoming)
      setTab('portals')
      window.scrollTo(0, 0)
    }
    window.addEventListener('mi-gestoria-portal-capture', receiveCapture)
    receiveCapture()
    return () => window.removeEventListener('mi-gestoria-portal-capture', receiveCapture)
  }, [])
  const studio = useStudioLedger(year)
  const [bank, setBank] = useState([])
  const [quickAction, setQuickAction] = useState(null)
  const { data, personalStart, loadState, saving, feedback: saveFeedback, save, reload } = useGestoriaWorkspace()
  const canSave = loadState === 'ready' && !saving
  const [formFilter, setFormFilter] = useState('all')
  const [feedback, setFeedback] = useState(null)
  const dossiers = ENTITIES
    .map(item => item.id === 'independent' ? { ...item, startDate: personalStart } : item)
    .filter(item => !item.startDate || item.startDate <= year + '-12-31')
    .map(item => dossierFor(data, item, year, TASKS, FILING_ROWS))
  const current = dossiers.find(item => item.id === selectedEntity) || dossiers[0]
  const entity = current.id
  const scope = entity + ':' + year
  const { record, notices, filings, tasks } = current
  const entries = data.entries.filter(row => (row.entity || 'independent') === entity)
  const taskEntries = tab === 'tasks' ? [
    ...entries, ...contributionInputs(entries, current, year, todayInSpain()).confirmedRows,
  ] : entries
  const settings = entity === 'independent' ? data.irpf?.[year] : record.irpf
  const completed = tasks.filter(task => isComplete(task.status)).length
  const fileBase = 'mi-gestoria-' + entity + '-' + year

  function openDossier(nextEntity, nextTab, model = 'all', declarationsOnly = false) {
    setQuickAction(null)
    setEntity(nextEntity)
    setTab(nextTab)
    setFormFilter(declarationsOnly && model === 'all' ? 'declarations' : model)
    setFeedback(null)
    window.scrollTo(0, 0)
  }

  function launchQuickAction(nextEntity, kind) {
    openDossier(nextEntity, 'finance')
    setQuickAction({ kind, nonce: Date.now() })
  }

  function updateRecord(changes) {
    return save(current => ({
      ...current, records: { ...current.records, [scope]: { ...record, ...changes } },
    }))
  }

  function discardCapture() {
    sessionStorage.removeItem(captureKey)
    setCapture(null)
  }

  async function savePortalCheck(kind, check) {
    const saved = await save(data => ({
      ...data, records: { ...data.records, [scope]: applyPortalCheck(record, kind, check) },
    }))
    if (saved) {
      const currentCapture = readPortalCapture()
      if (!currentCapture || currentCapture.capturedAt === check.capturedAt) discardCapture()
    }
    return saved
  }

  function setStatus(group, key, status) {
    return updateRecord({ [group]: { ...record[group], [key]: status } })
  }

  function saveFilingDetails(key, details, filed, boxes) {
    return save(workspace => {
      const changes = { ...record, filingDetails: { ...record.filingDetails, [key]: details } }
      if (filed) changes.filings = { ...record.filings, [key]: 'filed' }
      else if (record.filings[key] === 'filed') changes.filings = { ...record.filings, [key]: 'unknown' }
      let irpf = workspace.irpf
      if (key.endsWith(':130') && (boxes || !filed)) {
        const quarter = Number(key[1])
        const previous = settings || { basis: 'accrual', filed: {} }
        const declared = { ...previous.filed }
        if (boxes) declared[quarter] = boxes
        else delete declared[quarter]
        const next = { ...previous, filed: declared }
        if (entity === 'independent') irpf = { ...irpf, [year]: next }
        else changes.irpf = next
      }
      return { ...workspace, ...(irpf && { irpf }), records: { ...workspace.records, [scope]: changes } }
    })
  }

  function saveIrpf(entityId, value) {
    if (entityId === 'independent') return save(workspace => ({ ...workspace, irpf: { ...workspace.irpf, [year]: value } }))
    return save(workspace => {
      const key = entityId + ':' + year
      const previous = workspace.records[key] || { tasks: {}, filings: {}, notices: [] }
      return { ...workspace, records: { ...workspace.records, [key]: { ...previous, irpf: value } } }
    })
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

  function exportBackup() {
    const savedFilings = Object.fromEntries(filings.filter(row => row.key in record.filings)
      .map(row => [row.key, row.status]))
    const backup = { version: 1, entity, year, tasks: record.tasks, filings: savedFilings }
    download(fileBase + '.json', JSON.stringify(backup, null, 2), 'application/json')
  }

  function exportChecklist() {
    const lines = ['Mi Gestoría — suivi préparatoire', current.name + ' · ' + year, '', 'Démarches et pièces']
    for (const task of tasks) lines.push(task.title + ' · ' + TASK_STATUS[record.tasks[task.id] || 'unknown'])
    lines.push('', 'Déclarations et cotisations à vérifier')
    for (const row of filings) lines.push(row.title + ' · ' + FILING_STATUS[row.status])
    download(fileBase + '.txt', lines.join('\n'), 'text/plain;charset=utf-8')
  }

  return <main className="mg-shell">
    <div className="mg-toolbar">
      <nav className="mg-main-nav" aria-label="Sections de Mi Gestoría">
        {sections.map(([id, label, icon]) =>
          <button type="button" key={id} aria-pressed={tab === id} onClick={() => {
            setQuickAction(null)
            setTab(id)
            if (id === 'inbox') setEntity('blackthorn')
            if (id === 'tasks') setFormFilter('all')
          }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d={icon} /></svg>{label}{id === 'inbox' && data.inbox?.length > 0 && ' (' + data.inbox.length + ')'}</button>)}
      </nav>
      <div className="mg-toolbar-filters">
        {tab !== 'overview' && tab !== 'inbox' && <label>Dossier <select value={entity} onChange={event => { setEntity(event.target.value); setFeedback(null) }}>
          {dossiers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        <label>Exercice <select value={year} onChange={event => { setYear(Number(event.target.value)); setFeedback(null) }}>
          {YEARS.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>
    </div>
    {pageCopy[tab] && <header className="mg-page-heading">
      <div><p className="mg-section-label">{current.name.toUpperCase()} · {year}</p>
        <h1>{pageCopy[tab][0]}</h1>
        <p>{pageCopy[tab][1]}</p></div>
      {current.startDate && <span className="mg-tag calm">Suivi depuis le {formatDate(current.startDate)}</span>}
    </header>}
    {tab === 'overview' && loadState === 'ready' && <GestoriaDashboard
      year={year} dossiers={dossiers} personalStart={personalStart} entries={data.entries} studio={studio} onOpen={openDossier}
      irpf={data.irpf?.[year]} canSave={canSave} selectedActivity={entity} onActivity={setEntity} inboxCount={data.inbox?.length || 0} onQuickAction={launchQuickAction}
      onIrpf={saveIrpf} />}
    {loadState === 'loading' && <p role="status">Chargement de ton dossier privé…</p>}
    {loadState === 'error' && <div role="alert">
      <p>Le dossier privé n’a pas pu être chargé.</p>
      <button onClick={reload}>Réessayer</button>
    </div>}
    {saveFeedback && <div className="mg-save-feedback" role={saveFeedback.error ? 'alert' : 'status'}>
      <p>{saveFeedback.text}</p>
      {saveFeedback.error && <button disabled={saving} onClick={reload}>Recharger le dossier</button>}
    </div>}
    {tab === 'portals' && loadState === 'ready' &&
      <GestoriaPortals capture={capture} year={year} dossier={current} canSave={canSave}
        onSave={savePortalCheck} onDiscard={discardCapture} />}
    {tab === 'inbox' && loadState === 'ready' &&
      <GestoriaInbox items={data.inbox || []} year={year} canSave={canSave} reload={reload}
        onResolve={(id, decision) => save(workspace => resolveInboxItem(workspace, id, decision))} />}
    {tab === 'archives' && loadState === 'ready' &&
      <GestoriaArchives key={scope} record={record} canSave={canSave}
        onAdd={item => save(workspace => {
          const latest = workspace.records[scope] || record
          return { ...workspace, records: { ...workspace.records, [scope]: {
            ...latest, archives: [...(latest.archives || []).filter(doc => doc.id !== item.id), item],
          } } }
        })} />}
    {tab === 'guide' && loadState === 'ready' &&
      <GestoriaGuide key={scope} year={year} startDate={current.startDate} notices={notices} filings={filings}
        tasks={tasks}
        canSave={canSave} canAddNotice={record.notices.length < 50} onNotices={updated => updateRecord({
          notices: [...record.notices.filter(notice => !notices.includes(notice)), ...updated],
        })} onTasks={() => setTab('tasks')} />}
    {tab === 'finance' && loadState === 'ready' && <>
      {entity === 'blackthorn' && <StudioData ledger={studio} />}
      <PersonalData key={scope + (quickAction?.nonce || '')} initialAction={quickAction?.kind} entity={entity} year={year} startDate={current.startDate} entries={entries}
        canSave={canSave} canAdd={data.entries.length < 1000}
        onEntries={updated => save(workspace => ({ ...workspace, entries: [
          ...workspace.entries.filter(row => (row.entity || 'independent') !== entity),
          ...updated.map(row => ({ ...row, ...(entity === 'blackthorn' && { entity }) })),
        ] }))}
        bank={entity === 'independent' ? bank : undefined} onBank={setBank} />
    </>}
    {tab === 'payments' && loadState === 'ready' &&
      <GestoriaPayments year={year} dossier={current} data={data} onOpen={openDossier} studio={entity === 'blackthorn' ? studio : undefined} />}
    {tab === 'tasks' && loadState === 'ready' && <>

    {formFilter === 'all' && <section className="mg-panel mg-ledger-panel">
      <p className="mg-section-label">LISTE DE CONTRÔLE</p><h2>Démarches et pièces</h2>
      <p style={muted}>{completed} sur {tasks.length} vérifiées, terminées ou non concernées.</p>
      {tasks.map(task => <div key={task.id} className="mg-work-row">
        <div style={{ flex: '1 1 260px' }}>
          <strong>{task.title}</strong>
          <div style={muted}>{task.detail}</div>
          {task.url && <a style={muted} href={task.url} target="_blank" rel="noopener noreferrer">{task.link} ↗</a>}
        </div>
        <StatusSelect title={task.title} status={record.tasks[task.id]} options={TASK_STATUS} disabled={!canSave}
          onChange={status => setStatus('tasks', task.id, status)} />
      </div>)}
    </section>}

    <section className="mg-panel mg-ledger-panel">
      <p className="mg-section-label">DOSSIER FISCAL</p><h2>Déclarations et cotisations</h2>
      <p style={muted}>Vérifie les obligations sur Hacienda et les prélèvements dans Importass. Enregistre le statut et la référence de chaque justificatif.</p>
      <label>Filtrer par modèle <select value={formFilter} onChange={event => setFormFilter(event.target.value)}>
        <option value="all">Tous</option>
        <option value="declarations">Toutes les déclarations</option>
        {MODELS.map(form => <option key={form.id} value={form.id}>{form.title || 'Modelo ' + form.id}</option>)}
      </select></label>
      <div style={{ marginTop: 12 }}>
        {filings.filter(row => formFilter === 'all' || (formFilter === 'declarations' ? row.model !== 'RETA' : row.model === formFilter)).map(row => <div key={row.key} className="mg-work-row">
          <div><strong>{row.title}</strong><div style={muted}>{row.detail}
            {row.date && ' · ' + formatDate(row.date)}{row.indicative && ' · date à confirmer'}</div>
            <ModelPreparation key={'prep:' + scope + ':' + row.key} row={row} year={year} entries={taskEntries}
              startDate={current.startDate} settings={settings} filings={filings} personal={entity === 'independent' || entries.length > 0} onFinance={() => setTab('finance')} />
            <GestoriaFilingDetails key={scope + ':' + row.key + ':' + row.status} row={row} canSave={canSave}
              declaredBoxes={row.model === '130' ? settings?.filed?.[row.quarter] : undefined} onSave={saveFilingDetails} />
          </div>
          <StatusSelect title={'Statut ' + row.title} status={record.filings[row.key]} options={row.model === 'RETA' ? RETA_STATUS : FILING_STATUS}
            disabled={!canSave} onChange={status => setStatus('filings', row.key, status)} />
        </div>)}
      </div>
    </section>

    <section className="mg-panel mg-ledger-panel">
      <p className="mg-section-label">SAUVEGARDE</p><h2>Exporter ou reprendre</h2>
      <p style={muted}>Chaque export concerne uniquement le dossier et l’année affichés. Les statuts sont enregistrés dans ton dossier. Cette copie facultative contient les statuts des démarches et déclarations.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={exportChecklist}>Exporter la checklist</button>
        <button onClick={exportBackup}
         >Télécharger la sauvegarde</button>
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
