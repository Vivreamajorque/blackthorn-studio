import React, { useMemo, useState } from 'react'
import { money, baseCents, toCents, fromCents, clientPotential } from '../lib/gestoria-crm'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { Dialog } from './GestoriaClients'
import './gestoria-clients.css'
import '@fontsource-variable/schibsted-grotesk'
import './gestoria-board.css'

// Couleurs validées (contraste, daltonisme) sur le fond crème.
const REEL = '#00897b'
const CIBLE = '#d07a2e'
const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p }
const tickValues = max => { const m = max / Math.pow(10, Math.floor(Math.log10(max))); const n = m === 5 || m === 2.5 ? 5 : 4; return Array.from({ length: n + 1 }, (_, i) => Math.round(max * i / n)) }
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const compact = cents => {
  const e = (cents || 0) / 100
  return e >= 1000 ? (Math.round(e / 100) / 10).toLocaleString('fr-FR') + ' k€' : Math.round(e).toLocaleString('fr-FR') + ' €'
}

// Échéances fiscales de l'année : 303 + 130 par trimestre.
export function taxDeadlines(year) {
  return [
    { date: year + '-01-30', label: 'Dépôt T4 ' + (year - 1) + ' · modelos 303 et 130' },
    { date: year + '-04-20', label: 'Dépôt T1 · modelos 303 et 130' },
    { date: year + '-07-20', label: 'Dépôt T2 · modelos 303 et 130' },
    { date: year + '-10-20', label: 'Dépôt T3 · modelos 303 et 130' },
  ]
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000)

// Les choses à faire aujourd'hui, par ordre d'urgence.
export function todayList({ entries, crm, today }) {
  const items = []
  for (const e of entries.filter(e => e.kind === 'invoice' && e.payment !== 'paid' && e.expectedPaymentDate && e.expectedPaymentDate < today)) {
    items.push({ rank: 0, tone: 'late', text: 'Relancer le paiement de la facture ' + e.reference + ' (' + money(e.amountCents) + ')', when: 'en retard depuis le ' + formatDate(e.expectedPaymentDate), go: 'clients' })
  }
  for (const d of [...taxDeadlines(Number(today.slice(0, 4))), ...taxDeadlines(Number(today.slice(0, 4)) + 1)]) {
    const n = daysBetween(today, d.date)
    if (n >= 0 && n <= 12) items.push({ rank: n <= 5 ? 1 : 3, tone: n <= 5 ? 'late' : 'wait', text: d.label, when: n === 0 ? 'aujourd’hui' : 'dans ' + n + ' j · ' + formatDate(d.date), go: 'tasks' })
  }
  for (const p of crm.projets.filter(p => p.prochainRdv && p.prochainRdv.slice(0, 10) === today)) {
    const c = crm.clients.find(x => x.id === p.clientId)
    items.push({ rank: 1, tone: 'info', text: 'Rendez-vous ' + (c ? c.nom : '') + ' · ' + p.nom, when: 'aujourd’hui à ' + p.prochainRdv.slice(11, 16), go: 'clients' })
  }
  for (const p of crm.prospects.filter(p => !['gagne', 'perdu'].includes(p.statut) && p.relance && p.relance <= today)) {
    items.push({ rank: 2, tone: 'wait', text: 'Relancer ' + p.nom + (p.entreprise ? ' (' + p.entreprise + ')' : ''), when: p.relance < today ? 'prévu le ' + formatDate(p.relance) : 'aujourd’hui', go: 'prospection' })
  }
  for (const [key, name] of [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['site', 'Page web']]) {
    const c = (crm.canaux || {})[key]
    if (c && c.action && c.date && c.date <= today) items.push({ rank: 2, tone: 'wait', text: name + ' · ' + c.action, when: c.date < today ? 'prévu le ' + formatDate(c.date) : 'aujourd’hui', go: 'prospection' })
  }
  for (const p of crm.projets.filter(p => ['en_cours', 'a_demarrer'].includes(p.statut))) {
    const a = p.actions.find(a => a.pour === 'amely' && !a.fait)
    const c = crm.clients.find(x => x.id === p.clientId)
    if (a) items.push({ rank: 4, tone: '', text: (c ? c.nom + ' · ' : '') + a.label, when: p.nom, go: 'clients' })
  }
  return items.sort((a, b) => a.rank - b.rank)
}

function LineChart({ months, cumul, target, objectif, currentMonth }) {
  const [hover, setHover] = useState(null)
  const W = 720, H = 260, L = 56, R = 16, T = 18, B = 30
  const max = niceMax(Math.max(objectif, ...cumul.filter(v => v != null), 1))
  const x = i => L + i * (W - L - R) / 11
  const y = v => T + (H - T - B) * (1 - v / max)
  const ticks = tickValues(max)
  const path = values => values.map((v, i) => v == null ? null : (i === 0 || values[i - 1] == null ? 'M' : 'L') + x(i) + ' ' + y(v)).filter(Boolean).join(' ')
  const lastReal = cumul.reduce((last, v, i) => v != null ? i : last, -1)
  return <div style={{ position: 'relative' }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Chiffre d’affaires cumulé comparé à la trajectoire de l’objectif"
      onMouseLeave={() => setHover(null)}
      onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; setHover(Math.max(0, Math.min(11, Math.round((px - L) / ((W - L - R) / 11))))) }}>
      {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e9e2d6" strokeWidth="1" />
        <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6a756f">{compact(t)}</text></g>)}
      {months.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={i === currentMonth ? '#1d2a2b' : '#6a756f'} fontWeight={i === currentMonth ? 700 : 400}>{m}</text>)}
      <path d={path(target)} fill="none" stroke={CIBLE} strokeWidth="2" strokeDasharray="6 5" />
      <path d={path(cumul)} fill="none" stroke={REEL} strokeWidth="2.5" strokeLinejoin="round" />
      {cumul.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill={REEL} stroke="#fffdf9" strokeWidth="2" />)}
      {lastReal >= 0 && <text x={lastReal > 8 ? x(lastReal) - 8 : x(lastReal) + 8} y={y(cumul[lastReal]) - 10} textAnchor={lastReal > 8 ? 'end' : 'start'} fontSize="12" fill="#1d2a2b" fontWeight="700">Réalisé · {compact(cumul[lastReal])}</text>}
      <text x={x(11) - 4} y={y(target[11]) - 8} textAnchor="end" fontSize="12" fill="#1d2a2b">Objectif · {compact(objectif)}</text>
      {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#1d2a2b" strokeOpacity=".25" />}
    </svg>
    {hover != null && <div className="mgc-tooltip" style={{ left: `calc(${x(hover) / W * 100}% + ${hover > 8 ? -170 : 10}px)` }}>
      <strong>{MONTHS[hover]}</strong>
      <div><i style={{ background: REEL }} />Réalisé cumulé : {cumul[hover] != null ? money(cumul[hover]) : '—'}</div>
      <div><i style={{ background: CIBLE }} />Trajectoire : {money(target[hover])}</div>
    </div>}
  </div>
}

function BarChart({ monthly, months, needed, currentMonth }) {
  const [hover, setHover] = useState(null)
  const W = 720, H = 200, L = 56, R = 16, T = 14, B = 30
  const max = niceMax(Math.max(needed, ...monthly, 1))
  const band = (W - L - R) / 12
  const y = v => T + (H - T - B) * (1 - v / max)
  const ticks = tickValues(max)
  return <div style={{ position: 'relative' }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Chiffre d’affaires facturé par mois">
      {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e9e2d6" />
        <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6a756f">{compact(t)}</text></g>)}
      {monthly.map((v, i) => {
        const bx = L + i * band + band * .2, bw = band * .6, top = y(v), h = Math.max(0, H - B - top)
        return <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <rect x={L + i * band} y={T} width={band} height={H - B - T} fill="transparent" />
          {h > 0 && <path d={`M${bx} ${H - B} V${top + 4} Q${bx} ${top} ${bx + 4} ${top} H${bx + bw - 4} Q${bx + bw} ${top} ${bx + bw} ${top + 4} V${H - B} Z`} fill={REEL} fillOpacity={i > currentMonth ? .35 : 1} />}
          <text x={L + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={i === currentMonth ? '#1d2a2b' : '#6a756f'} fontWeight={i === currentMonth ? 700 : 400}>{months[i]}</text>
        </g>
      })}
      {needed > 0 && <g><line x1={L} x2={W - R} y1={y(needed)} y2={y(needed)} stroke={CIBLE} strokeWidth="2" strokeDasharray="6 5" />
        <text x={W - R} y={y(needed) - 6} textAnchor="end" fontSize="12" fill="#1d2a2b">Rythme mensuel visé · {compact(needed)}</text></g>}
    </svg>
    {hover != null && <div className="mgc-tooltip" style={{ left: `calc(${(L + hover * band) / W * 100}% + ${hover > 8 ? -150 : 10}px)` }}>
      <strong>{MONTHS[hover]}</strong><div><i style={{ background: REEL }} />Facturé : {money(monthly[hover])}</div>
    </div>}
  </div>
}

export default function GestoriaPilotage({ entries, crm, year, saveCrm, canSave, onGo, studio }) {
  const [editGoal, setEditGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [showAll, setShowAll] = useState(false)
  const today = todayInSpain()
  const independent = useMemo(() => entries.filter(e => (e.entity || 'independent') === 'independent'), [entries])
  const objectif = crm.objectifs?.[year] ?? (year === 2027 ? 20000000 : 0)
  const thisYear = Number(today.slice(0, 4))
  const currentMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : year < thisYear ? 11 : -1

  const monthly = Array(12).fill(0)
  for (const e of independent) if (e.kind === 'invoice' && e.date.startsWith(String(year))) monthly[Number(e.date.slice(5, 7)) - 1] += baseCents(e)
  let run = 0
  const cumul = monthly.map((v, i) => { run += v; return i <= currentMonth ? run : null })
  const total = monthly.reduce((s, v) => s + v, 0)
  const target = Array.from({ length: 12 }, (_, i) => Math.round(objectif * (i + 1) / 12))
  const remainingMonths = year === thisYear ? 12 - currentMonth : year > thisYear ? 12 : 0
  const neededPerMonth = remainingMonths > 0 ? Math.max(0, Math.round((objectif - total) / remainingMonths)) : 0
  const pct = objectif ? Math.min(100, Math.round(total / objectif * 100)) : 0
  const gap = currentMonth >= 0 && objectif ? cumul[currentMonth] - target[currentMonth] : 0

  const month = today.slice(0, 7)
  const signed = crm.prospects.filter(p => p.statut === 'gagne' && (p.signeLe || '').startsWith(month)).length
  const pipeline = crm.prospects.filter(p => !['gagne', 'perdu'].includes(p.statut)).reduce((s, p) => s + p.valeurCents, 0)
  const pending = independent.filter(e => e.kind === 'invoice' && e.payment !== 'paid').reduce((s, e) => s + e.amountCents, 0)
  const list = todayList({ entries: independent, crm, today })
  const shown = showAll ? list : list.slice(0, 3)
  // Ce qui reste à rentrer : devis signés pas encore facturés + missions en cours pas encore facturées.
  const potentials = (crm.clients || []).map(c => clientPotential(entries, crm, c))
  const resteAFacturer = potentials.reduce((s, p) => s + p.rest, 0)
  const enCours = potentials.reduce((s, p) => s + p.enCours, 0)
  const receipts = studio?.data?.receipts || []
  const byMethod = { carte: 0, cash: 0, other: 0 }
  for (const r of receipts) byMethod[r.method === 'carte' || r.method === 'cash' ? r.method : 'other'] += Math.round(r.amount * 100)
  const studioTotal = byMethod.carte + byMethod.cash + byMethod.other
  const canauxActifs = ['instagram', 'linkedin', 'indeed', 'site'].filter(k => crm.canaux?.[k]?.statut === 'actif').length

  const euros = cents => Math.round((cents || 0) / 100).toLocaleString('fr-FR') + ' €'
  const nextDeadline = [...taxDeadlines(thisYear), ...taxDeadlines(thisYear + 1)].find(d => d.date >= today)
  const daysToDeadline = nextDeadline ? daysBetween(today, nextDeadline.date) : null
  const openLeads = crm.prospects.filter(p => !['gagne', 'perdu'].includes(p.statut))
  const leadsToFollow = openLeads.filter(p => p.relance && p.relance <= today).length
  const CANAUX = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['indeed', 'Indeed'], ['site', 'Page web']]
  const canalLabel = { a_creer: 'À créer', en_cours: 'En cours', actif: 'En ligne' }
  const [first, ...others] = list
  const share = v => studioTotal ? Math.round(v / studioTotal * 1000) / 10 : 0

  return <div className="qg-board">
    <header className="qg-head">
      <p>{new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>Où tu en es</h1>
    </header>

    <section className="qg-now" aria-label="À faire maintenant">
      {first ? <>
        <div className="qg-now-main">
          <span className="qg-now-tag">À faire maintenant</span>
          <strong>{first.text}</strong>
          <span className="qg-sub">{first.when}</span>
          <button className="qg-primary" onClick={() => onGo(first.go)}>Ouvrir</button>
        </div>
        {others.length > 0 && <ul className="qg-now-next">
          {(showAll ? others : others.slice(0, 3)).map((item, i) => <li key={i}>
            <button onClick={() => onGo(item.go)}><span>{item.text}</span><small>{item.when}</small></button></li>)}
          {others.length > 3 && <li><button className="qg-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Réduire' : 'Voir les ' + (others.length - 3) + ' autres'}</button></li>}
        </ul>}
      </> : <div className="qg-now-main"><strong>Rien d’urgent aujourd’hui.</strong>
        <span className="qg-sub">Aucune facture en retard, aucune échéance proche, aucune relance due. Bon moment pour prospecter ou avancer un projet.</span></div>}
    </section>

    <div className="qg-lanes">
      <article className="qg-lane qg-clients">
        <header><h2>Clients</h2><button onClick={() => onGo('clients')}>Ouvrir</button></header>
        <p className="qg-label">Facturé en {year} (HT)</p>
        <p className="qg-hero-num">{euros(total)}</p>
        {objectif > 0 && <>
          <div className="qg-meter" role="img" aria-label={pct + ' % de l’objectif'}><span style={{ width: pct + '%' }} /></div>
          <p className="qg-sub">{pct} % de l’objectif de {euros(objectif)}{currentMonth >= 0 && ' · ' + (gap >= 0 ? 'en avance de ' + euros(gap) : 'en retard de ' + euros(-gap))}</p>
        </>}
        <dl className="qg-facts">
          <div><dt>Facturé, pas encore encaissé</dt><dd>{euros(pending)}</dd></div>
          <div><dt>Devis signés, reste à facturer</dt><dd>{euros(resteAFacturer)}</dd></div>
          <div><dt>En cours, pas facturé</dt><dd>{euros(enCours)}</dd></div>
          <div><dt>Potentiel {year}</dt><dd><b>{euros(total + resteAFacturer + enCours)}</b></dd></div>
          <div><dt>Pistes ouvertes</dt><dd>{openLeads.length}<small> · {euros(pipeline)}</small></dd></div>
          <div><dt>À relancer</dt><dd className={leadsToFollow ? 'warn' : ''}>{leadsToFollow}</dd></div>
          <div><dt>Signées ce mois-ci</dt><dd>{signed}</dd></div>
        </dl>
        <button className="qg-link" onClick={() => onGo('prospection')}>Voir la prospection</button>
      </article>

      <article className="qg-lane qg-compta">
        <header><h2>Compta</h2><button onClick={() => onGo('tasks')}>Déclarations</button></header>
        <p className="qg-label">Prochain dépôt (303 / 130)</p>
        <p className="qg-hero-num">{nextDeadline ? new Date(nextDeadline.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</p>
        {nextDeadline && <p className="qg-sub">dans {daysToDeadline} jours</p>}
        <details className="qg-secondary">
          <summary>Blackthorn Tattoo (secondaire)</summary>
        <p className="qg-label">Blackthorn Tattoo · encaissé en {year}</p>
        <p className="qg-hero-num">{studio?.status === 'ready' ? euros(studioTotal) : studio?.status === 'error' ? 'Indisponible' : '…'}</p>
        {studio?.status === 'ready' && studioTotal > 0 && <>
          <div className="qg-split" role="img" aria-label={'Carte ' + share(byMethod.carte) + ' %, espèces ' + share(byMethod.cash) + ' %'}>
            <span className="carte" style={{ width: share(byMethod.carte) + '%' }} />
            <span className="cash" style={{ width: share(byMethod.cash) + '%' }} />
            <span className="other" style={{ width: share(byMethod.other) + '%' }} />
          </div>
          <ul className="qg-legend">
            <li><i className="carte" />Carte <b>{euros(byMethod.carte)}</b></li>
            <li><i className="cash" />Espèces <b>{euros(byMethod.cash)}</b></li>
            {byMethod.other > 0 && <li><i className="other" />Autres <b>{euros(byMethod.other)}</b></li>}
          </ul>
        </>}
        <dl className="qg-facts">
          {studio?.status === 'ready' && studio.data.reconciliationWarnings > 0 &&
            <div><dt>Lignes à rapprocher</dt><dd className="warn">{studio.data.reconciliationWarnings}</dd></div>}
        </dl>
        <p className="qg-sub">Seules les ventes confirmées dans le Hub sont comptées. Les espèces se déclarent comme le reste.</p>
          <button className="qg-link" onClick={() => onGo('blackthorn')}>Ouvrir Blackthorn</button>
        </details>
      </article>

      <article className="qg-lane qg-comm">
        <header><h2>Communication</h2><button onClick={() => onGo('prospection')}>Ouvrir</button></header>
        <p className="qg-label">Canaux en ligne</p>
        <p className="qg-hero-num">{canauxActifs}<small> sur 4</small></p>
        <ul className="qg-canaux">
          {CANAUX.map(([key, name]) => {
            const c = crm.canaux?.[key] || {}
            const st = c.statut || 'a_creer'
            return <li key={key}>
              <span className={'qg-dot ' + st} aria-hidden="true" />
              <div><strong>{name}</strong><span className="qg-sub">{canalLabel[st]}{c.action ? ' · ' + c.action : ''}{c.date ? ' · ' + formatDate(c.date) : ''}</span></div>
            </li>
          })}
        </ul>
        <button className="qg-link" onClick={() => onGo('prospection')}>Gérer les canaux</button>
      </article>
    </div>

    <section className="qg-trend">
      <div className="qg-trend-head">
        <h2>Trajectoire {year}</h2>
        <button disabled={!canSave} onClick={() => { setGoalInput(fromCents(objectif)); setEditGoal(true) }}>{objectif ? 'Modifier l’objectif' : 'Fixer un objectif'}</button>
      </div>
      <div className="qg-charts">
        {objectif > 0 && <div><h3>Chiffre d’affaires cumulé</h3>
          <LineChart months={MONTHS} cumul={cumul} target={target} objectif={objectif} currentMonth={currentMonth} /></div>}
        <div><h3>Facturé par mois{neededPerMonth > 0 && ' · rythme visé ' + compact(neededPerMonth)}</h3>
          <BarChart monthly={monthly} months={MONTHS} needed={neededPerMonth} currentMonth={currentMonth} />
          <details className="mgc-muted" style={{ marginTop: 6 }}><summary>Voir les chiffres</summary>
            <table className="mgc-table"><tbody>{monthly.map((v, i) => <tr key={i}><td>{MONTHS[i]}</td><td className="mgc-num">{money(v)}</td><td className="mgc-num">{cumul[i] != null ? money(cumul[i]) : ''}</td></tr>)}</tbody></table>
          </details></div>
      </div>
    </section>
    {editGoal && <Dialog title={'Objectif ' + year} onClose={() => setEditGoal(false)}
      footer={<><span /><button className="mgc-primary" disabled={!canSave} onClick={() => saveCrm(data => ({ ...data, objectifs: { ...data.objectifs, [year]: toCents(goalInput || 0) } }), 'Objectif enregistré.').then(ok => ok && setEditGoal(false))}>Enregistrer</button></>}>
      <div className="mgc-form"><label>Chiffre d’affaires visé sur l’année (€ HT)<input type="number" min="0" step="1000" autoFocus value={goalInput} onChange={e => setGoalInput(e.target.value)} /></label>
        <p className="mgc-muted">Compte toutes les factures de Mon activité (Malt, LiveMentor, clients directs), hors TVA.</p></div>
    </Dialog>}
  </div>
}
