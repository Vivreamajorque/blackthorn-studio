import React, { useState, useEffect, useRef } from 'react'
import { notion } from '../lib/notion'

const OBJ_JOUR  = 200
const OBJ_MOIS  = 5000   // 200€ × 25 jours

// ─── HELPERS ──────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const fmtDate  = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const getLast7Days = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i))
  return d.toISOString().split('T')[0]
})

// ─── COMPOSANT : Anneau circulaire ─────────────────────
function Ring({ value, max, size = 120, label, sub, color = '#C4A882' }) {
  const pct = Math.min(1, value / max)
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1F1F1F" strokeWidth="10" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={value >= max ? '#27AE60' : color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={size/2} y={size/2 - 6} textAnchor="middle"
          fill={value >= max ? '#27AE60' : color}
          fontSize="18" fontFamily="DM Mono, monospace" fontWeight="500">
          {value}€
        </text>
        <text x={size/2} y={size/2 + 14} textAnchor="middle"
          fill="#888" fontSize="10" fontFamily="DM Sans, sans-serif">
          / {max}€
        </text>
      </svg>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: value >= max ? '#27AE60' : '#555' }}>{sub}</div>}
    </div>
  )
}

// ─── COMPOSANT : Barres 7 jours ────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.ca), OBJ_JOUR)
  const days = ['D-6','D-5','D-4','D-3','D-2','D-1','Auj']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px', padding: '0 4px' }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.ca / max) * 70)
        const hit = d.ca >= OBJ_JOUR
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '9px', color: hit ? '#27AE60' : '#555', fontFamily: 'DM Mono, monospace' }}>
              {d.ca > 0 ? d.ca+'€' : ''}
            </div>
            <div style={{
              width: '100%', height: h+'px', borderRadius: '4px 4px 0 0',
              background: hit ? '#27AE60' : d.ca > 0 ? '#C4A882' : '#1F1F1F',
              transition: 'height 0.4s ease'
            }} />
            <div style={{ fontSize: '8px', color: '#555', textAlign: 'center' }}>{days[i]}</div>
          </div>
        )
      })}
      {/* Ligne objectif */}
    </div>
  )
}

// ─── CATÉGORIES DÉPENSES ──────────────────────────────
const CATS = ['🖊️ Matériel tatouage','🧴 Consommables','📱 Marketing','🔧 Équipement','🏠 Charges fixes','🚗 Déplacements','📦 Autre']

// ─── PAGE PRINCIPALE ──────────────────────────────────
export default function TonyDashboard({ onLogout }) {
  const [tab, setTab] = useState('home')      // home | ca | depense | histo
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Formulaire CA
  const [caForm, setCaForm] = useState({ ca: '', sessions: '1', notes: '', date: todayStr() })
  const [caSaving, setCaSaving] = useState(false)

  // Formulaire Dépense
  const [depForm, setDepForm] = useState({ montant: '', fournisseur: '', categorie: '🖊️ Matériel tatouage', date: todayStr(), notes: '', iva_recuperable: true })
  const [depSaving, setDepSaving] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const fileRef = useRef(null)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const load = async () => {
      try {
        const [s, d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
        if (s.results) setSessions(s.results)
        if (d.results) setDepenses(d.results)
      } catch(e) {}
      setLoading(false)
    }
    load()
  }, [])

  // ── Calculs stats ──────────────────────────────────
  const today = todayStr()
  const last7 = getLast7Days()

  const caByDay = {}
  sessions.forEach(s => {
    const d = s.properties.Date?.date?.start
    const ca = s.properties.Prix?.number || 0
    if (d) caByDay[d] = (caByDay[d] || 0) + ca
  })

  const caAujourdhui = caByDay[today] || 0
  const caSemaine    = last7.reduce((a, d) => a + (caByDay[d] || 0), 0)
  const caMois       = Object.entries(caByDay)
    .filter(([d]) => d.startsWith(today.substring(0, 7)))
    .reduce((a, [, v]) => a + v, 0)

  const barData = last7.map(d => ({ date: d, ca: caByDay[d] || 0 }))

  // Streak : jours consécutifs depuis aujourd'hui ≥ OBJ_JOUR
  let streak = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if ((caByDay[ds] || 0) >= OBJ_JOUR) streak++
    else if (i > 0) break
  }

  // ── Analyse photo ticket ──────────────────────────
  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAnalyzing(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setPhoto(ev.target.result)
      try {
        const r = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: file.type })
        })
        const data = await r.json()
        if (!data.manual) {
          setDepForm(f => ({
            ...f,
            montant: data.montant?.toString() || f.montant,
            fournisseur: data.fournisseur || f.fournisseur,
            categorie: CATS.find(c => c.toLowerCase().includes((data.categorie||'').toLowerCase().split(' ')[0])) || f.categorie,
            date: data.date || f.date,
            notes: data.description || f.notes,
            iva_recuperable: true,
            montant_iva: data.iva_pct ? ((parseFloat(data.montant||0) * data.iva_pct / (100 + data.iva_pct))).toFixed(2) : ''
          }))
          showToast('✓ Ticket analysé automatiquement')
        } else {
          showToast('Ticket non lisible — saisis manuellement')
        }
      } catch(e) { showToast('Saisis manuellement') }
      setAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // ── Submit CA ──────────────────────────────────────
  const submitCA = async () => {
    if (!caForm.ca) return
    setCaSaving(true)
    try {
      await notion.addSession({
        session: `Tony · ${caForm.date} · ${caForm.ca}€`,
        type: '🖤 Tattoo Tony',
        client: '', natio: '—',
        style: caForm.notes,
        prix: caForm.ca, acompte: 0, solde: caForm.ca,
        notes: `${caForm.sessions} session(s)${caForm.notes ? ' · ' + caForm.notes : ''}`,
        date: caForm.date, avis: false
      })
      showToast('✓ CA enregistré')
      setCaForm({ ca: '', sessions: '1', notes: '', date: todayStr() })
      setTab('home')
      // Refresh
      const s = await notion.getSessions()
      if (s.results) setSessions(s.results)
    } catch(e) { showToast('Erreur — réessaie') }
    setCaSaving(false)
  }

  // ── Submit Dépense ─────────────────────────────────
  const submitDep = async () => {
    if (!depForm.montant) return
    setDepSaving(true)
    try {
      await notion.addDepense({ ...depForm, saisi_par: 'Tony' })
      showToast('✓ Dépense enregistrée')
      setDepForm({ montant: '', fournisseur: '', categorie: '🖊️ Matériel tatouage', date: todayStr(), notes: '', iva_recuperable: true })
      setPhoto(null)
      setTab('home')
      const d = await notion.getDepenses()
      if (d.results) setDepenses(d.results)
    } catch(e) { showToast('Erreur — réessaie') }
    setDepSaving(false)
  }

  // ──────────────────────────────────────────────────
  // RENDU
  // ──────────────────────────────────────────────────

  // ── TAB CA ──────────────────────────────────────
  if (tab === 'ca') return (
    <div style={{ padding: '32px 20px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Mon CA du jour</div>
        <button className="btn btn-ghost" onClick={() => setTab('home')} style={{ padding: '6px 14px', fontSize: '12px' }}>← Retour</button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>CA encaissé (€)</div>
        <input type="number" inputMode="decimal" placeholder="0"
          value={caForm.ca} onChange={e => setCaForm({...caForm, ca: e.target.value})}
          style={{ fontSize: '52px', fontFamily: 'var(--font-mono)', fontWeight: 500, textAlign: 'center', background: 'transparent', border: 'none', borderBottom: '2px solid var(--pierre)', borderRadius: 0, color: 'var(--pierre)', width: '220px', padding: '8px 0' }} />
        {caForm.ca > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px', color: parseFloat(caForm.ca) >= OBJ_JOUR ? 'var(--vert)' : 'var(--gris)' }}>
            {parseFloat(caForm.ca) >= OBJ_JOUR ? `✅ Objectif ${OBJ_JOUR}€ atteint !` : `${(OBJ_JOUR - parseFloat(caForm.ca)).toFixed(0)}€ avant l'objectif`}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Sessions</label>
          <input type="number" inputMode="numeric" placeholder="1" value={caForm.sessions} onChange={e => setCaForm({...caForm, sessions: e.target.value})} style={{ textAlign: 'center', fontSize: '20px' }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={caForm.date} onChange={e => setCaForm({...caForm, date: e.target.value})} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label>Notes rapides</label>
        <textarea rows="2" placeholder="Ex: botanical avant-bras, client allemand..." value={caForm.notes} onChange={e => setCaForm({...caForm, notes: e.target.value})} style={{ resize: 'none' }} />
      </div>
      <button className="btn btn-primary" onClick={submitCA} disabled={caSaving || !caForm.ca} style={{ width: '100%', padding: '16px', fontSize: '15px' }}>
        {caSaving ? 'Enregistrement...' : '✓ Valider'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── TAB DÉPENSE ──────────────────────────────────
  if (tab === 'depense') return (
    <div style={{ padding: '28px 20px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Nouvelle dépense</div>
        <button className="btn btn-ghost" onClick={() => { setTab('home'); setPhoto(null) }} style={{ padding: '6px 14px', fontSize: '12px' }}>← Retour</button>
      </div>

      {/* Photo ticket */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      {!photo ? (
        <button onClick={() => fileRef.current.click()} className="btn btn-ghost" style={{ width: '100%', padding: '20px', marginBottom: '20px', borderStyle: 'dashed', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <span style={{ fontSize: '28px' }}>📷</span>
          Photo du ticket (optionnel)<br />
          <span style={{ fontSize: '11px', color: 'var(--gris)' }}>Claude analyse et remplit automatiquement</span>
        </button>
      ) : (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <img src={photo} style={{ width: '100%', borderRadius: '8px', maxHeight: '160px', objectFit: 'cover' }} />
          {analyzing && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--pierre)', fontSize: '14px' }}>Analyse en cours...</div>
            </div>
          )}
          <button onClick={() => { setPhoto(null); setDepForm(f => ({...f, montant:'',fournisseur:'',notes:''})) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '14px' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Montant (€) *</label>
          <input type="number" inputMode="decimal" placeholder="0.00" value={depForm.montant} onChange={e => setDepForm({...depForm, montant: e.target.value})} style={{ fontSize: '22px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={depForm.date} onChange={e => setDepForm({...depForm, date: e.target.value})} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label>Catégorie</label>
        <select value={depForm.categorie} onChange={e => setDepForm({...depForm, categorie: e.target.value})}>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label>Fournisseur / Commerce</label>
        <input placeholder="Ex: Kwadron, Leroy Merlin..." value={depForm.fournisseur} onChange={e => setDepForm({...depForm, fournisseur: e.target.value})} />
      </div>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label>Notes</label>
        <input placeholder="Description rapide" value={depForm.notes} onChange={e => setDepForm({...depForm, notes: e.target.value})} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <input type="checkbox" id="iva" checked={depForm.iva_recuperable} onChange={e => setDepForm({...depForm, iva_recuperable: e.target.checked})} style={{ width: 20, height: 20, accentColor: 'var(--pierre)', cursor: 'pointer' }} />
        <label htmlFor="iva" style={{ fontSize: '13px', color: 'var(--gris)', cursor: 'pointer' }}>IVA récupérable (21%)</label>
      </div>

      <button className="btn btn-primary" onClick={submitDep} disabled={depSaving || !depForm.montant} style={{ width: '100%', padding: '16px', fontSize: '15px' }}>
        {depSaving ? 'Enregistrement...' : '✓ Enregistrer la dépense'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── TAB HISTORIQUE ───────────────────────────────
  if (tab === 'histo') return (
    <div style={{ padding: '24px 16px', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Historique</div>
        <button className="btn btn-ghost" onClick={() => setTab('home')} style={{ padding: '6px 14px', fontSize: '12px' }}>← Retour</button>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>CA</div>
      {loading && <div style={{ color: 'var(--gris)', textAlign: 'center', padding: '20px' }}>Chargement...</div>}
      {sessions.slice(0, 8).map(s => {
        const p = s.properties
        const ca = p.Prix?.number || 0
        const date = p.Date?.date?.start || ''
        const notes = p.Notes?.rich_text?.[0]?.plain_text || ''
        const ok = ca >= OBJ_JOUR
        return (
          <div key={s.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gris)' }}>{date ? fmtDate(date) : '—'}</div>
              {notes && <div style={{ fontSize: '11px', color: 'var(--gris2)', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notes}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {ok && <span style={{ fontSize: '14px' }}>🔥</span>}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: ok ? 'var(--vert)' : 'var(--pierre)' }}>{ca}€</span>
            </div>
          </div>
        )
      })}

      <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', margin: '16px 0 10px' }}>Dépenses récentes</div>
      {depenses.slice(0, 5).map(d => {
        const p = d.properties
        const m = p.Montant?.number || 0
        const cat = p.Catégorie?.select?.name || ''
        const date = p.Date?.date?.start || ''
        const fourn = p.Fournisseur?.rich_text?.[0]?.plain_text || ''
        return (
          <div key={d.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
            <div>
              <div style={{ fontSize: '12px' }}>{cat || '—'}</div>
              <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>{fourn} {date ? '· ' + fmtDate(date) : ''}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--rouge)' }}>-{m}€</span>
          </div>
        )
      })}
    </div>
  )

  // ── HOME ─────────────────────────────────────────
  const dayLabel = caAujourdhui >= OBJ_JOUR ? '🔥 Objectif atteint !' : caAujourdhui > 0 ? `${OBJ_JOUR - caAujourdhui}€ restants` : 'Pas encore saisi'

  return (
    <div style={{ padding: '24px 16px 32px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, letterSpacing: '2px', color: 'var(--pierre)' }}>BLACKTHORN</div>
          <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        {streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(243,156,18,.15)', padding: '6px 12px', borderRadius: '20px' }}>
            <span style={{ fontSize: '18px' }}>🔥</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: '#f5b942', fontWeight: 500 }}>{streak}</span>
            <span style={{ fontSize: '10px', color: '#f5b942' }}>jours</span>
          </div>
        )}
      </div>

      {/* Anneaux de progression */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px' }}>
        <Ring value={caAujourdhui} max={OBJ_JOUR} size={120} label="Aujourd'hui" sub={dayLabel} />
        <Ring value={Math.round(caMois)} max={OBJ_MOIS} size={110} label="Ce mois" sub={`${Math.round(caMois / OBJ_MOIS * 100)}%`} color="#5AADA5" />
      </div>

      {/* Barre de semaine */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>7 derniers jours</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--pierre)' }}>{caSemaine}€</span>
        </div>
        {loading ? (
          <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gris)', fontSize: '12px' }}>Chargement...</div>
        ) : (
          <BarChart data={barData} />
        )}
        {/* Ligne objectif 200€ */}
        <div style={{ fontSize: '10px', color: 'var(--gris)', marginTop: '8px', textAlign: 'center' }}>
          — objectif {OBJ_JOUR}€/jour
        </div>
      </div>

      {/* Dépenses du mois */}
      {depenses.length > 0 && (() => {
        const moisStr = todayStr().substring(0, 7)
        const depMois = depenses.filter(d => (d.properties.Date?.date?.start || '').startsWith(moisStr))
          .reduce((a, d) => a + (d.properties.Montant?.number || 0), 0)
        return depMois > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '10px 14px', background: 'var(--noir2)', borderRadius: 'var(--r)', border: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>🧾 Dépenses ce mois</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--rouge)' }}>-{Math.round(depMois)}€</span>
          </div>
        ) : null
      })()}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="btn btn-primary" onClick={() => setTab('ca')} style={{ padding: '16px', fontSize: '15px', fontWeight: 700 }}>
          + Mon CA du jour
        </button>
        <button className="btn btn-ghost" onClick={() => setTab('depense')} style={{ padding: '14px', fontSize: '14px' }}>
          🧾 Ajouter une dépense / facture
        </button>
        <button className="btn btn-ghost" onClick={() => setTab('histo')} style={{ padding: '12px', fontSize: '13px' }}>
          Voir l'historique
        </button>
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--gris2)', fontSize: '11px', marginTop: '20px', cursor: 'pointer', width: '100%', textAlign: 'center' }}>
        Déconnexion
      </button>
    </div>
  )
}
