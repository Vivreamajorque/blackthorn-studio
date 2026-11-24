import React, { useEffect, useMemo, useState } from 'react'
import { money, baseCents, clientPotential, uid, useLivementor } from '../lib/gestoria-crm'
import { todayInSpain } from '../lib/gestoria-calendar.mjs'
import { QUADRANTS, AGENTS, matrice, dateCourte } from '../lib/gestoria-matrice.mjs'
import '@fontsource-variable/bricolage-grotesque'
import './gestoria-accueil.css'
import './gestoria-journee.css'
import Alfred from '../components/Alfred'

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
    add: (titre, q, echeance = '', domaine = '') => saveCrm(d => ({ ...d, taches: [...(d.taches || []), { id: uid('tac'), titre, quadrant: q, source: 'moi', creeLe: today, echeance, domaine }] })),
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
    {timed.length === 0 && <p className="mj-free">Aucun rendez-vous aujourd’hui</p>}
    <div className="mj-track">
      {Array.from({ length: END - START + 1 }, (_, k) => START + k).map(hh =>
        <span key={hh} className="mj-tick" style={{ left: ((hh - START) / (END - START) * 100) + '%' }}>{hh % 2 === 1 ? hh + ' h' : ''}</span>)}
      {nowPct >= 0 && nowPct <= 100 && <span className="mj-now" style={{ left: nowPct + '%' }} title="Maintenant" />}
      {timed.map((e, k) => <span key={e.id} className={'mj-ev t-' + e.type + (k % 2 ? ' low' : '')} style={{ left: pos(e.start) + '%' }} title={e.start.slice(11, 16) + ' · ' + e.title}>
        <b>{e.start.slice(11, 16)}</b> {e.title}</span>)}
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
    {i.facturer && <button className="mj-facturer" disabled={!canSave} onClick={() => onGo('clients', i.clientId, i.facturer)}>Facturer</button>}
    <select aria-label="Déplacer" value={i.quadrant} disabled={!canSave} onChange={e => act.move(i, e.target.value)}>
      {QUADRANTS.map(x => <option key={x.id} value={x.id}>{x.titre}</option>)}</select>
  </li>
}

// Le tableau de bord en cartes : une carte par domaine, avec le mot d'Alfred et ce qu'il y a à faire.
export const CARTES = [
  { id: 'clients', nom: 'Clients', couleur: '#2e7d72', agents: ['clients'], go: 'clients', page: 'Ouvrir mes clients' },
  { id: 'atelier', nom: 'Atelier', couleur: '#103c42', agents: ['atelier'], go: 'clients', page: 'Ouvrir les projets' },
  { id: 'messages', nom: 'Messages', couleur: '#24527a', agents: ['courrier', 'plateformes'], go: null },
  { id: 'compta', nom: 'Compta', couleur: '#b5651d', agents: ['compta'], go: 'finance', page: 'Ouvrir la compta' },
  { id: 'developper', nom: 'Développer', couleur: '#7a4bb0', agents: ['commercial', 'communication'], go: 'prospection', page: 'Ouvrir Développer' },
  { id: 'livementor', nom: 'LiveMentor', couleur: '#c0457a', agents: ['plateformes'], go: 'livementor', page: 'Ouvrir LiveMentor' },
  { id: 'perso', nom: 'Perso et divers', couleur: '#6b7a3a', agents: [], go: null },
]
export const carteOf = i => {
  if (String(i.id).startsWith('auto:atelier')) return 'atelier'
  const d = i.domaine
  if (d === 'commercial' || d === 'communication') return 'developper'
  if (['clients', 'compta', 'messages', 'livementor', 'atelier'].includes(d)) return d
  return 'perso'
}

function Cartes({ m, crm, saveCrm, canSave, act, onGo, msgs, projets, today }) {
  const [open, setOpen] = useState(null)
  const al = crm.alfred || {}
  const cards = CARTES.map(c => {
    const mine = i => c.id !== 'messages' && carteOf(i) === c.id // les messages ont leur propre liste
    const now = m.faire.filter(mine)
    const next = [...m.planifier, ...m.deleguer].filter(mine)
    const later = m.plus_tard.filter(mine)
    const ag = c.agents.map(a => crm.agents?.[a]).filter(Boolean)
    const mot = al.cartes?.[c.id] || ag.map(g => g.attente).filter(Boolean)[0] || ag.map(g => g.resume).filter(Boolean)[0] || ''
    const count = c.id === 'messages' ? msgs.length : now.length + next.length
    return { ...c, now, next, later, mot, count, urgent: c.id === 'messages' ? msgs.filter(x => x.source === 'client').length : now.length }
  })
  const ordre = [...cards].sort((a, b) => (b.urgent - a.urgent) || (b.count - a.count))
  const card = cards.find(c => c.id === open)
  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open])
  const effacer = x => saveCrm(d => ({ ...d, messages: { ...d.messages, items: (d.messages?.items || []).map(y => y.id === x.id ? { ...y, vu: true } : y) } }), 'Message effacé.')
  return <>
    <section className="cx-grid" aria-label="Tes domaines">
      {ordre.map(c => <button key={c.id} className={'cx-card' + (c.count ? '' : ' calme') + (c.urgent ? ' chaud' : '')} style={{ '--c': c.couleur }} onClick={() => setOpen(c.id)}>
        <span className="cx-top"><span className="cx-pastille" aria-hidden="true">{c.nom[0]}</span>
          <span className="cx-count">{c.count ? c.count + (c.id === 'messages' ? ' non lu' + (c.count > 1 ? 's' : '') : ' à faire') : '✓'}</span></span>
        <strong>{c.nom}</strong>
        <span className="cx-mot">{c.count ? (c.mot || (c.now[0] || c.next[0] || {}).titre || (c.id === 'messages' && msgs[0] ? msgs[0].de + ' · ' + msgs[0].sujet : '')) : 'Rien à faire ici. Tranquille.'}</span>
      </button>)}
    </section>

    {card && <div className="cx-veil" onClick={e => { if (e.target === e.currentTarget) setOpen(null) }}>
      <section className="cx-panel" role="dialog" aria-modal="true" aria-label={card.nom} style={{ '--c': card.couleur }}>
        <header><span className="cx-pastille" aria-hidden="true">{card.nom[0]}</span><h2>{card.nom}</h2>
          <button className="cx-close" onClick={() => setOpen(null)} aria-label="Fermer">×</button></header>
        <div className="cx-alfred"><Alfred size={44} /><p>{card.mot || (card.count ? 'Voici ce qui t’attend ici. Commence par le premier.' : 'Rien à faire ici pour l’instant. Je te préviens dès que ça bouge.')}</p></div>

        {card.id === 'messages' && (msgs.length === 0 ? <p className="acc-empty">Tout est lu.</p> :
          <ul className="cx-msgs">{msgs.map(x => <li key={x.id}>
            <div><span className={'acc-src s-' + x.source}>{SRC[x.source]}</span> <strong>{x.sujet}</strong>
              <small>{x.de}{x.date ? ' · ' + ago(x.date) : ''}</small>
              {x.apercu && <p>{x.apercu}</p>}</div>
            <div className="cx-msg-act">{x.lien && <a href={x.lien} target="_blank" rel="noreferrer">Ouvrir</a>}
              <button disabled={!canSave} onClick={() => effacer(x)}>Effacer</button></div>
          </li>)}</ul>)}

        {card.now.length > 0 && <><h3>Maintenant</h3><ul className="mj-list">{card.now.map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul></>}
        {card.next.length > 0 && <><h3>Ensuite</h3><ul className="mj-list">{card.next.map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul></>}
        {card.later.length > 0 && <details className="mj-more"><summary>Plus tard ({card.later.length})</summary>
          <ul className="mj-list">{card.later.map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul></details>}

        {card.id === 'clients' && projets.length > 0 && <><h3>Mes projets</h3>
          <ul className="mj-projects">{projets.map(({ p, c, a, pct }) => <li key={p.id} onClick={() => { setOpen(null); onGo('clients', c.id) }} role="button">
            <div className="mgc-between"><strong>{c.nom}</strong>{pct !== null && <small>{pct} %</small>}</div><small>{p.nom}</small>
            {pct !== null && <i className="acc-meter"><i style={{ width: pct + '%' }} /></i>}
            {a && <small className="mj-next">Prochaine action : {a.label}</small>}</li>)}</ul></>}

        <AjoutCarte carte={card.id} canSave={canSave} act={act} today={today} />
        {card.go && <button className="cx-go" onClick={() => { setOpen(null); onGo(card.go) }}>{card.page}</button>}
      </section>
    </div>}
  </>
}

const DOMAINE = { clients: 'clients', atelier: 'atelier', messages: 'messages', compta: 'compta', developper: 'commercial', livementor: 'livementor', perso: 'perso' }
function AjoutCarte({ carte, canSave, act, today }) {
  const [t, setT] = useState('')
  const ok = () => { const x = t.trim(); if (x) act.add(x, 'faire', today, DOMAINE[carte]).then(r => r !== false && setT('')) }
  return <div className="acc-add cx-add"><input placeholder="Ajouter une tâche ici" value={t} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ok() }} />
    <button disabled={!canSave || !t.trim()} onClick={ok}>OK</button></div>
}

export default function GestoriaAccueil({ entries, crm, saveCrm, canSave, onGo }) {
  const today = todayInSpain()
  const year = Number(today.slice(0, 4))
  const lmStore = useLivementor()
  const [note, setNote] = useState('')
  const [newTask, setNewTask] = useState('')
  const [events, setEvents] = useState(null)
  const act = useActions(crm, saveCrm, today)

  // L'agenda se recharge quand on revient dans l'appli (téléphone, iPad) et toutes les 10 minutes.
  // En cas d'échec, on garde ce qu'on avait et on le dit, au lieu d'afficher « aucun rendez-vous ».
  const [agendaKo, setAgendaKo] = useState(false)
  const [agendaTick, setAgendaTick] = useState(0)
  useEffect(() => {
    const again = () => { if (document.visibilityState !== 'hidden') setAgendaTick(t => t + 1) }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    const timer = setInterval(again, 10 * 60000)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); clearInterval(timer) }
  }, [])
  useEffect(() => {
    let stop = false
    const load = (essai = 0) => fetch(`/api/gestoria-agenda?from=${today}&to=${addDays(today, 8)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!stop) { setEvents(d.events || []); setAgendaKo(false) } })
      .catch(() => { if (stop) return; if (essai < 2) setTimeout(() => load(essai + 1), 2500); else { setAgendaKo(true); setEvents(e => e || []) } })
    load()
    return () => { stop = true }
  }, [today, agendaTick])

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
  // Si la priorité d'Alfred a été cochée (tâche ou action faite), on passe à la suivante sans attendre son prochain passage.
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || (y.length > 8 && x.includes(y)) || (x.length > 8 && y.includes(x))) }
  const faits = [...(crm.taches || []).filter(t => t.fait).map(t => t.titre), ...crm.projets.flatMap(p => p.actions.filter(a => a.fait).map(a => a.label))]
  const prioFaite = !!al.priorite && faits.some(t => same(t, al.priorite))
  const priorite = prioFaite ? (urgent.find(i => !same(i.titre, al.priorite))?.titre || '') : (al.priorite || urgent[0]?.titre || '')

  const give = () => { const t = note.trim(); if (t) act.give(t).then(ok => ok && setNote('')) }
  const addToday = () => { const t = newTask.trim(); if (t) act.add(t, 'faire', today).then(ok => ok && setNewTask('')) }

  const prioItem = prioFaite ? null : [...m.faire, ...m.planifier, ...m.deleguer].find(i => same(i.titre, priorite))
  const prioDone = () => prioItem ? act.done(prioItem)
    : saveCrm(d => ({ ...d, taches: [...(d.taches || []), { id: uid('tac'), titre: priorite, quadrant: 'faire', source: 'moi', creeLe: today, fait: true, faitLe: today }] }), 'Bravo, c’est fait.')
  const nowHM = new Date().toTimeString().slice(0, 5)
  const weekItems = upcomingDays.flatMap(d => upcoming[d].map(x => ({ d, x })))
  const pct = Math.min(100, Math.round(billed2027 / goal * 100))

  return <div className="j">
    <header className="j-top">
      <div className="j-hello">
        <p className="j-date">{(d => d[0].toUpperCase() + d.slice(1))(new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        <h1>{hello()} Amely</h1>
      </div>
      <nav className="j-kpis" aria-label="Chiffres clés">
        <button onClick={() => onGo('pilotage')}><span>Facturé {year}</span><strong>{money(billed)}</strong></button>
        <button onClick={() => onGo('pilotage')}><span>À venir</span><strong>{money(coming)}</strong></button>
        <button onClick={() => onGo('finance')} className={due ? 'warn' : ''}><span>À encaisser</span><strong>{money(due)}</strong></button>
        <button onClick={() => onGo('pilotage')} className="j-goal"><span>Objectif 2027</span><strong>{pct} %</strong><i aria-hidden="true"><i style={{ width: pct + '%' }} /></i></button>
      </nav>
    </header>

    <div className="j-layout">
      <div className="j-main">
        <section className={'j-focus' + (priorite ? '' : ' calme')}>
          <div className="j-focus-alfred" aria-hidden="true"><Alfred size={96} mood={prioFaite ? 'fier' : 'calme'} title="Alfred" /></div>
          <p className="j-label">{prioFaite ? 'Bravo, et maintenant' : priorite ? 'Ta priorité du jour' : 'Aujourd’hui'}</p>
          <h2>{priorite || 'Rien d’urgent. Avance ce qui compte pour toi.'}</h2>
          {prioFaite && <p className="j-done">✓ {al.priorite}</p>}
          {al.brief && !prioFaite && <p className="j-brief">{al.brief}</p>}
          {priorite && <div className="j-focus-act">
            <button className="j-btn-on" disabled={!canSave} onClick={prioDone}>C’est fait</button>
            {prioItem?.facturer && <button className="j-btn-ghost" onClick={() => onGo('clients', prioItem.clientId, prioItem.facturer)}>Facturer maintenant</button>}
            {prioItem && !prioItem.facturer && (prioItem.go || prioItem.lien) && <button className="j-btn-ghost" onClick={() => prioItem.lien ? window.open(prioItem.lien, '_blank', 'noopener') : onGo(prioItem.go, prioItem.clientId)}>Y aller</button>}
          </div>}
        </section>

        <form className="j-alfred" onSubmit={e => { e.preventDefault(); give() }}>
          <Alfred size={40} title="Alfred, ton majordome" />
          <label className="j-sr" htmlFor="j-give">Dis-le à Alfred</label>
          <input id="j-give" placeholder="Dis-le à Alfred : une idée, une tâche, un rendez-vous…" value={note} onChange={e => setNote(e.target.value)} />
          <button disabled={!canSave || !note.trim()}>Confier</button>
          {inbox.length > 0 && <small>{inbox.length} en attente de classement</small>}
        </form>

        <div className="j-section-head"><h2>Tes domaines</h2>{al.majLe && <small>Alfred est passé {ago(al.majLe)}</small>}</div>
        <Cartes m={m} crm={crm} saveCrm={saveCrm} canSave={canSave} act={act} onGo={onGo} msgs={msgs} projets={projets} today={today} />

        {al.rapport && <details className="j-rapport">
          <summary><Alfred size={44} /><span><strong>Le rapport d’Alfred</strong><small>ce que l’équipe a fait et ce qu’elle attend de toi</small></span></summary>
          <ul>{al.rapport.split('\n').filter(l => l.trim()).map((l, k) => { const [t, ...r] = l.split(' : '); return <li key={k}>{r.length ? <><b>{t.replace(/^[-•]\s*/, '')}</b> {r.join(' : ')}</> : l}</li> })}</ul>
        </details>}
      </div>

      <aside className="j-side">
        <section className="j-panel">
          <header><h2>Aujourd’hui</h2><button onClick={() => onGo('agenda')}>Agenda</button></header>
          {agendaKo && <p className="acc-empty j-agenda-ko">Ton agenda ne répond pas pour l’instant. <button type="button" onClick={() => setAgendaTick(t => t + 1)}>Réessayer</button></p>}
          {events === null ? <p className="acc-empty">Chargement de ton agenda…</p> : agendaKo && todayEvents.length === 0 ? null : todayEvents.length === 0 ? <p className="acc-empty">Aucun rendez-vous. Journée libre pour avancer.</p> :
            <ol className="j-tl">{todayEvents.map((e, k) => {
              const passe = !e.allDay && (e.end || e.start).slice(11, 16) < nowHM
              const showNow = !e.allDay && !passe && (k === 0 || (todayEvents[k - 1].allDay || (todayEvents[k - 1].end || todayEvents[k - 1].start).slice(11, 16) < nowHM))
              return <React.Fragment key={e.id}>
                {showNow && <li className="j-now" aria-label="Maintenant"><span>{nowHM}</span></li>}
                <li className={'t-' + e.type + (passe ? ' passe' : '')}>
                  <span className="j-h">{e.allDay ? 'Journée' : e.start.slice(11, 16)}</span>
                  <span className="j-ev"><strong>{e.title}</strong>{e.lieu && !/^https?:/.test(e.lieu) && <small>{e.lieu}</small>}</span>
                </li></React.Fragment>
            })}</ol>}
        </section>

        <section className="j-panel">
          <header><h2>Cette semaine</h2></header>
          {weekItems.length === 0 ? <p className="acc-empty">Rien de daté cette semaine.</p> :
            <ul className="j-week">{upcomingDays.map(d => <li key={d}>
              <span className="j-day">{(t => t[0].toUpperCase() + t.slice(1))(dayLabel(d, today))}</span>
              <ul>{upcoming[d].map((x, k) => <li key={k} className={x.kind === 'ev' ? 't-' + x.e.type : 't-task'}>
                <span className="j-h">{x.kind === 'ev' ? (x.e.allDay ? 'Journée' : x.e.start.slice(11, 16)) : 'Tâche'}</span>
                <span>{x.kind === 'ev' ? x.e.title : x.i.titre}</span></li>)}</ul>
            </li>)}</ul>}
          {later.length + m.plus_tard.length > 0 && <details className="mj-more">
            <summary>{later.length + m.plus_tard.length} autre{later.length + m.plus_tard.length > 1 ? 's' : ''} chose{later.length + m.plus_tard.length > 1 ? 's' : ''} sans date</summary>
            <ul className="mj-list">{[...later, ...m.plus_tard].map(i => <Item key={i.id} i={i} canSave={canSave} act={act} onGo={onGo} />)}</ul>
          </details>}
        </section>
      </aside>
    </div>
  </div>
}

// Page Équipe : Alfred, sa boîte, et l'état de chaque agent.
export function GestoriaEquipe({ crm, saveCrm, canSave }) {
  const al = crm.alfred || {}
  const inbox = (al.inbox || []).slice().reverse()
  const state = id => {
    const g = crm.agents?.[id]
    if (id === 'alfred') return { on: !!(g?.majLe || al.majLe), last: g?.majLe || al.majLe, resume: g?.resume || (al.priorite ? 'Priorité du jour : ' + al.priorite : 'Premier passage à 9 h'), attente: g?.attente }
    if (id === 'courrier') {
      const n = (crm.messages?.items || []).filter(x => !x.vu).length
      return { on: !!crm.messages?.majLe, last: crm.messages?.majLe, resume: g?.resume || (crm.messages?.majLe ? (n ? n + ' message' + (n > 1 ? 's' : '') + ' non lu' + (n > 1 ? 's' : '') : 'Tout est lu') : 'Premier relevé bientôt'), attente: g?.attente }
    }
    if (id === 'plateformes') {
      const last = crm.livementor?.releve?.date
      return { on: !!last, last, resume: g?.resume || (crm.livementor?.releve ? (crm.livementor.releve.montantCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' HT ce mois · ' + crm.livementor.releve.actifs + ' apprenants actifs' : 'Relevés programmés'), attente: g?.attente }
    }
    return { on: !!g?.majLe, last: g?.majLe, resume: g?.resume || (id === 'courrier' ? 'Démarre quand ta boîte pro existe' : 'Premier passage programmé'), attente: g?.attente }
  }
  const SCHEDULE = { alfred: '8 h 07 · 13 h 07 · 19 h 07, juste après l’équipe', compta: 'Matin et soir', plateformes: 'Chaque matin', clients: 'Matin, midi et soir', commercial: 'Chaque matin', communication: 'Chaque matin', courrier: 'Matin, midi et soir', atelier: 'La nuit, et toutes les heures en journée si tu lui demandes' }
  const COULEUR = { alfred: '#103c42', clients: '#2e7d72', commercial: '#7a4bb0', communication: '#7a4bb0', compta: '#b5651d', plateformes: '#c0457a', courrier: '#24527a', atelier: '#103c42' }
  const chef = AGENTS.find(a => a.id === 'alfred')
  const s0 = state('alfred')
  const autres = AGENTS.filter(a => a.id !== 'alfred')
  const attendent = autres.filter(a => state(a.id).attente)
  const aClasser = inbox.filter(x => !x.traite)
  return <div className="eq">
    <header className="eq-top">
      <div><h1>Ton équipe</h1><p>Matin, midi et soir, l’équipe passe d’abord, puis Alfred rassemble tout et te fait le point. Ils préparent, tu valides : personne n’envoie, ne publie ni ne touche à ta compta sans toi.</p></div>
      {attendent.length > 0 && <span className="eq-pill">{attendent.length} attend{attendent.length > 1 ? 'ent' : ''} quelque chose de toi</span>}
    </header>

    <section className="eq-chef">
      <Alfred size={72} title="Alfred, ton majordome" />
      <div className="eq-chef-txt">
        <div className="eq-line"><strong>{chef.nom}</strong><span className={'eq-st' + (s0.on ? ' on' : '')}>{s0.on ? 'Actif' : 'Bientôt'}</span></div>
        <small>{chef.role} · {SCHEDULE.alfred}</small>
        <p>{s0.resume}</p>
        {s0.attente && <p className="eq-wait">Attend de toi : {s0.attente}</p>}
        <small>{s0.last ? 'Dernier passage ' + ago(s0.last) : ''}</small>
      </div>
      <div className="eq-chef-inbox"><strong>{aClasser.length}</strong><small>à classer dans sa boîte</small></div>
    </section>

    <section className="eq-grid">{autres.map(a => {
      const s = state(a.id)
      return <article key={a.id} className={'eq-card' + (s.attente ? ' wait' : '')} style={{ '--c': COULEUR[a.id] || '#2e7d72' }}>
        <div className="eq-line"><span className="eq-av" aria-hidden="true">{a.nom[0]}</span><span className={'eq-st' + (s.on ? ' on' : '')}>{s.on ? 'Actif' : 'Bientôt'}</span></div>
        <strong>{a.nom}</strong>
        <small className="eq-role">{a.role}</small>
        <p>{s.resume}</p>
        {s.attente && <p className="eq-wait">Attend de toi : {s.attente}</p>}
        <small className="eq-when">{s.last ? 'Passé ' + ago(s.last) : ''}{s.last ? ' · ' : ''}{SCHEDULE[a.id]}</small>
      </article>
    })}</section>

    <section className="eq-box">
      <header><h2>La boîte d’Alfred</h2><small>{aClasser.length ? aClasser.length + ' à classer' : 'Tout est classé'}</small></header>
      {inbox.length === 0 ? <p className="acc-empty">Vide. Confie-lui quelque chose depuis « Ma journée ».</p> :
        <ul>{inbox.slice(0, 30).map(x => <li key={x.id} className={x.traite ? 'done' : ''}>
          <span className="eq-dot" aria-hidden="true" />
          <div><p>{x.texte}</p><small>{ago(x.date)}{x.traite ? ' · classé' + (x.resultat ? ' : ' + x.resultat : '') : ' · en attente'}</small></div>
          {!x.traite && <button disabled={!canSave} onClick={() => saveCrm(d => ({ ...d, alfred: { ...d.alfred, inbox: d.alfred.inbox.filter(y => y.id !== x.id) } }), 'Retiré.')}>Retirer</button>}
        </li>)}</ul>}
    </section>
  </div>
}
