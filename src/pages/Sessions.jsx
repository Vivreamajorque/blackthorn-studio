import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const TYPES = ['🖤 Tattoo Tony', '💎 Piercing Amely', '🛍️ Bijou vendu', '🎨 Tattoo Amely', '🎁 Gift Voucher']
const NATIOS = ['🇫🇷 FR', '🇩🇪 DE', '🇬🇧 EN', '🇪🇸 ES', 'Autre']

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: '🖤 Tattoo Tony', client: '', natio: '🇫🇷 FR',
    style: '', prix: '', acompte: '', solde: '', notes: ''
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getSessions()
      if (r.results) setSessions(r.results)
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2000) }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.prix) return
    setSaving(true)
    try {
      const sessionName = `${form.type.split(' ')[1] || 'Session'} · ${form.client || '?'} · ${form.date}`
      await notion.addSession({ ...form, session: sessionName })
      showToast('Session enregistrée ✓')
      setModal(false)
      setForm({ date: new Date().toISOString().split('T')[0], type: '🖤 Tattoo Tony', client: '', natio: '🇫🇷 FR', style: '', prix: '', acompte: '', solde: '', notes: '' })
      load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const totalSemaine = sessions.reduce((acc, s) => {
    const d = s.properties.Date?.date?.start
    if (!d) return acc
    const day = new Date(d)
    const mon = new Date(); mon.setDate(mon.getDate() - (mon.getDay() || 7) + 1); mon.setHours(0,0,0,0)
    return day >= mon ? acc + (s.properties.Prix?.number || 0) : acc
  }, 0)

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Sessions</div>
          <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '2px' }}>
            Semaine : <span style={{ color: 'var(--pierre)', fontFamily: 'var(--font-mono)' }}>{totalSemaine}€</span>
            <span style={{ color: 'var(--gris)' }}> / 1 055€</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Ajouter</button>
      </div>

      {loading && <div style={{ color: 'var(--gris)', textAlign: 'center', padding: '40px' }}>Chargement...</div>}

      {sessions.map(s => {
        const p = s.properties
        const type = p.Type?.select?.name || ''
        const client = p['Client prénom']?.rich_text?.[0]?.plain_text || '—'
        const prix = p.Prix?.number || 0
        const acompte = p['Acompte reçu']?.number || 0
        const solde = p['Solde reçu']?.number || 0
        const date = p.Date?.date?.start || ''
        const natio = p.Nationalité?.select?.name || ''
        const style = p['Style / Type']?.rich_text?.[0]?.plain_text || ''
        const avis = p['Avis Google']?.checkbox

        return (
          <div key={s.id} className="card" style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '22px', marginTop: '2px' }}>
                  {type.includes('Tattoo Tony') ? '🖤' : type.includes('Piercing') ? '💎' : type.includes('Bijou') ? '🛍️' : type.includes('Tattoo Amely') ? '🎨' : '🎁'}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{client}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '3px' }}>
                    {date} · {natio} {style && `· ${style}`}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {!avis && <span className="tag tag-warn">Avis Google ?</span>}
                    {acompte > 0 && <span className="tag tag-piercing">Acompte {acompte}€</span>}
                    {solde > 0 && <span className="tag tag-ok">Solde {solde}€</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--pierre)', flexShrink: 0 }}>
                {prix}€
              </div>
            </div>
          </div>
        )
      })}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nouvelle session</div>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" min="2026-06-01" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Prix *</label>
                  <input type="number" placeholder="280" value={form.prix} onChange={e => setForm({...form, prix: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Client</label>
                  <input placeholder="Prénom" value={form.client} onChange={e => setForm({...form, client: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Nationalité</label>
                  <select value={form.natio} onChange={e => setForm({...form, natio: e.target.value})}>
                    {NATIOS.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Style / Type piercing</label>
                <input placeholder="Botanical, fine line, hélix..." value={form.style} onChange={e => setForm({...form, style: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Acompte reçu</label>
                  <input type="number" placeholder="0" value={form.acompte} onChange={e => setForm({...form, acompte: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Solde reçu</label>
                  <input type="number" placeholder="0" value={form.solde} onChange={e => setForm({...form, solde: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows="2" placeholder="Notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{ resize: 'none' }} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', padding: '14px' }}>
                {saving ? 'Enregistrement...' : '✓ Enregistrer la session'}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
