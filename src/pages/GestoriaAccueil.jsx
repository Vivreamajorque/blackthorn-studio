import React, { useEffect, useMemo, useState } from 'react'
import { money, baseCents, clientPotential, uid } from '../lib/gestoria-crm'
import { todayInSpain } from '../lib/gestoria-calendar.mjs'
import { QUADRANTS, AGENTS, matrice, dateCourte } from '../lib/gestoria-matrice.mjs'
import '@fontsource-variable/schibsted-grotesk'
import './gestoria-accueil.css'

const NAV = [
  ['clients', 'Clients', 'Fiches, projets, espaces partagés'],
  ['prospection', 'Prospection', 'Pistes, relances, canaux'],
  ['agenda', 'Agenda', 'Rendez-vous et échéances'],
  ['pilotage', 'Pilotage', 'Trajectoire et objectif'],
  ['tasks', 'Compta', 'Déclarations 303 et 130'],
  ['finance', 'Factures & dépenses', 'Le registre'],
]

const hello = () => { const h = new Date().getHours(); return h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir' }
const ago = iso => {
  if (!iso) return ''
  const d = iso.slice(0, 10), t = todayInSpain()
  const n = Math.round((Date.parse(t) - Date.parse(d)) / 864e5)
  return (n === 0 ? 'aujourd’hui' : n === 1 ? 'hier' : 'le ' + dateCourte(d)) + (iso.length > 10 ? ' à ' + iso.slice(11, 16) : '')
}

export default function GestoriaAccueil({ entries, crm, saveCrm, canSave, onGo }) {
  const today = todayInSpain()
  const year = Number(today.slice(0, 4))
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(null)
  const [newTask, setNewTask] = useState('')
  const [events, setEvents] = useState(null)
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    const to = new Date(Date.parse(today + 'T12:00:00Z') + 7 * 864e5).toISOString().slice(0, 10)
    fetch(`/api/gestoria-agenda?from=${today}&to=${to}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setEvents(d.events || [])).catch(() => setEvents([]))
  }, [today])

  const m = useMemo(() => matrice({ entries, crm, today }), [entries, crm, today])
  const mine = entries.filter(e => (e.entity || 'independent') === 'independent' && e.kind === 'invoice')
  const billed = mine.filter(e => e.date.startsWith(String(year))).reduce((s, e) => s + baseCents(e), 0)
  const due = mine.filter(e => e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)
  const pot = crm.clients.map(c => clientPotential(entries, crm, c))
  const coming = pot.reduce((s, p) => s + p.rest + p.enCours, 0)
  const goal = crm.objectifs?.[2027] ?? 20000000
  const billed2027 = mine.filter(e => e.date.startsWith('2027')).reduce((s, e) => s + baseCents(e), 0)
  const msgs = (crm.messages?.items || []).filter(x => !x.vu)
  const inbox = (crm.alfred?.inbox || []).filter(x => !x.traite)
  const urgent = m.faire[0]
  const priorite = crm.alfred?.priorite || (urgent ? urgent.titre : '')

  const al = crm.alfred || {}
  const saveAlfred = (fn, msg) => saveCrm(d => ({ ...d, alfred: fn(d.alfred || {}) }), msg)
  const give = () => {
    const texte = note.trim(); if (!texte) return
    saveAlfred(a => ({ ...a, inbox: [...(a.inbox || []), { id: uid('inb'), date: new Date().toISOString().slice(0, 16), texte, traite: false }] }), 'Confié à Alfred.')
      .then(ok => ok && setNote(''))
  }
  const move = (item, q) => {
    if (item.quadrant === q) return
    if (item.auto) saveAlfred(a => ({ ...a, deplaces: { ...a.deplaces, [item.id]: q } }))
    else saveCrm(d => ({ ...d, taches: d.taches.map(t => t.id === item.id ? { ...t, quadrant: q } : t) }))
  }
  const done = item => {
    if (item.auto) saveAlfred(a => ({ ...a, ecartes: { ...a.ecartes, [item.id]: today } }), 'C’est noté.')
    else saveCrm(d => ({ ...d, taches: d.taches.map(t => t.id === item.id ? { ...t, fait: true, faitLe: today } : t) }), 'Bravo, c’est fait.')
  }
  const addTask = q => {
    const titre = newTask.trim(); if (!titre) return
    saveCrm(d => ({ ...d, taches: [...(d.taches || []), { id: uid('tac'), titre, quadrant: q, source: 'moi', creeLe: today }] }))
      .then(ok => { if (ok) { setNewTask(''); setAdding(null) } })
  }

  const agentState = id => {
    const g = crm.agents?.[id]
    if (id === 'alfred') return { on: !!(g?.majLe || al.majLe), last: g?.majLe || al.majLe, resume: g?.resume || (inbox.length ? inbox.length + ' chose' + (inbox.length > 1 ? 's' : '') + ' à classer' : 'Rien en attente'), attente: g?.attente }
    if (id === 'plateformes') {
      const last = [crm.livementor?.releve?.date, crm.messages?.majLe].filter(Boolean).sort().at(-1)
      return { on: !!last, last, resume: g?.resume || (crm.livementor?.releve ? crm.livementor.releve.actifs + ' apprenants actifs' : 'Relevés programmés'), attente: g?.attente }
    }
    const delegated = Object.values(m).flat().filter(i => i.agent === id).length
    return { on: !!g?.majLe, last: g?.majLe, resume: g?.resume || (delegated ? delegated + ' tâche' + (delegated > 1 ? 's' : '') + ' pour lui' : id === 'courrier' ? 'Branché quand ta boîte pro existe' : 'Pas encore branché'), attente: g?.attente }
  }

  const byDay = {}
  for (const e of (events || []).slice().sort((a, b) => a.start.localeCompare(b.start))) (byDay[e.start.slice(0, 10)] ||= []).push(e)

  return <div className="acc">
    <section className="acc-hero">
      <div className="acc-hello">
        <p className="acc-date">{new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1>{hello()} Amely.</h1>
        {priorite ? <p className="acc-prio"><span>Ta priorité</span>{priorite}</p> : <p className="acc-prio calm"><span>Aujourd’hui</span>Rien d’urgent. Avance ce qui compte.</p>}
        <div className="acc-counts">
          <button onClick={() => document.getElementById('acc-matrice')?.scrollIntoView({ behavior: 'smooth' })}><b>{m.faire.length}</b> urgent{m.faire.length > 1 ? 's' : ''}</button>
          <button onClick={() => document.getElementById('acc-messages')?.scrollIntoView({ behavior: 'smooth' })}><b>{msgs.length}</b> message{msgs.length > 1 ? 's' : ''}</button>
          <button onClick={() => document.getElementById('acc-agenda')?.scrollIntoView({ behavior: 'smooth' })}><b>{(byDay[today] || []).length}</b> au programme aujourd’hui</button>
        </div>
      </div>
      <div className="acc-alfred">
        <div className="acc-alfred-head"><span className="acc-avatar">A</span><div><strong>Alfred</strong><small>Ton majordome{al.majLe ? ' · passé ' + ago(al.majLe) : ''}</small></div></div>
        {al.brief ? <p className="acc-brief">{al.brief}</p> : <p className="acc-brief">Donne-moi tout ce qui te passe par la tête : une idée, une tâche, un lien, un rendez-vous. Je classe, je range, je te le ressors au bon moment.</p>}
        <div className="acc-give">
          <textarea rows={2} placeholder="Dis-le à Alfred…" value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) give() }} />
          <button disabled={!canSave || !note.trim()} onClick={give}>Confier</button>
        </div>
        {inbox.length > 0 && <details className="acc-inbox"><summary>{inbox.length} en attente de classement</summary>
          <ul>{inbox.slice().reverse().map(x => <li key={x.id}>{x.texte}<small>{ago(x.date)}</small></li>)}</ul></details>}
      </div>
    </section>

    <section className="acc-kpis">
      <button onClick={() => onGo('pilotage')}><span>Facturé en {year}</span><strong>{money(billed)}</strong><small>HT</small></button>
      <button onClick={() => onGo('pilotage')}><span>À venir</span><strong>{money(coming)}</strong><small>devis signés et missions en cours</small></button>
      <button onClick={() => onGo('clients')} className={due ? 'warn' : ''}><span>À encaisser</span><strong>{money(due)}</strong><small>factures envoyées</small></button>
      <button onClick={() => onGo('pilotage')}><span>Objectif 2027</span><strong>{Math.round(billed2027 / goal * 100)} %</strong>
        <i className="acc-meter"><i style={{ width: Math.min(100, billed2027 / goal * 100) + '%' }} /></i><small>de {money(goal)}</small></button>
    </section>

    <section className="acc-matrix" id="acc-matrice" aria-label="Matrice d’Eisenhower">
      <div className="acc-axis acc-axis-top"><span>Urgent</span><span>Pas urgent</span></div>
      {['faire', 'planifier', 'deleguer', 'plus_tard'].map(qid => {
        const q = QUADRANTS.find(x => x.id === qid)
        const list = m[qid]
        return <div key={qid} className={'acc-q q-' + qid + (drag && drag.quadrant !== qid ? ' droppable' : '')}
          onDragOver={e => { if (drag) e.preventDefault() }} onDrop={() => { if (drag) move(drag, qid); setDrag(null) }}>
          <header><div><h2>{q.titre}</h2><small>{q.sous}</small></div><b>{list.length}</b></header>
          {list.length === 0 ? <p className="acc-empty">{qid === 'faire' ? 'Rien d’urgent. Profites-en.' : 'Vide.'}</p> :
            <ul>{list.slice(0, qid === 'plus_tard' ? 5 : 8).map(i => <li key={i.id} draggable={canSave} onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}>
              <button className="acc-check" title={i.auto ? 'C’est fait / écarter' : 'Marquer comme fait'} disabled={!canSave} onClick={() => done(i)} aria-label={'Fait : ' + i.titre} />
              <div className="acc-item" onClick={() => i.lien ? window.open(i.lien, '_blank', 'noopener') : i.go && onGo(i.go, i.clientId)} role={i.go || i.lien ? 'button' : undefined}>
                <strong>{i.titre}</strong>
                {(i.detail || i.agent || i.source === 'alfred') && <small>{[i.detail, i.agent && '→ ' + AGENTS.find(a => a.id === i.agent)?.nom, i.source === 'alfred' && 'ajouté par Alfred'].filter(Boolean).join(' · ')}</small>}
              </div>
              <select aria-label="Déplacer" value={i.quadrant} disabled={!canSave} onChange={e => move(i, e.target.value)}>
                {QUADRANTS.map(x => <option key={x.id} value={x.id}>{x.titre}</option>)}</select>
            </li>)}
              {list.length > (qid === 'plus_tard' ? 5 : 8) && <li className="acc-more">+ {list.length - (qid === 'plus_tard' ? 5 : 8)} autres</li>}</ul>}
          {adding === qid ? <div className="acc-add"><input autoFocus placeholder="Nouvelle tâche" value={newTask} onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTask(qid); if (e.key === 'Escape') setAdding(null) }} /><button onClick={() => addTask(qid)}>OK</button></div>
            : <button className="acc-addbtn" disabled={!canSave} onClick={() => { setAdding(qid); setNewTask('') }}>+ Ajouter</button>}
        </div>
      })}
      <div className="acc-axis acc-axis-side"><span>Important</span><span>Pas important</span></div>
    </section>

    <div className="acc-row">
      <section className="acc-card" id="acc-agenda">
        <header><h2>Agenda · 7 jours</h2><button onClick={() => onGo('agenda')}>Ouvrir</button></header>
        {events === null ? <p className="acc-empty">Chargement…</p> : Object.keys(byDay).length === 0 ? <p className="acc-empty">Rien de prévu cette semaine.</p> :
          Object.entries(byDay).map(([d, list]) => <div key={d} className="acc-day">
            <h3>{d === today ? 'Aujourd’hui' : new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            <ul>{list.map(e => <li key={e.id}><i className={'t-' + e.type} /><span className="acc-hour">{e.allDay ? 'Journée' : e.start.slice(11, 16)}</span><span>{e.title}</span></li>)}</ul>
          </div>)}
      </section>
      <section className="acc-card" id="acc-messages">
        <header><h2>Messages{msgs.length ? ' · ' + msgs.length : ''}</h2>{crm.messages?.majLe && <small>relevé {ago(crm.messages.majLe)}</small>}</header>
        {msgs.length === 0 ? <p className="acc-empty">{crm.messages?.majLe ? 'Tout est lu.' : 'Premier relevé aujourd’hui à 18 h 53.'}</p> :
          <ul className="acc-msgs">{msgs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(x => <li key={x.id}>
            <span className={'acc-src s-' + x.source}>{{ livementor: 'LiveMentor', malt: 'Malt', client: 'Client', autre: 'Autre' }[x.source]}</span>
            <div><strong>{x.sujet}</strong><small>{x.de}{x.date ? ' · ' + ago(x.date) : ''}</small></div>
            {x.lien && <a href={x.lien} target="_blank" rel="noreferrer">Ouvrir</a>}
          </li>)}</ul>}
      </section>
    </div>

    <section className="acc-agents">
      <header><h2>Ton équipe</h2><small>Des agents Claude, chacun dans son domaine. Alfred les coordonne.</small></header>
      <div className="acc-agent-grid">{AGENTS.map(a => {
        const s = agentState(a.id)
        return <article key={a.id} className={'acc-agent' + (a.id === 'alfred' ? ' chief' : '')}>
          <div className="acc-agent-top"><span className="acc-avatar">{a.nom[0]}</span><i className={'acc-dot ' + (s.on ? 'on' : '')} title={s.on ? 'Actif' : 'Pas encore actif'} /></div>
          <strong>{a.nom}</strong><small>{a.role}</small>
          <p>{s.resume}</p>
          {s.attente && <p className="acc-wait">Attend de toi : {s.attente}</p>}
          <small className="acc-last">{s.last ? 'Dernier passage ' + ago(s.last) : a.mission}</small>
        </article>
      })}</div>
    </section>

    <nav className="acc-nav" aria-label="Aller vers">{NAV.map(([id, label, sub]) =>
      <button key={id} onClick={() => onGo(id)}><strong>{label}</strong><small>{sub}</small><span aria-hidden="true">→</span></button>)}</nav>
  </div>
}
