import React, { useEffect, useMemo, useState } from 'react'
import { money, baseCents, clientPotential, uid, useLivementor } from '../lib/gestoria-crm'
import { todayInSpain } from '../lib/gestoria-calendar.mjs'
import { QUADRANTS, AGENTS, matrice, dateCourte } from '../lib/gestoria-matrice.mjs'
import '@fontsource-variable/bricolage-grotesque'
import './gestoria-accueil.css'

const DAY = 864e5
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10)
const hello = () => { const h = new Date().getHours(); return h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir' }
const ago = iso => {
  if (!iso) return ''
  const n = Math.round((Date.parse(todayInSpain()) - Date.parse(iso.slice(0, 10))) / DAY)
  return (n === 0 ? 'aujourd’hui' : n === 1 ? 'hier' : 'le ' + dateCourte(iso)) + (iso.length > 10 ? ' à ' + iso.slice(11, 16) : '')
}
const dayLabel = (d, today) => d === today ? 'Aujourd’hui' : d === addDays(today, 1) ? 'Demain' : new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
const SRC = { livementor: 'LiveMentor', malt: 'Malt', client: 'Client', autre: 'Autre' }

// Actions communes à l'accueil et à la page Équipe.
function useActions(crm, saveCrm, today) {
  const saveAlfred = (fn, msg) => saveCrm(d => ({ ...d, alfred: fn(d.alfred || {}) }), msg)
  return {
    give: texte => saveAlfred(a => ({ ...a, inbox: [...(a.inbox || []), { id: uid('inb'), date: new Date().toISOString().slice(0, 16), texte, traite: false }] }), 'Confié à Alfred.'),
    move: (item, q) => item.quadrant === q ? null : item.auto
      ? saveAlfred(a => ({ ...a, deplaces: { ...a.deplaces, [item.id]: q } }))
      : saveCrm(d => ({ ...d, taches: d.taches.map(t => t.id === item.id ? { ...t, quadrant: q } : t) })),
    done: item => item.auto
      ? saveAlfred(a => ({ ...a, ecartes: { ...a.ecartes, [item.id]: today } }), 'C’est noté.')
      : saveCrm(d => ({ ...d, taches: d.taches.map(t => t.id === item.id ? { ...t, fait: true, faitLe: today } : t) }), 'Bravo, c’est fait.'),
    add: (titre, q, echeance = '') => saveCrm(d => ({ ...d, taches: [...(d.taches || []), { id: uid('tac'), titre, quadrant: q, source: 'moi', creeLe: today, echeance }] })),
  }
}

// Le ruban de la journée : 7 h → 21 h, les rendez-vous posés à leur heure, et l'heure qu'il est.
function DayRibbon({ events, today }) {
  const START = 7, END = 21
  const pos = t => Math.min(100, Math.max(0, ((Number(t.slice(11, 13)) + Number(t.slice(14, 16)) / 60) - START) / (END - START) * 100))
  const timed = events.filter(e => !e.allDay)
  const allDay = events.filter(e => e.allDay)
  const now = new Date(); const h = now.getHours() + now.getMinutes() / 60
  const nowPct = (h - START) / (END - START) * 100
  return <div className="mj-ribbon" aria-label="Ta journée">
    {allDay.length > 0 && <div className="mj-allday">{allDay.map(e => <span key={e.id} className={'mj-chip t-' + e.type}>{e.title}</span>)}</div>}
    <div className="mj-track">
      {Array.from({ length: END - START + 1 }, (_, k) => START + k).map(hh =>
        <span key={hh} className="mj-tick" style={{ left: ((hh - START) / (END - START) * 100) + '%' }}>{hh % 2 === 1 ? hh + ' h' : ''}</span>)}
      {nowPct >= 0 && nowPct <= 100 && <span className="mj-now" style={{ left: nowPct + '%' }} title="Maintenant" />}
      {timed.map((e, k) => <span key={e.id} className={'mj-ev t-' + e.type + (k % 2 ? ' low' : '')} style={{ left: pos(e.start) + '%' }} title={e.start.slice(11, 16) + ' · ' + e.title}>
        <b>{e.start.slice(11, 16)}</b> {e.title}</span>)}
      {timed.length === 0 && <span className="mj-free">Aucun rendez-vous aujourd’hui</span>}
    </div>
  </div>
}

function Item({ i, canSave, act, onGo }) {
  const agent = i.agent && AGENTS.find(a => a.id === i.agent)?.nom
  const by = i.source && i.source !== 'moi' && AGENTS.find(a => a.id === i.source)?.nom
  return <li className={'mj-item q-' + i.quadrant}>
    <button className="acc-check" title={i.auto ? 'C’est fait / écarter' : 'Marquer comme fait'} disabled={!canSave} onClick={() => act.done(i)} aria-label={'Fait : ' + i.titre} />
    <div className="acc-item" onClick={() => i.lien ? window.open(i.lien, '_blank', 'noopener') : i.go && onGo(i.go, i.clientId)} role={i.go || i.lien ? 'button' : undefined}>
      <strong>{i.titre}</strong>
      {(i.detail || agent || by) && <small className="acc-detail">{[i.detail, agent && '→ ' + agent, by && 'préparé par ' + by].filter(Boolean).join(' · ')}</small>}
    </div>
    <select aria-label="Déplacer" value={i.quadrant} disabled={!canSave} onChange={e => act.move(i, e.target.value)}>
      {QUADRANTS.map(x => <option key={x.id} value={x.id}>{x.titre}</option>)}</select>
  </li>
}

export default function GestoriaAccueil({ entries, crm, saveCrm, canSave, onGo }) {
  const today = todayInSpain()
  const year = Number(today.slice(0, 4))
  const lmStore = useLivementor()
  const [note, setNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [events, setEvents] = useState(null)
  const act = useActions(crm, saveCrm, today)

  useEffect(() => {
    fetch(`/api/gestoria-agenda?from=${today}&to=${addDays(today, 8)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setEvents(d.events || [])).catch(() => setEvents([]))
  }, [today])

  const m = useMemo(() => matrice({ entries, crm, today, lm: lmStore.loadState === 'ready' ? lmStore.data : null }), [entries, crm, today, lmStore.data, lmStore.loadState])
  const mine = entries.filter(e => (e.entity || 'independent') === 'independent' && e.kind === 'invoice')
  const billed = mine.filter(e => e.date.startsWith(String(year))).reduce((s, e) => s + baseCents(e), 0)
  const due = mine.filter(e => e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)
  const coming = crm.clients.map(c => clientPotential(entries, crm, c)).reduce((s, p) => s + p.rest + p.enCours, 0)
  const goal = crm.objectifs?.[2027] ?? 20000000
  const billed2027 = mine.filter(e => e.date.startsWith('2027')).reduce((s, e) => s + baseCents(e), 0)
  const msgs = (crm.messages?.items || []).filter(x => !x.vu).sort((a, b) => b.date.localeCompare(a.date))
  const al = crm.alfred || {}
  const inbox = (al.inbox || []).filter(x => !x.traite)

  // Aujourd'hui : rendez-vous du jour + urgent. À prévoir : les 7 jours suivants, rendez-vous et tout ce qui a une date.
  const evs = (events || []).slice().sort((a, b) => a.start.localeCompare(b.start))
  const todayEvents = evs.filter(e => e.start.slice(0, 10) === today)
  const urgent = m.faire
  const projets = crm.projets.filter(p => ['en_cours', 'a_demarrer'].includes(p.statut)).map(p => {
    const c = crm.clients.find(x => x.id === p.clientId)
    const a = p.actions.find(x => x.pour === 'amely' && !x.fait)
    const done = p.actions.filter(x => x.fait).length
    return c && c.statut !== 'archive' ? { p, c, a, pct: p.actions.length ? Math.round(done / p.actions.length * 100) : null } : null
  }).filter(Boolean).sort((x, y) => Number(!x.a) - Number(!y.a))
  const upcoming = {}
  for (const e of evs.filter(e => e.start.slice(0, 10) > today)) (upcoming[e.start.slice(0, 10)] ||= []).push({ kind: 'ev', e })
  const inWeek = i => i.echeance && i.echeance > today && i.echeance <= addDays(today, 7)
  for (const i of [...m.planifier, ...m.deleguer]) if (inWeek(i)) (upcoming[i.echeance] ||= []).push({ kind: 'item', i })
  const upcomingDays = Object.keys(upcoming).sort()
  const later = [...m.planifier, ...m.deleguer].filter(i => !inWeek(i))
  const priorite = al.priorite || urgent[0]?.titre || ''

  const give = () => { const t = note.trim(); if (t) act.give(t).then(ok => ok && setNote('')) }
  const addToday = () => { const t = newTask.trim(); if (t) act.add(t, 'faire', today).then(ok => ok && setNewTask('')) }

  return <div className="acc mj">
    <section className="mj-head">
      <div>
        <p className="acc-date">{new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{hello()} Amely.</h1>
        {priorite ? <p className="mj-prio"><span>Ta priorité du jour</span>{priorite}</p> : <p className="mj-prio calm"><span>Aujourd’hui</span>Rien d’urgent. Avance ce qui compte.</p>}
        {al.brief && <p className="mj-brief">{al.brief}</p>}
      </div>
      <div className="mj-alfred">
        <div className="acc-alfred-head"><span className="acc-avatar">A</span><div><strong>Dis-le à Alfred</strong><small>{inbox.length ? inbox.length + ' en attente de classement' : 'Une idée, une tâche, un rendez-vous…'}</small></div></div>
        <div className="acc-give">
          <textarea rows={2} placeholder="Je dois…" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) give() }} />
          <button disabled={!canSave || !note.trim()} onClick={give}>Confier</button>
        </div>
      </div>
    </section>

    {events !== null && <DayRibbon events={todayEvents} today={today} />}

    <div className="mj-cols">
      <section className="acc-card mj-today">
        <header><h2>À faire maintenant</h2><small>{urgent.length ? urgent.length + ' urgent' + (urgent.length > 1 ? 's' : '') : ''}</small></header>
        {urgent.length === 0 ? <p className="acc-empty">Rien d’urgent. Profites-en pour avancer un projet.</p> :
          <ul className="mj-list">{urgent.slice(0, 7).map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul>}
        {urgent.length > 7 && <p className="acc-empty">+ {urgent.length - 7} autres</p>}
        <div className="acc-add" style={{ marginTop: 8 }}><input placeholder="Ajouter une tâche pour aujourd’hui" value={newTask} onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addToday() }} />
          <button disabled={!canSave || !newTask.trim()} onClick={addToday}>OK</button></div>
      </section>

      <div className="mj-side">
        <section className="acc-card">
          <header><h2>Messages{msgs.length ? ' · ' + msgs.length : ''}</h2>{crm.messages?.majLe && <small>relevé {ago(crm.messages.majLe)}</small>}</header>
          {msgs.length === 0 ? <p className="acc-empty">{crm.messages?.majLe ? 'Tout est lu.' : 'Premier relevé ce matin à 8 h 53.'}</p> :
            <ul className="acc-msgs">{msgs.slice(0, 5).map(x => <li key={x.id}>
              <span className={'acc-src s-' + x.source}>{SRC[x.source]}</span>
              <div><strong>{x.sujet}</strong><small>{x.de}{x.date ? ' · ' + ago(x.date) : ''}</small></div>
              {x.lien && <a href={x.lien} target="_blank" rel="noreferrer">Ouvrir</a>}</li>)}</ul>}
        </section>
        <section className="acc-card">
          <header><h2>Mes projets</h2><button onClick={() => onGo('clients')}>Tous les clients</button></header>
          {projets.length === 0 ? <p className="acc-empty">Aucun projet en cours.</p> :
            <ul className="mj-projects">{projets.slice(0, 4).map(({ p, c, a, pct }) => <li key={p.id} onClick={() => onGo('clients', c.id)} role="button">
              <div className="mgc-between"><strong>{c.nom}</strong>{pct !== null && <small>{pct} %</small>}</div>
              <small>{p.nom}</small>
              {pct !== null && <i className="acc-meter"><i style={{ width: pct + '%' }} /></i>}
              <small className="mj-next">{a ? 'Prochaine action : ' + a.label : p.prochainRdv ? 'RDV ' + dateCourte(p.prochainRdv) : 'Pas d’action en attente de ta part'}</small>
            </li>)}</ul>}
          {projets.length > 4 && <button className="mgc-link" onClick={() => onGo('clients')}>+ {projets.length - 4} autres projets</button>}
        </section>
      </div>
    </div>

    <section className="acc-card mj-week">
      <header><h2>Cette semaine</h2><button onClick={() => onGo('agenda')}>Ouvrir l’agenda</button></header>
      {upcomingDays.length === 0 ? <p className="acc-empty">Rien de daté cette semaine.</p> :
        <div className="mj-days">{upcomingDays.map(d => <div key={d} className="acc-day">
          <h3>{dayLabel(d, today)}</h3>
          <ul>{upcoming[d].map((x, k) => x.kind === 'ev'
            ? <li key={'e' + k}><i className={'t-' + x.e.type} /><span className="acc-hour">{x.e.allDay ? 'Journée' : x.e.start.slice(11, 16)}</span><span>{x.e.title}</span></li>
            : <li key={'i' + k}><i className="t-task" /><span className="acc-hour">tâche</span><span>{x.i.titre}</span></li>)}</ul>
        </div>)}</div>}
      <details className="mj-more">
        <summary>{later.length} autre{later.length > 1 ? 's' : ''} chose{later.length > 1 ? 's' : ''} à planifier ou à confier · {m.plus_tard.length} plus tard</summary>
        <ul className="mj-list">{[...later, ...m.plus_tard].map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul>
      </details>
    </section>

    <section className="mj-figures" aria-label="Chiffres">
      <button onClick={() => onGo('pilotage')}><span>Facturé {year}</span><strong>{money(billed)}</strong></button>
      <button onClick={() => onGo('pilotage')}><span>À venir</span><strong>{money(coming)}</strong></button>
      <button onClick={() => onGo('finance')} className={due ? 'warn' : ''}><span>À encaisser</span><strong>{money(due)}</strong></button>
      <button onClick={() => onGo('pilotage')}><span>Objectif 2027</span><strong>{Math.round(billed2027 / goal * 100)} %</strong></button>
    </section>
  </div>
}

// Page Équipe : Alfred, sa boîte, et l'état de chaque agent.
export function GestoriaEquipe({ crm, saveCrm, canSave }) {
  const al = crm.alfred || {}
  const inbox = (al.inbox || []).slice().reverse()
  const state = id => {
    const g = crm.agents?.[id]
    if (id === 'alfred') return { on: !!(g?.majLe || al.majLe), last: g?.majLe || al.majLe, resume: g?.resume || (al.priorite ? 'Priorité du jour : ' + al.priorite : 'Premier passage demain à 7 h 43'), attente: g?.attente }
    if (id === 'plateformes') {
      const last = [crm.livementor?.releve?.date, crm.messages?.majLe].filter(Boolean).sort().at(-1)
      return { on: !!last, last, resume: g?.resume || (crm.livementor?.releve ? crm.livementor.releve.actifs + ' apprenants actifs' : 'Relevés programmés'), attente: g?.attente }
    }
    return { on: !!g?.majLe, last: g?.majLe, resume: g?.resume || (id === 'courrier' ? 'Démarre quand ta boîte pro existe' : 'Premier passage programmé'), attente: g?.attente }
  }
  const SCHEDULE = { alfred: 'Chaque matin, 7 h 43', compta: 'Le lundi, 8 h 17', plateformes: 'Chaque jour, 8 h 47 + 3 relevés de messages', clients: 'Du lundi au vendredi, 9 h 13', commercial: 'Lundi et jeudi, 9 h 37', communication: 'Le lundi, 10 h 07', courrier: 'En attente' }
  return <div className="acc">
    <section className="acc-agents">
      <header><h2>Ton équipe</h2><small>Ils préparent, tu valides. Aucun n’envoie, ne publie ou ne touche à ta compta seul.</small></header>
      <div className="acc-agent-grid">{AGENTS.map(a => {
        const s = state(a.id)
        return <article key={a.id} className={'acc-agent' + (a.id === 'alfred' ? ' chief' : '')}>
          <div className="acc-agent-top"><span className="acc-avatar">{a.nom[0]}</span><i className={'acc-dot ' + (s.on ? 'on' : '')} title={s.on ? 'Actif' : 'Pas encore passé'} /></div>
          <strong>{a.nom}</strong><small>{a.role}</small>
          <p>{s.resume}</p>
          {s.attente && <p className="acc-wait">Attend de toi : {s.attente}</p>}
          <small className="acc-last">{s.last ? 'Dernier passage ' + ago(s.last) : SCHEDULE[a.id]}</small>
        </article>
      })}</div>
    </section>
    <section className="acc-card">
      <header><h2>La boîte d’Alfred</h2><small>{inbox.filter(x => !x.traite).length} à classer</small></header>
      {inbox.length === 0 ? <p className="acc-empty">Vide. Confie-lui quelque chose depuis « Ma journée ».</p> :
        <ul className="mj-inbox">{inbox.map(x => <li key={x.id} className={x.traite ? 'done' : ''}>
          <p>{x.texte}</p><small>{ago(x.date)}{x.traite ? ' · classé' + (x.resultat ? ' : ' + x.resultat : '') : ''}</small>
          {!x.traite && <button className="mgc-link" disabled={!canSave} onClick={() => saveCrm(d => ({ ...d, alfred: { ...d.alfred, inbox: d.alfred.inbox.filter(y => y.id !== x.id) } }), 'Retiré.')}>Retirer</button>}
        </li>)}</ul>}
    </section>
  </div>
}
