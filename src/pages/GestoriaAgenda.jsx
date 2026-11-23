import React, { useEffect, useMemo, useState } from 'react'
import { uid } from '../lib/gestoria-crm'
import { todayInSpain } from '../lib/gestoria-calendar.mjs'
import { Dialog } from './GestoriaClients'
import './gestoria-clients.css'

// Couleurs validées (contraste, daltonisme) ; chaque événement porte aussi son libellé, jamais la couleur seule.
export const TYPES = {
  client: { label: 'Clients', color: '#00897b' },
  prospection: { label: 'Prospection', color: '#2a78d6' },
  compta: { label: 'Compta', color: '#d07a2e' },
  livementor: { label: 'LiveMentor', color: '#e87ba4' },
  google: { label: 'Google Agenda', color: '#7a6fd0' },
  entreprise: { label: 'Agenda entreprise', color: '#8a5a3c' },
  perso: { label: 'Mes rendez-vous', color: '#c0457a' },
}
const SOURCE_TYPES = { google: 'Agenda principal', livementor: 'LiveMentor', perso: 'Perso', autre: 'Autre' }
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const mondayOf = d => { const x = new Date(d + 'T12:00:00Z'); const w = (x.getUTCDay() + 6) % 7; return addDays(d, -w) }
const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const hour = e => e.allDay ? 'Journée' : e.start.slice(11, 16) + (e.end && e.end.slice(0, 10) === e.start.slice(0, 10) ? ' – ' + e.end.slice(11, 16) : '')
// Un événement sur plusieurs jours apparaît chaque jour qu'il couvre.
const covers = (e, day) => e.start.slice(0, 10) === day || (e.end && e.start.slice(0, 10) < day && e.end.slice(0, 10) >= day && (e.allDay || e.end.slice(0, 10) > day || e.end.slice(11) > '00:00'))

function Chip({ event, onOpen }) {
  const t = TYPES[event.type] || TYPES.google
  return <button type="button" className="qga-event" style={{ borderLeftColor: t.color }} onClick={() => onOpen(event)} title={event.type === 'perso' ? 'Modifier ou supprimer' : 'Voir le détail'}>
    <span className="qga-time">{hour(event)}</span>
    <span className="qga-title">{event.title}</span>
    <span className="qga-type"><i style={{ background: t.color }} />{event.type === 'entreprise' && event.source ? event.source : t.label}{event.lieu ? ' · ' + event.lieu : ''}</span>
  </button>
}

// Détail d'un événement qui ne vient pas du QG (Google, LiveMentor, échéances) : on l'ouvre là où il se modifie.
function EventSheet({ event, onClose, onNew, onGo }) {
  const t = TYPES[event.type] || TYPES.google
  const d = event.start.slice(0, 10)
  const google = ['google', 'livementor'].includes(event.type) || event.source === 'Mon agenda'
  const gUrl = 'https://calendar.google.com/calendar/r/day/' + d.replace(/-/g, '/')
  const qg = { client: ['clients', 'Ouvrir le client'], prospection: ['prospection', 'Ouvrir Développer'], compta: ['finance', 'Ouvrir la compta'] }[event.type]
  const lien = /^https?:\/\//.test(event.lieu || '') ? event.lieu : ''
  return <Dialog title={event.title} onClose={onClose}
    footer={<>
      <button onClick={() => onNew(d)}>+ Rendez-vous ce jour-là</button>
      {google && <a className="mgc-primary-link" href={gUrl} target="_blank" rel="noopener noreferrer">Modifier dans Google Agenda ↗</a>}
      {qg && onGo && <button className="mgc-primary" onClick={() => onGo(qg[0])}>{qg[1]}</button>}
    </>}>
    <div className="qga-sheet">
      <p><i style={{ background: t.color }} /> {event.type === 'entreprise' && event.source ? event.source : t.label}</p>
      <p><strong>{dayLabel(d)}</strong> · {hour(event)}</p>
      {event.lieu && (lien ? <p><a href={lien} target="_blank" rel="noopener noreferrer">Rejoindre / ouvrir le lien ↗</a></p> : <p>{event.lieu}</p>)}
      {google && <p className="mgc-muted">Cet événement vient de ton Google Agenda : il se modifie là-bas, et le QG se met à jour tout seul.</p>}
      {!google && !qg && <p className="mgc-muted">Cet événement vient d’un autre agenda relié.</p>}
    </div>
  </Dialog>
}

function Settings({ crm, saveCrm, canSave, feedUrl, sources, importesMaj, onClose }) {
  const [form, setForm] = useState({ label: '', type: 'google', url: '' })
  const [error, setError] = useState('')
  const okUrl = /^(https|webcal):\/\/(calendar\.google\.com|outlook\.live\.com|outlook\.office365\.com|p\d+-caldav\.icloud\.com)\//i.test(form.url.trim())
  async function add() {
    setError('')
    if (!okUrl) return setError('Colle l’« adresse secrète au format iCal » de Google Agenda (elle commence par https://calendar.google.com/calendar/ical/).')
    const ok = await saveCrm(data => ({ ...data, agenda: { ...data.agenda, sources: [...data.agenda.sources, { id: uid('cal'), label: form.label.trim() || SOURCE_TYPES[form.type], type: form.type, url: form.url.trim() }] } }), 'Agenda relié.')
    if (ok) setForm({ label: '', type: 'google', url: '' })
  }
  const remove = id => window.confirm('Retirer cet agenda du QG ? (Il n’est pas supprimé de Google.)') &&
    saveCrm(data => ({ ...data, agenda: { ...data.agenda, sources: data.agenda.sources.filter(s => s.id !== id) } }), 'Agenda retiré.')

  return <Dialog title="Relier tes agendas" onClose={onClose}>
    <div className="mgc-form">
      <section>
        <h3>1. Tes rendez-vous Google dans le QG</h3>
        {crm.agenda.sources.length > 0 && <ul className="mgc-list">{crm.agenda.sources.map(s => {
          const st = sources.find(x => x.id === s.id)
          return <li key={s.id}><div style={{ flex: 1 }}><strong>{s.label}</strong><div className="mgc-muted">{SOURCE_TYPES[s.type]}</div></div>
            {st && <span className={'mgc-badge ' + (st.ok ? 'ok' : 'late')}>{st.ok ? 'Relié · ' + st.count + ' événements' : 'Lecture impossible'}</span>}
            <button disabled={!canSave} onClick={() => remove(s.id)}>Retirer</button></li>
        })}</ul>}
        <ol className="mgc-muted qga-steps">
          <li>Sur ordinateur, ouvre <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer">les paramètres de Google Agenda ↗</a>.</li>
          <li>À gauche, clique sur ton agenda (sous « Paramètres de mes agendas »).</li>
          <li>Descends jusqu’à <strong>« Adresse secrète au format iCal »</strong>, copie-la et colle-la ici.</li>
        </ol>
        <div className="mgc-cols">
          <label>Nom<input placeholder="ex. Agenda pro" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label>
          <label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(SOURCE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label>Adresse secrète iCal<input placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></label>
        <p className="mgc-muted">Cette adresse donne accès à ton agenda : ne la partage avec personne d’autre. Le QG la garde dans ton espace privé. Les rendez-vous qui contiennent « LiveMentor » sont reconnus tout seuls.</p>
        {error && <p className="mgc-error">{error}</p>}
        <button className="mgc-primary" disabled={!canSave || !form.url.trim()} onClick={add}>Relier cet agenda</button>
      </section>
      <section style={{ marginTop: 18 }}>
        <h3>Ton agenda d’entreprise (sans adresse iCal)</h3>
        <p className="mgc-muted">Certaines entreprises bloquent l’adresse secrète iCal. Ton agenda Decathlon est déjà visible depuis ton Google Agenda : un agent le recopie dans le QG trois fois par jour (vers 8 h 40, 12 h 40 et 18 h 40). Rien à coller ici.</p>
        <p className="mgc-muted">{importesMaj ? 'Dernière copie : ' + importesMaj.replace('T', ' à ') : 'Première copie au prochain passage de l’agent.'}</p>
      </section>
      <section style={{ marginTop: 18 }}>
        <h3>2. Le QG dans ton Google Agenda (et sur ton téléphone)</h3>
        <p className="mgc-muted">Échéances fiscales, rendez-vous des projets, relances de prospects et paiements attendus apparaîtront dans Google Agenda, dans un agenda « Le QG ».</p>
        {feedUrl ? <div className="mgc-row">
          <input readOnly value={feedUrl} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 220 }} />
          <button className="mgc-primary" onClick={() => navigator.clipboard?.writeText(feedUrl)}>Copier</button>
        </div> : <p className="mgc-muted">Lien en préparation…</p>}
        <ol className="mgc-muted qga-steps">
          <li>Dans Google Agenda sur ordinateur, à gauche, à côté de « Autres agendas », clique sur <strong>+</strong> puis <strong>« À partir de l’URL »</strong>.</li>
          <li>Colle le lien ci-dessus, puis <strong>« Ajouter un agenda »</strong>.</li>
          <li>Google le met à jour tout seul, en général plusieurs fois par jour (pas en direct).</li>
        </ol>
        <button className="mgc-link" disabled={!canSave} onClick={() => window.confirm('Créer un nouveau lien ? L’ancien ne marchera plus : il faudra le remettre dans Google Agenda.') &&
          saveCrm(data => ({ ...data, agenda: { ...data.agenda, feedToken: '' } }), 'Nouveau lien créé. Recharge la page pour le voir.')}>Remplacer ce lien (s’il a circulé)</button>
      </section>
    </div>
  </Dialog>
}

// Rendez-vous créés dans le QG : ils vont aussi dans Google Agenda (et sur le téléphone) via l'agenda « Le QG ».
function RdvForm({ initial, saveCrm, canSave, onClose }) {
  const editing = initial && initial.id
  const [f, setF] = useState(() => editing
    ? { titre: initial.title, date: initial.start.slice(0, 10), debut: initial.allDay ? '' : initial.start.slice(11, 16), fin: initial.allDay || !initial.end ? '' : initial.end.slice(11, 16), journee: initial.allDay, lieu: initial.lieu || '' }
    : { titre: '', date: initial?.date || todayInSpain(), debut: '09:00', fin: '10:00', journee: false, lieu: '' })
  const [error, setError] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const rawId = editing ? initial.id.replace(/^imp-/, '') : ''
  async function save() {
    setError('')
    if (!f.titre.trim()) return setError('Donne un titre au rendez-vous.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return setError('Choisis une date.')
    if (!f.journee && !/^\d{2}:\d{2}$/.test(f.debut)) return setError('Indique l’heure de début, ou coche « Toute la journée ».')
    if (!f.journee && f.fin && f.fin <= f.debut) return setError('L’heure de fin doit être après l’heure de début.')
    const ev = { id: rawId || 'Le QG|' + uid('rdv'), source: 'Le QG', titre: f.titre.trim(), lieu: f.lieu.trim(),
      debut: f.journee ? f.date : f.date + 'T' + f.debut, fin: f.journee || !f.fin ? '' : f.date + 'T' + f.fin, journee: f.journee }
    const ok = await saveCrm(data => ({ ...data, agenda: { ...data.agenda, importes: [...(data.agenda.importes || []).filter(x => x.id !== ev.id), ev] } }), editing ? 'Rendez-vous modifié.' : 'Rendez-vous ajouté.')
    if (ok) onClose(true)
  }
  async function remove() {
    if (!window.confirm('Supprimer ce rendez-vous du QG ?')) return
    const ok = await saveCrm(data => ({ ...data, agenda: { ...data.agenda, importes: (data.agenda.importes || []).filter(x => x.id !== rawId) } }), 'Rendez-vous supprimé.')
    if (ok) onClose(true)
  }
  return <Dialog title={editing ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'} onClose={() => onClose(false)}
    footer={<>{editing && <button disabled={!canSave} onClick={remove}>Supprimer</button>}<button className="mgc-primary" disabled={!canSave} onClick={save}>{editing ? 'Enregistrer' : 'Ajouter'}</button></>}>
    <div className="mgc-form">
      <label>Titre<input autoFocus placeholder="ex. Visio avec Nisha" value={f.titre} onChange={set('titre')} /></label>
      <div className="mgc-cols">
        <label>Date<input type="date" value={f.date} onChange={set('date')} /></label>
        <label className="mgc-check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.journee} onChange={set('journee')} /> Toute la journée</label>
      </div>
      {!f.journee && <div className="mgc-cols">
        <label>Début<input type="time" value={f.debut} onChange={set('debut')} /></label>
        <label>Fin<input type="time" value={f.fin} onChange={set('fin')} /></label>
      </div>}
      <label>Lieu ou lien (facultatif)<input placeholder="ex. Google Meet, Campos…" value={f.lieu} onChange={set('lieu')} /></label>
      <p className="mgc-muted">Il apparaît aussi dans ton Google Agenda et sur ton téléphone, dans l’agenda « Le QG » (mise à jour par Google plusieurs fois par jour).</p>
      {error && <p className="mgc-error">{error}</p>}
    </div>
  </Dialog>
}

export default function GestoriaAgenda({ crm, saveCrm, canSave, onGo }) {
  const today = todayInSpain()
  const [view, setView] = useState('semaine')
  const [anchor, setAnchor] = useState(today)
  const [hidden, setHidden] = useState(() => new Set())
  const [state, setState] = useState({ load: 'loading' })
  const [settings, setSettings] = useState(false)
  const [reload, setReload] = useState(0)
  const [rdv, setRdv] = useState(null)
  const [detail, setDetail] = useState(null)
  const openEvent = e => e.type === 'perso' && String(e.id).startsWith('imp-') ? setRdv(e) : setDetail(e)

  const range = useMemo(() => {
    if (view === 'semaine') return { from: anchor, to: addDays(anchor, 6) }
    const first = anchor.slice(0, 8) + '01'
    const start = mondayOf(first)
    const last = addDays(addDays(first, 32).slice(0, 8) + '01', -1)
    return { from: start, to: addDays(mondayOf(last), 6), first, last }
  }, [view, anchor])

  const sourcesKey = crm.agenda?.sources.map(s => s.id).join(',')
  useEffect(() => {
    const controller = new AbortController()
    setState(s => ({ ...s, load: 'loading' }))
    fetch(`/api/gestoria-agenda?from=${range.from}&to=${range.to}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (r.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired')); if (!r.ok) throw new Error(); return r.json() })
      .then(data => setState({ load: 'ready', ...data }))
      .catch(() => { if (!controller.signal.aborted) setState({ load: 'error' }) })
    return () => controller.abort()
  }, [range.from, range.to, sourcesKey, reload])

  const events = (state.events || []).filter(e => !hidden.has(e.type))
  const days = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d)
  const broken = (state.sources || []).filter(s => !s.ok)
  const step = n => setAnchor(view === 'semaine' ? addDays(anchor, 7 * n) : (() => { const x = new Date(anchor.slice(0, 8) + '15T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10) })())
  const title = view === 'semaine'
    ? 'Du ' + new Date(range.from + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' au ' + new Date(range.to + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    : new Date(anchor.slice(0, 8) + '15T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return <>
    <div className="mgc-between">
      <div><p className="mg-section-label">PILOTER</p>
        <h1 style={{ margin: '.1em 0', fontSize: 'clamp(1.65rem, 4vw, 2.6rem)' }}>Agenda</h1>
        <p className="mgc-muted" style={{ margin: 0 }}>Tes rendez-vous Google, tes visios LiveMentor, tes clients, tes relances et tes échéances de compta, au même endroit.</p></div>
      <div className="mgc-row">
        <button className="mgc-primary" disabled={!canSave} onClick={() => setRdv({})}>+ Rendez-vous</button>
        <button onClick={() => setSettings(true)}>{crm.agenda?.sources.length ? 'Agendas reliés' : 'Relier Google Agenda'}</button>
      </div>
    </div>

    {crm.agenda && crm.agenda.sources.length === 0 && <section className="mgc-panel mgc-note" style={{ background: '#f4ecd9' }}>
      <strong>Ton Google Agenda n’est pas encore relié.</strong> Pour l’instant, tu vois seulement ce qui vient du QG (échéances, relances, rendez-vous des projets).
      {' '}<button className="mgc-link" onClick={() => setSettings(true)}>Le relier (2 minutes)</button>
    </section>}
    {broken.length > 0 && <p className="mgc-error">Lecture impossible : {broken.map(s => s.label).join(', ')}. Vérifie l’adresse iCal dans « Agendas reliés ».</p>}

    <div className="mgc-between" style={{ marginTop: 14 }}>
      <div className="mgc-row">
        <button onClick={() => step(-1)} aria-label="Précédent">‹</button>
        <button onClick={() => setAnchor(today)}>Aujourd’hui</button>
        <button onClick={() => step(1)} aria-label="Suivant">›</button>
        <h2 style={{ margin: '0 0 0 8px', fontSize: '1.35rem' }}>{title}</h2>
      </div>
      <div className="mgc-tabs" style={{ margin: 0 }}>
        {[['semaine', 'Semaine'], ['mois', 'Mois']].map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
      </div>
    </div>
    <div className="mgc-row qga-filters" role="group" aria-label="Filtrer">
      {Object.entries(TYPES).map(([k, t]) => <button key={k} aria-pressed={!hidden.has(k)}
        onClick={() => setHidden(h => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n })}>
        <i style={{ background: t.color }} />{t.label}</button>)}
    </div>

    {state.load === 'loading' && !state.events && <p role="status">Chargement de l’agenda…</p>}
    {state.load === 'error' && <div role="alert"><p>L’agenda n’a pas pu être chargé.</p><button onClick={() => setReload(r => r + 1)}>Réessayer</button></div>}

    {state.events && view === 'semaine' && <div className="qga-week" aria-busy={state.load === 'loading'}>
      {days.map(d => {
        const list = events.filter(e => covers(e, d))
        return <section key={d} className={'qga-day' + (d === today ? ' is-today' : '')}>
          <div className="qga-day-head"><h3>{dayLabel(d)}{d === today && <span className="mgc-badge ok" style={{ marginLeft: 8 }}>Aujourd’hui</span>}</h3>
            <button className="qga-add" disabled={!canSave} onClick={() => setRdv({ date: d })} aria-label={'Ajouter un rendez-vous le ' + dayLabel(d)}>+</button></div>
          {list.length ? list.map(e => <Chip key={e.id + d} event={e} onOpen={openEvent} />) : <button className="qga-empty" disabled={!canSave} onClick={() => setRdv({ date: d })}>Rien de prévu · ajouter</button>}
        </section>
      })}
    </div>}

    {state.events && view === 'mois' && <div className="qga-month" aria-busy={state.load === 'loading'}>
      {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map(d => <div key={d} className="qga-head">{d}</div>)}
      {days.map(d => {
        const list = events.filter(e => covers(e, d))
        const out = d < range.first || d > range.last
        return <div key={d} className={'qga-cell' + (out ? ' is-out' : '') + (d === today ? ' is-today' : '')}>
          <button className="qga-num" onClick={() => { setAnchor(d); setView('semaine') }} aria-label={'Voir les 7 jours à partir du ' + dayLabel(d)}>{Number(d.slice(8))}</button>
          {list.slice(0, 3).map(e => { const t = TYPES[e.type] || TYPES.google
            return <button type="button" key={e.id + d} className="qga-mini" title={hour(e) + ' · ' + e.title + ' · ' + t.label} onClick={() => openEvent(e)}><i style={{ background: t.color }} />{e.allDay ? '' : e.start.slice(11, 16) + ' '}{e.title}</button> })}
          {list.length > 3 && <button className="mgc-link qga-more" onClick={() => { setAnchor(d); setView('semaine') }}>+ {list.length - 3} autre{list.length - 3 > 1 ? 's' : ''}</button>}
        </div>
      })}
    </div>}

    {detail && <EventSheet event={detail} onClose={() => setDetail(null)} onNew={d => { setDetail(null); setRdv({ date: d }) }} onGo={onGo && (k => { setDetail(null); onGo(k) })} />}
    {rdv && <RdvForm initial={rdv} saveCrm={saveCrm} canSave={canSave} onClose={changed => { setRdv(null); if (changed) setReload(r => r + 1) }} />}
    {settings && <Settings crm={crm} saveCrm={saveCrm} canSave={canSave} feedUrl={state.feedUrl} sources={state.sources || []}
      importesMaj={state.importesMaj} onClose={() => { setSettings(false); setReload(r => r + 1) }} />}
  </>
}
