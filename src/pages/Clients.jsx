import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const STATUTS = ['💬 Premier contact','📅 RDV confirmé','✅ Sessionné','🔄 Projet en cours','⭐ Client fidèle']
const LANGUES = ['🇫🇷 FR','🇩🇪 DE','🇬🇧 EN','🇪🇸 ES']
const TYPES = ['🖤 Tattoo','💎 Piercing','🎨 Les deux']

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ nom: '', langue: '🇫🇷 FR', whatsapp: '', instagram: '', type: '🖤 Tattoo', projet: '', statut: '💬 Premier contact', acompte: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getClients()
      if (r.results) setClients(r.results)
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2000) }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.nom) return
    setSaving(true)
    try {
      await notion.addClient(form)
      showToast('Client ajouté ✓')
      setModal(false)
      setForm({ nom: '', langue: '🇫🇷 FR', whatsapp: '', instagram: '', type: '🖤 Tattoo', projet: '', statut: '💬 Premier contact', acompte: '', notes: '' })
      load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const filtered = clients.filter(c => {
    const nom = c.properties.Client?.title?.[0]?.plain_text || ''
    return nom.toLowerCase().includes(search.toLowerCase())
  })

  const statutColor = { '💬 Premier contact': 'gris2', '📅 RDV confirmé': 'bleu', '✅ Sessionné': 'vert', '🔄 Projet en cours': 'jaune', '⭐ Client fidèle': 'pierre' }

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Clients CRM</div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Ajouter</button>
      </div>

      <input placeholder="Rechercher un client..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '16px' }} />

      {loading && <div style={{ color: 'var(--gris)', textAlign: 'center', padding: '40px' }}>Chargement...</div>}

      {filtered.map(c => {
        const p = c.properties
        const nom = p.Client?.title?.[0]?.plain_text || '—'
        const langue = p.Langue?.select?.name || ''
        const type = p['Type client']?.select?.name || ''
        const statut = p.Statut?.select?.name || ''
        const projet = p.Projet?.rich_text?.[0]?.plain_text || ''
        const acompte = p.Acompte?.number || 0
        const wa = p.WhatsApp?.phone_number || ''

        return (
          <div key={c.id} className="card" style={{ marginBottom: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{nom}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{langue}</span>
                  <span className={`tag tag-${type.includes('Tattoo') && !type.includes('deux') ? 'tattoo' : type.includes('Piercing') ? 'piercing' : 'bijou'}`}>{type}</span>
                </div>
                {projet && <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '4px' }}>{projet}</div>}
                {acompte > 0 && <span className="tag tag-ok">Acompte {acompte}€</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '12px',
                  background: 'var(--noir3)', color: 'var(--gris)'
                }}>{statut}</span>
                {wa && <a href={`https://wa.me/${wa.replace(/\D/g,'')}`} style={{
                  fontSize: '11px', color: 'var(--pierre)', textDecoration: 'underline'
                }}>WhatsApp</a>}
              </div>
            </div>
          </div>
        )
      })}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nouveau client</div>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Nom *</label>
                  <input placeholder="Prénom Nom" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Langue</label>
                  <select value={form.langue} onChange={e => setForm({...form, langue: e.target.value})}>
                    {LANGUES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input type="tel" placeholder="+34 6..." value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Instagram</label>
                  <input placeholder="@handle" value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Projet</label>
                <input placeholder="Botanical bras gauche..." value={form.projet} onChange={e => setForm({...form, projet: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Statut</label>
                  <select value={form.statut} onChange={e => setForm({...form, statut: e.target.value})}>
                    {STATUTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Acompte</label>
                  <input type="number" placeholder="0" value={form.acompte} onChange={e => setForm({...form, acompte: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows="2" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{ resize: 'none' }} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', padding: '14px' }}>
                {saving ? 'Enregistrement...' : '✓ Ajouter le client'}
              </button>
            </form>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
