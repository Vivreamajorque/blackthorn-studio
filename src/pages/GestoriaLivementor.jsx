import React, { useMemo, useState } from 'react'
import { useLivementor, livementorEstimate, money, uid } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import './gestoria-clients.css'
import './gestoria-livementor.css'

// Suivi des apprenants LiveMentor (« La Méthode Mentor ») intégré au QG.
export const STATUTS = [
  ['a_contacter', 'À contacter'], ['contact_fait', 'Contact fait'], ['diagnostic_fait', 'Diagnostic fait'],
  ['en_cours', 'En formation'], ['oral_prog', 'Oral programmé'], ['certifie', 'Certifié'], ['termine', 'Terminé'], ['abandon', 'Abandon'],
]
const FORMATS = [['3_classique', 'Classique 3 mois'], ['classique_2mois', 'Classique 2 mois'], ['intensif', 'Intensif'], ['autre', 'Autre']]
const label = (list, v) => list.find(([k]) => k === v)?.[1] || (v ? String(v).replace(/_/g, ' ') : '—')
const d = v => v ? formatDate(String(v).slice(0, 10)) : '—'
const first = nom => String(nom || '').split(' ')[0]
const openTasks = a => (a.taches || []).filter(t => !t.fait)
const LINKS = [['driveUrl', 'Drive'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['site', 'Site'], ['linkedin', 'LinkedIn']]
const href = u => !u ? null : /^https?:\/\//.test(u) ? u : 'https://' + u

export default function GestoriaLivementor({ crm }) {
  const store = useLivementor()
  const list = store.data.apprenants || []
  const [showArchive, setShowArchive] = useState(false)
  const [sel, setSel] = useState(null)
  const today = todayInSpain()
  const shown = useMemo(() => list.filter(a => !!a.archive === showArchive)
    .sort((a, b) => (a.prochain || '9999').localeCompare(b.prochain || '9999') || a.nom.localeCompare(b.nom)), [list, showArchive])
  const current = list.find(a => a.id === sel) || null
  const e = livementorEstimate(crm?.livementor, today)
  const orals = list.filter(a => !a.archive && a.certification && a.certification >= today).sort((a, b) => a.certification.localeCompare(b.certification))
  const tasks = list.filter(a => !a.archive).reduce((s, a) => s + openTasks(a).length, 0)

  const update = (id, patch, msg = 'Fiche mise à jour.') => store.save(data => ({ ...data, apprenants: data.apprenants.map(a => a.id === id ? { ...a, ...(typeof patch === 'function' ? patch(a) : patch) } : a) }), msg)
  const add = () => {
    const nom = window.prompt('Nom de l’apprenant(e) ?')
    if (!nom || !nom.trim()) return
    const id = nom.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6)
    store.save(data => ({ ...data, apprenants: [...data.apprenants, { id, nom: nom.trim(), statut: 'a_contacter', format: '3_classique', contact: today, journal: [], taches: [], indicateurs: [] }] }), 'Apprenant ajouté.')
      .then(ok => ok && setSel(id))
  }

  if (store.loadState === 'loading') return <p className="mg-empty">Chargement du suivi…</p>
  if (store.loadState === 'error') return <p className="mg-error">Le suivi LiveMentor est momentanément inaccessible. <button onClick={store.reload}>Réessayer</button></p>

  return <div className="lm">
    <header className="lm-head">
      <div><p className="lm-kicker">La Méthode Mentor · LiveMentor</p><h1>Suivi des apprenants</h1></div>
      <button className="mgc-primary" disabled={store.saving} onClick={add}>+ Apprenant</button>
    </header>
    {store.feedback && <p className={store.feedback.error ? 'mg-error' : 'mgc-muted'} role="status">{store.feedback.text}</p>}

    <section className="lm-kpis">
      <div><span>En suivi</span><strong>{list.filter(a => !a.archive).length}</strong><small>fiches actives</small></div>
      <div><span>Gagné ce mois-ci</span><strong>{e ? money(e.estimate) : '—'}</strong><small>{e ? e.actifs + ' apprenants facturables' : 'pas encore de relevé'}</small></div>
      <div><span>Prochain oral</span><strong>{orals[0] ? d(orals[0].certification) : '—'}</strong><small>{orals[0] ? first(orals[0].nom) + (orals.length > 1 ? ' · +' + (orals.length - 1) : '') : 'aucun programmé'}</small></div>
      <div className={tasks ? 'warn' : ''}><span>Tâches ouvertes</span><strong>{tasks}</strong><small>tous apprenants</small></div>
    </section>

    <div className="lm-body">
      <aside className="lm-list">
        <div className="mgc-tabs" style={{ margin: '0 0 8px' }}>
          <button aria-pressed={!showArchive} onClick={() => setShowArchive(false)}>En cours</button>
          <button aria-pressed={showArchive} onClick={() => setShowArchive(true)}>Archivés</button>
        </div>
        {shown.length === 0 ? <p className="mgc-muted">{showArchive ? 'Aucune fiche archivée.' : 'Aucun apprenant. Ajoute le premier.'}</p> :
          shown.map(a => {
            const late = a.prochain && a.prochain < today
            const n = openTasks(a).length
            return <button key={a.id} className={'lm-item' + (a.id === sel ? ' on' : '')} onClick={() => setSel(a.id)}>
              <span className="lm-avatar">{first(a.nom)[0]}</span>
              <span className="lm-item-main"><strong>{a.nom}</strong>
                <small><span className={'lm-st st-' + (a.statut || '')}>{label(STATUTS, a.statut)}</span>
                  {a.prochain && <span className={late ? 'late' : ''}> · RDV {d(a.prochain)}</span>}
                  {a.certification && <span> · Oral {d(a.certification)}</span>}</small></span>
              {n > 0 && <b className="lm-count" title="Tâches ouvertes">{n}</b>}
            </button>
          })}
      </aside>
      <main className="lm-fiche">
        {!current ? <div className="lm-empty"><p>Choisis un apprenant à gauche.</p><p className="mgc-muted">Tu y retrouves son diagnostic, son coaching, son journal de suivi et ses tâches.</p></div>
          : <Fiche key={current.id} a={current} saving={store.saving} update={(p, m) => update(current.id, p, m)} today={today} />}
      </main>
    </div>
  </div>
}

function Fiche({ a, saving, update, today }) {
  const [tab, setTab] = useState('suivi')
  const [note, setNote] = useState('')
  const [task, setTask] = useState('')
  const diag = a.diag || {}
  const co = a.coaching || {}
  const links = LINKS.map(([k, l]) => [l, href(k === 'driveUrl' ? a.driveUrl : a.internet?.[k])]).filter(([, u]) => u)
  const journal = (a.journal || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''))
  const taches = (a.taches || []).slice().sort((x, y) => Number(x.fait) - Number(y.fait) || (y.createdAt || '').localeCompare(x.createdAt || ''))
  const field = (k, v) => update({ [k]: v })

  return <article>
    <header className="lm-fiche-head">
      <div><h2>{a.nom}</h2>
        <p className="mgc-muted">{label(FORMATS, a.format)}{a.objectif ? ' · ' + a.objectif.slice(0, 120) : ''}</p></div>
      <div className="mgc-row">
        {links.map(([l, u]) => <a key={l} className="lm-link" href={u} target="_blank" rel="noreferrer">{l} ↗</a>)}
        <button className="mgc-link" disabled={saving} onClick={() => field('archive', !a.archive)}>{a.archive ? 'Désarchiver' : 'Archiver'}</button>
      </div>
    </header>

    <div className="lm-fields">
      <label>Statut<select value={a.statut || ''} disabled={saving} onChange={ev => field('statut', ev.target.value)}>
        {!STATUTS.some(([k]) => k === a.statut) && a.statut && <option value={a.statut}>{label(STATUTS, a.statut)}</option>}
        {STATUTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Format<select value={a.format || ''} disabled={saving} onChange={ev => field('format', ev.target.value)}>
        {FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label>Diagnostic<input type="date" value={a.diagnostic || ''} disabled={saving} onChange={ev => field('diagnostic', ev.target.value)} /></label>
      <label className={a.prochain && a.prochain < today ? 'late' : ''}>Prochain RDV<input type="date" value={a.prochain || ''} disabled={saving} onChange={ev => field('prochain', ev.target.value)} /></label>
      <label>Oral de certification<input type="date" value={a.certification || ''} disabled={saving} onChange={ev => field('certification', ev.target.value)} /></label>
    </div>

    <div className="mgc-tabs" style={{ marginTop: 14 }}>
      {[['suivi', 'Suivi'], ['coaching', 'Coaching'], ['diagnostic', 'Diagnostic'], ['profil', 'Profil'], ['conduite', 'Ma conduite']].map(([k, l]) =>
        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
    </div>

    {tab === 'suivi' && <div className="lm-grid">
      <section className="mgc-panel">
        <h3>Tâches</h3>
        <div className="lm-add"><input placeholder="Nouvelle tâche (ex. relancer sur le livrable 2)" value={task} onChange={ev => setTask(ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter' && task.trim()) update(x => ({ taches: [...(x.taches || []), { id: uid('t'), texte: task.trim(), fait: false, createdAt: new Date().toISOString(), source: 'manuel' }] }), 'Tâche ajoutée.').then(ok => ok && setTask('')) }} />
          <button disabled={saving || !task.trim()} onClick={() => update(x => ({ taches: [...(x.taches || []), { id: uid('t'), texte: task.trim(), fait: false, createdAt: new Date().toISOString(), source: 'manuel' }] }), 'Tâche ajoutée.').then(ok => ok && setTask(''))}>Ajouter</button></div>
        {taches.length === 0 ? <p className="mgc-muted">Aucune tâche.</p> : <ul className="mgc-list">{taches.map(t => <li key={t.id} style={{ display: 'block' }} className={t.fait ? 'lm-done' : ''}>
          <label className="lm-task"><input type="checkbox" checked={!!t.fait} disabled={saving} onChange={() => update(x => ({ taches: x.taches.map(y => y.id === t.id ? { ...y, fait: !y.fait } : y) }), t.fait ? 'Tâche rouverte.' : 'Tâche faite.')} />
            <span>{t.texte}<small>{t.createdAt ? ' · ' + d(t.createdAt) : ''}</small></span></label>
          {t.analyse?.brouillon && <details className="lm-draft"><summary>Brouillon de réponse</summary><p>{t.analyse.texte}</p><pre>{t.analyse.brouillon}</pre>
            <button className="mgc-link" onClick={() => navigator.clipboard?.writeText(t.analyse.brouillon)}>Copier</button></details>}
        </li>)}</ul>}
      </section>
      <section className="mgc-panel">
        <h3>Journal de suivi</h3>
        <div className="mgc-form"><textarea rows={3} placeholder="Note de séance, échange, décision…" value={note} onChange={ev => setNote(ev.target.value)} /></div>
        <button className="mgc-primary" style={{ marginTop: 6 }} disabled={saving || !note.trim()} onClick={() => update(x => ({ journal: [...(x.journal || []), { date: today, texte: note.trim(), source: 'manuel' }] }), 'Note ajoutée.').then(ok => ok && setNote(''))}>Ajouter au journal</button>
        {journal.length === 0 ? <p className="mgc-muted">Pas encore de note.</p> : <ol className="lm-journal">{journal.map((j, i) => <li key={i}><time>{d(j.date)}{j.source === 'transcription' ? ' · visio' : ''}</time><p>{j.texte}</p></li>)}</ol>}
        {diag.notes && <details className="lm-draft" style={{ marginTop: 10 }}><summary>Historique des échanges</summary><p style={{ whiteSpace: 'pre-line' }}>{diag.notes}</p></details>}
        {a.notes && <p className="mgc-muted" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>{a.notes}</p>}
      </section>
      {(a.indicateurs || []).length > 0 && <section className="mgc-panel" style={{ gridColumn: '1 / -1' }}>
        <h3>Indicateurs</h3>
        <div className="mgc-tiles" style={{ marginBottom: 0 }}>{a.indicateurs.map((x, i) => <div key={i} className="mgc-tile"><strong>{x.valeur}</strong><span>{x.label}{x.date ? ' · ' + d(x.date) : ''}</span></div>)}</div>
      </section>}
    </div>}

    {tab === 'coaching' && <div className="lm-grid">
      {!co.profilPsychologique && !co.commentLuiParler ? <p className="mgc-muted">Pas encore de coaching pour cette fiche. Demande à Claude : « prépare le coaching de {first(a.nom)} ».</p> : <>
        <section className="mgc-panel" style={{ gridColumn: '1 / -1' }}><h3>Profil</h3><p>{co.profilPsychologique}</p>
          {co.commentLuiParler && <><h4>Comment lui parler</h4><p>{co.commentLuiParler}</p></>}</section>
        <List title="Priorités adaptées" items={co.prioritesAdaptees} />
        <List title="Points de vigilance" items={co.pointsVigilance} tone="warn" />
        <List title="Plan de progression" items={co.planProgression} ordered wide />
        {co.generatedAt && <p className="mgc-muted">Généré le {d(co.generatedAt)}</p>}
      </>}
    </div>}

    {tab === 'diagnostic' && <div className="lm-grid">
      {[['Contexte & projet', diag.contexte], ['Contraintes', diag.contraintes], ['Motivation', diag.motivation], ['Objectif', a.objectif || diag.objectif]].filter(([, v]) => v).map(([t, v]) =>
        <section key={t} className="mgc-panel"><h3>{t}</h3><p style={{ whiteSpace: 'pre-line' }}>{v}</p></section>)}
      {diag.smart && <section className="mgc-panel" style={{ gridColumn: '1 / -1' }}><h3>Objectif SMART</h3>
        <dl className="lm-smart">{[['s', 'Spécifique'], ['m', 'Mesurable'], ['a', 'Atteignable'], ['r', 'Réaliste'], ['t', 'Temporel']].map(([k, l]) => diag.smart[k] && <div key={k}><dt>{l}</dt><dd>{diag.smart[k]}</dd></div>)}</dl></section>}
      <section className="mgc-panel" style={{ gridColumn: '1 / -1' }}><h3>Cadre de certification</h3>
        <div className="mgc-row" style={{ flexWrap: 'wrap' }}>
          {[['cadreRappele', 'Cadre rappelé'], ['certifGuideTransmis', 'Guide de certification transmis'], ['oralBooke', 'Oral réservé']].map(([k, l]) =>
            <label key={k} className="lm-check"><input type="checkbox" checked={!!diag[k]} disabled={saving} onChange={() => update(x => ({ diag: { ...(x.diag || {}), [k]: !(x.diag || {})[k] } }))} /> {l}</label>)}
        </div>
        <h4>Livrables</h4>
        <div className="mgc-row" style={{ flexWrap: 'wrap' }}>
          {[['carte', '1 · Carte empathique'], ['concurrence', '2 · Concurrence & positionnement'], ['analyse', '3 · Analyse'], ['canaux', '4 · Canaux'], ['communication', '5 · Plan de communication']].map(([k, l]) =>
            <label key={k} className="lm-check"><input type="checkbox" checked={!!diag.livrables?.[k]} disabled={saving} onChange={() => update(x => ({ diag: { ...(x.diag || {}), livrables: { ...((x.diag || {}).livrables || {}), [k]: !((x.diag || {}).livrables || {})[k] } } }))} /> {l}</label>)}
        </div>
      </section>
    </div>}

    {tab === 'profil' && <div>
      {!a.profil?.sections?.length ? <p className="mgc-muted">Pas de questionnaire d’entrée enregistré.</p> :
        a.profil.sections.map(([titre, qs], i) => <section key={i} className="mgc-panel"><h3>{titre}</h3>
          <dl className="lm-qa">{(qs || []).filter(([, r]) => r).map(([q, r], j) => <div key={j}><dt>{q}</dt><dd>{r}</dd></div>)}</dl></section>)}
    </div>}

    {tab === 'conduite' && <section className="mgc-panel">
      <h3>Miroir de ma conduite d’entretien</h3>
      {!(a.conduite || []).length ? <p className="mgc-muted">Rien pour cette fiche. Donne une transcription de visio à Claude pour obtenir une lecture de ta conduite.</p> :
        <ol className="lm-journal">{a.conduite.slice().reverse().map((c, i) => <li key={i}><time>{d(c.date)}</time><p>{c.texte}</p></li>)}</ol>}
    </section>}
  </article>
}

function List({ title, items, tone, ordered, wide }) {
  if (!items?.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return <section className={'mgc-panel' + (tone ? ' lm-' + tone : '')} style={wide ? { gridColumn: '1 / -1' } : undefined}><h3>{title}</h3>
    <Tag className="lm-bullets">{items.map((x, i) => <li key={i}>{x}</li>)}</Tag></section>
}
