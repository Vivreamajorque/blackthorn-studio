import React from 'react'
import Alfred from './Alfred'
import './alfred-chat.css'

// Bulle « Parler à Alfred » : une conversation avec Alfred ou un agent de l'équipe, depuis n'importe quelle page du QG.
const AGENTS = [
  ['alfred', 'Alfred', 'Je t’écoute. Par quoi on commence ?'],
  ['clients', 'Clients', 'Un client à qui répondre, une visio à préparer ?'],
  ['commercial', 'Prospection', 'On cherche une annonce, on prépare une réponse ?'],
  ['communication', 'Communication', 'On avance sur ta page, LinkedIn ou Instagram ?'],
  ['compta', 'Compta', 'Une facture, une échéance, ta prochaine 303 ?'],
  ['livementor', 'LiveMentor', 'Un apprenant, un RDV, un oral à préparer ?'],
]
const IDEES = ['Par quoi je commence ?', 'Qui attend une réponse ?', 'Note : rappeler…']
const ACTION_LABEL = { alfred_noter: 'note ajoutée', alfred_classer: 'tâches rangées', alfred_terminer: 'tâche cochée', ajouter_prospect: 'piste ajoutée', preparer_facture: 'facture préparée', preparer_devis: 'devis préparé' }
const KEY = 'qg-alfred-chat'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} } }
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* stockage indisponible */ } }

function Texte({ text }) {
  return text.split(/\n{2,}/).map((bloc, i) => <p key={i}>{bloc.split('\n').map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{l.split(/\*\*(.+?)\*\*/g).map((s, k) => k % 2 ? <strong key={k}>{s}</strong> : s)}</React.Fragment>)}</p>)
}

export default function AlfredChat() {
  const [open, setOpen] = React.useState(false)
  const [agent, setAgent] = React.useState(() => load().agent || 'alfred')
  const [fils, setFils] = React.useState(() => load().fils || {})
  const [draft, setDraft] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [erreur, setErreur] = React.useState('')
  const listRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const msgs = fils[agent] || []
  const info = AGENTS.find(a => a[0] === agent) || AGENTS[0]

  React.useEffect(() => { save({ agent, fils }) }, [agent, fils])
  React.useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length, busy, open, agent])
  React.useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60) }, [open, agent])
  React.useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function envoyer(texte) {
    const t = (texte ?? draft).trim()
    if (!t || busy) return
    const next = [...msgs, { role: 'user', content: t }]
    setFils(f => ({ ...f, [agent]: next }))
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = ''
    setErreur('')
    setBusy(true)
    try {
      const r = await fetch('/api/gestoria-alfred', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent, messages: next }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.message || 'Alfred n’arrive pas à répondre pour l’instant.')
      const actions = [...new Set((j.actions || []).map(a => ACTION_LABEL[a]).filter(Boolean))]
      setFils(f => ({ ...f, [agent]: [...next, { role: 'assistant', content: j.reponse, actions }] }))
      if (actions.length) window.dispatchEvent(new CustomEvent('qg-crm-change'))
    } catch (e) {
      setErreur(e.message)
    } finally {
      setBusy(false)
    }
  }

  const effacer = () => { setFils(f => ({ ...f, [agent]: [] })); setErreur('') }

  return <>
    <button type="button" className="ac-bulle" data-open={open || undefined} aria-expanded={open} aria-controls="ac-panel" onClick={() => setOpen(o => !o)}>
      <Alfred size={44} title="" /><span>{open ? 'Fermer' : 'Parler à Alfred'}</span>
    </button>
    {open && <section id="ac-panel" className="ac-panel" role="dialog" aria-label="Parler à l’équipe">
      <header className="ac-head">
        <Alfred size={36} title="" />
        <div><strong>{agent === 'alfred' ? 'Alfred' : 'Agent ' + info[1]}</strong><small>{busy ? 'réfléchit…' : 'voit tout ton QG'}</small></div>
        {msgs.length > 0 && <button type="button" className="ac-clear" onClick={effacer}>Nouvelle discussion</button>}
        <button type="button" className="ac-x" aria-label="Fermer" onClick={() => setOpen(false)}>×</button>
      </header>
      <nav className="ac-agents" aria-label="À qui parler">
        {AGENTS.map(([id, label]) => <button key={id} type="button" aria-pressed={agent === id} onClick={() => { setAgent(id); setErreur('') }}>{label}</button>)}
      </nav>
      <div className="ac-list" ref={listRef} aria-live="polite">
        {msgs.length === 0 && <div className="ac-vide">
          <p>{info[2]}</p>
          <div className="ac-idees">{IDEES.map(i => <button key={i} type="button" onClick={() => i.endsWith('…') ? (setDraft('Note : rappeler '), inputRef.current?.focus()) : envoyer(i)}>{i}</button>)}</div>
        </div>}
        {msgs.map((m, i) => <div key={i} className={'ac-msg ac-' + m.role}>
          <Texte text={m.content} />
          {m.actions?.length > 0 && <span className="ac-fait">✓ {m.actions.join(' · ')}</span>}
        </div>)}
        {busy && <div className="ac-msg ac-assistant ac-typing" aria-label="Alfred écrit"><i /><i /><i /></div>}
        {erreur && <p className="ac-err" role="alert">{erreur}</p>}
      </div>
      <form className="ac-form" onSubmit={e => { e.preventDefault(); envoyer() }}>
        <textarea ref={inputRef} rows={1} value={draft} placeholder={'Écris à ' + (agent === 'alfred' ? 'Alfred' : info[1]) + '…'}
          onChange={e => { setDraft(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 140) + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); envoyer() } }} />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Envoyer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </section>}
  </>
}
