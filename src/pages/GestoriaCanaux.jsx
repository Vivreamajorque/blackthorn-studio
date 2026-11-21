import React, { useState } from 'react'
import { formatDate, todayInSpain } from '../lib/gestoria-calendar.mjs'
import { Dialog, bind } from './GestoriaClients'
import './gestoria-clients.css'

export const CANAUX = [
  ['instagram', 'Instagram', 'Ta vitrine et tes publications'],
  ['linkedin', 'LinkedIn', 'Ton profil et tes publications pro'],
  ['indeed', 'Indeed', 'Tes offres et ta présence recruteurs'],
  ['site', 'Page web', 'Ta page à construire'],
]
export const CANAL_STATUS = { a_creer: ['À créer', 'wait'], en_cours: ['En cours', 'info'], actif: ['En ligne', 'calm'] }
const empty = { statut: 'a_creer', lien: '', action: '', date: '', notes: '' }

function CanalForm({ canal, value, onSave, onClose, saving }) {
  const [c, setC] = useState({ ...empty, ...value })
  const f = bind(c, setC)
  const badLink = c.lien && !/^https:\/\//i.test(c.lien.trim())
  return <Dialog title={canal[1]} onClose={onClose}
    footer={<><span /><button className="mgc-primary" disabled={saving || badLink} onClick={() => onSave(c)}>Enregistrer</button></>}>
    <div className="mgc-form">
      <div className="mgc-cols">
        <label>État<select {...f('statut')}>{Object.entries(CANAL_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Lien (profil, page)<input placeholder="https://" {...f('lien')} /></label>
      </div>
      {badLink && <p className="mgc-error">Le lien doit commencer par https://</p>}
      <div className="mgc-cols">
        <label>Prochaine action<input placeholder="Ex. publier le portfolio" {...f('action')} /></label>
        <label>Pour le<input type="date" {...f('date')} /></label>
      </div>
      <label>Notes<textarea {...f('notes')} /></label>
    </div>
  </Dialog>
}

export default function GestoriaCanaux({ crm, saveCrm, canSave, saving }) {
  const [edit, setEdit] = useState(null)
  const today = todayInSpain()
  const canaux = crm.canaux || {}
  const save = (key, value) => saveCrm(data => ({ ...data, canaux: { ...(data.canaux || {}), [key]: value } }), 'Canal enregistré.')
    .then(ok => ok && setEdit(null))
  return <>
    <p className="mgc-muted">Là où on te trouve. Pour chaque canal : où il en est, le lien, et la prochaine chose à faire. Les actions dont la date est arrivée remontent dans « Aujourd’hui ».</p>
    <div className="mgc-canaux">
      {CANAUX.map(canal => {
        const [key, name, hint] = canal
        const c = { ...empty, ...canaux[key] }
        const [label, tone] = CANAL_STATUS[c.statut]
        const late = c.action && c.date && c.date <= today
        return <article key={key} className="mgc-panel mgc-canal">
          <div className="mgc-between"><h3 style={{ margin: 0 }}>{name}</h3><span className={'mgc-badge ' + tone}>{label}</span></div>
          <p className="mgc-muted" style={{ margin: '4px 0 10px' }}>{hint}</p>
          {c.action ? <p style={{ margin: '0 0 6px' }}><strong>{c.action}</strong>
            {c.date && <span className={'mgc-badge ' + (late ? 'late' : '')} style={{ marginLeft: 8 }}>{formatDate(c.date)}</span>}</p>
            : <p className="mgc-muted" style={{ margin: '0 0 6px' }}>Aucune action prévue.</p>}
          <div className="mgc-row">
            {c.lien && <a href={c.lien} target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>}
            <button disabled={!canSave} onClick={() => setEdit(canal)}>Modifier</button>
          </div>
        </article>
      })}
    </div>
    {edit && <CanalForm canal={edit} value={canaux[edit[0]]} saving={saving} onClose={() => setEdit(null)} onSave={value => save(edit[0], value)} />}
  </>
}
