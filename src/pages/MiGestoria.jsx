import React, { useEffect, useState } from 'react'
import { PersonalData, StudioData, useStudioLedger } from './GestoriaData'
import { GestoriaPayments, ModelPreparation } from './GestoriaModels'
import GestoriaGuide from './GestoriaGuide'
import GestoriaDashboard from './GestoriaDashboard'
import GestoriaPortals from './GestoriaPortals'
import { applyPortalCheck, captureKey, readPortalCapture } from '../lib/gestoria-portal.mjs'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { dossierFor, isComplete } from '../lib/gestoria-dashboard.mjs'
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
  { id: '349', detail: 'Opérations intracommunautaires. Vérifier si la périodicité est trimestrielle ou mensuelle.' },
  { id: '115', detail: 'Retenues sur loyer professionnel, si applicable' },
  { id: '111', detail: 'Retenues sur salaires ou honoraires, si applicable' },
]

const EXTRA_FORMS = [
  { id: '390', title: 'Modelo 390 · Récapitulatif annuel de TVA', detail: 'Vérifier si tu dois le déposer ou si tu es dispensée.' },
  { id: '100', title: 'Modelo 100 · Renta annuelle', detail: 'Vérifier les revenus, la situation familiale et les acomptes IRPF.' },
  { id: 'RETA', title: 'Cotisations Seguridad Social', detail: 'Prélèvement habituel le dernier jour ouvrable du mois. Vérifier le montant et le reçu dans Importass.' },
]
const MODELS = [...FORMS, ...EXTRA_FORMS]
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

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

function FilingDetails({ row, canSave, onSave }) {
  const [reference, setReference] = useState(row.evidence?.reference || '')
  const [amount, setAmount] = useState(row.evidence?.amountCents == null ? '' : String(row.evidence.amountCents / 100))
  async function submit(event) {
    event.preventDefault()
    await onSave(row.key, {
      reference: reference.trim(),
      ...(amount !== '' && { amountCents: Math.round(Number(amount) * 100) }),
    })
  }
  return <details className="mg-filing-evidence">
    <summary>{row.evidence?.reference ? 'Référence enregistrée' : 'Ajouter la référence du justificatif'}
      {row.evidence?.amountCents != null && ' · ' + euro.format(row.evidence.amountCents / 100)}</summary>
    <form onSubmit={submit}>
      <label>Référence du reçu <input maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label>{row.model === 'RETA' ? 'Montant prélevé' : 'Solde déclaré en €'}
        <input type="number" step="0.01" min="-100000000" max="100000000" value={amount} onChange={e => setAmount(e.target.value)} />
      </label>
      <button type="submit" disabled={!canSave}>Enregistrer</button>
    </form>
  </details>
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
  const completed = tasks.filter(task => isComplete(task.status)).length
  const fileBase = 'mi-gestoria-' + entity + '-' + year

  function openDossier(nextEntity, nextTab, model = 'all') {
    setEntity(nextEntity)
    setTab(nextTab)
    setFormFilter(model)
    setFeedback(null)
    window.scrollTo(0, 0)
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

  function saveFilingDetails(key, details) {
    return updateRecord({ filingDetails: { ...record.filingDetails, [key]: details } })
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
        {[['overview', 'Aujourd’hui'], ['payments', 'Prévisions'], ['portals', 'Portails officiels'], ['tasks', 'Démarches'], ['finance', 'Compta'], ['guide', 'Courriers']].map(([id, label]) =>
          <button type="button" key={id} aria-pressed={tab === id} onClick={() => {
            setTab(id)
            if (id === 'tasks') setFormFilter('all')
          }}>{label}</button>)}
      </nav>
      <div className="mg-toolbar-filters">
        {tab !== 'overview' && <label>Dossier <select value={entity} onChange={event => { setEntity(event.target.value); setFeedback(null) }}>
          {dossiers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        <label>Exercice <select value={year} onChange={event => { setYear(Number(event.target.value)); setFeedback(null) }}>
          {YEARS.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>
    </div>
    {tab !== 'overview' && <div className="mg-detail-heading">
      <h1>{current.name}</h1>
      <p>{current.subtitle} · Exercice {year}{current.startDate && ' · Suivi depuis le ' + formatDate(current.startDate)}</p>
    </div>}
    {tab === 'overview' && loadState === 'ready' && <GestoriaDashboard
      year={year} dossiers={dossiers} personalStart={personalStart} entries={data.entries} studio={studio} onOpen={openDossier}
      irpf={data.irpf?.[year]} canSave={canSave}
      onIrpf={settings => save(current => ({ ...current, irpf: { ...current.irpf, [year]: settings } }))} />}
    {loadState === 'loading' && <p role="status">Chargement de ton dossier privé…</p>}
    {loadState === 'error' && <div role="alert">
      <p>Le dossier privé n’a pas pu être chargé.</p>
      <button onClick={reload}>Réessayer</button>
    </div>}
    {saveFeedback && <div role={saveFeedback.error ? 'alert' : 'status'}>
      <p>{saveFeedback.text}</p>
      {saveFeedback.error && <button disabled={saving} onClick={reload}>Recharger le dossier</button>}
    </div>}
    {tab === 'portals' && loadState === 'ready' &&
      <GestoriaPortals capture={capture} year={year} dossier={current} canSave={canSave}
        onSave={savePortalCheck} onDiscard={discardCapture} />}
    {tab === 'guide' && loadState === 'ready' &&
      <GestoriaGuide key={scope} year={year} startDate={current.startDate} notices={notices} filings={filings}
        tasks={tasks}
        canSave={canSave} canAddNotice={record.notices.length < 50} onNotices={updated => updateRecord({
          notices: [...record.notices.filter(notice => !notices.includes(notice)), ...updated],
        })} onTasks={() => setTab('tasks')} />}
    {tab === 'finance' && (entity === 'blackthorn' ? <StudioData ledger={studio} /> :
      loadState === 'ready' && <PersonalData key={scope} year={year} startDate={current.startDate} entries={data.entries} canSave={canSave}
        onEntries={entries => save(current => ({ ...current, entries }))} bank={bank} onBank={setBank} />)}
    {tab === 'payments' && loadState === 'ready' &&
      <GestoriaPayments year={year} dossier={current} data={data} onOpen={openDossier} />}
    {tab === 'tasks' && loadState === 'ready' && <>

    {formFilter === 'all' && <section style={card}>
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
    </section>}

    <section style={card}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Déclarations et cotisations</h2>
      <p style={muted}>Vérifie les obligations sur Hacienda et les prélèvements dans Importass. Enregistre le statut et la référence de chaque justificatif.</p>
      <label>Filtrer par modèle <select value={formFilter} onChange={event => setFormFilter(event.target.value)}>
        <option value="all">Tous</option>
        {MODELS.map(form => <option key={form.id} value={form.id}>{form.title || 'Modelo ' + form.id}</option>)}
      </select></label>
      <div style={{ marginTop: 12 }}>
        {filings.filter(row => formFilter === 'all' || row.key.endsWith(':' + formFilter)).map(row => <div key={row.key} style={rowStyle}>
          <div><strong>{row.title}</strong><div style={muted}>{row.detail}
            {row.date && ' · ' + formatDate(row.date)}{row.indicative && ' · date à confirmer'}</div>
            <ModelPreparation key={'prep:' + scope + ':' + row.key} row={row} year={year} entries={data.entries}
              startDate={current.startDate} settings={data.irpf?.[year]} personal={entity === 'independent'} onFinance={() => setTab('finance')} />
            <FilingDetails key={scope + ':' + row.key} row={row} canSave={canSave} onSave={saveFilingDetails} />
          </div>
          <StatusSelect title={'Statut ' + row.title} status={record.filings[row.key]} options={row.model === 'RETA' ? RETA_STATUS : FILING_STATUS}
            disabled={!canSave} onChange={status => setStatus('filings', row.key, status)} />
        </div>)}
      </div>
    </section>

    <section style={card}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Exporter ou reprendre</h2>
      <p style={muted}>Chaque export concerne uniquement le dossier et l’année affichés. Les statuts sont enregistrés dans ton dossier. Cette copie facultative contient les statuts des démarches et déclarations.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={exportChecklist} style={buttonStyle}>Exporter la checklist</button>
        <button onClick={exportBackup}
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
