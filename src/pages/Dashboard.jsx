import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const OBJECTIF_2026 = 30000
const OBJECTIF_SEMAINE = 1055

function useNotionSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await notion.getSessions()
      if (r.results) setSessions(r.results)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  return { sessions, loading, reload: load }
}

function getMonday(d = new Date()) {
  const day = d.getDay() || 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + 1)
  mon.setHours(0,0,0,0)
  return mon
}

function computeStats(sessions) {
  const now = new Date()
  const monday = getMonday()
  const startOf2026 = new Date('2026-06-15')

  let semaine = 0, cumul2026 = 0, today = 0
  let sessionsSemaine = 0, piercingsSemaine = 0

  sessions.forEach(s => {
    const props = s.properties
    const dateStr = props.Date?.date?.start
    if (!dateStr) return
    const d = new Date(dateStr)
    const prix = props.Prix?.number || 0
    const solde = props['Solde reçu']?.number || 0
    const ca = (prix || 0)

    if (d >= startOf2026) cumul2026 += ca
    if (d >= monday) {
      semaine += ca
      const type = props.Type?.select?.name || ''
      if (type.includes('Tattoo')) sessionsSemaine++
      if (type.includes('Piercing')) piercingsSemaine++
    }
    if (dateStr === now.toISOString().split('T')[0]) today += ca
  })

  return { semaine, cumul2026, today, sessionsSemaine, piercingsSemaine }
}

export default function Dashboard() {
  const { sessions, loading } = useNotionSessions()
  const [toast, setToast] = useState('')

  const stats = computeStats(sessions)
  const pctSemaine = Math.min(100, (stats.semaine / OBJECTIF_SEMAINE) * 100)
  const pct2026 = Math.min(100, (stats.cumul2026 / OBJECTIF_2026) * 100)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const briefMatin = () => {
    const txt = `🖤 BRIEF BLACKTHORN\n\nCA cette semaine : ${stats.semaine.toFixed(0)}€ / ${OBJECTIF_SEMAINE}€\nCA cumul 2026 : ${stats.cumul2026.toFixed(0)}€ / ${OBJECTIF_2026}€\nSessions semaine : ${stats.sessionsSemaine}\nPiercings semaine : ${stats.piercingsSemaine}\n\nDis à Claude : "brief Blackthorn" + ce que Tony t'a dit hier soir`
    navigator.clipboard?.writeText(txt)
    showToast('Brief copié !')
  }

  const fmt = (n) => n >= 1000 ? (n/1000).toFixed(1)+'k€' : n.toFixed(0)+'€'

  return (
    <div style={{ padding: '24px 16px 8px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800,
          letterSpacing: '3px', color: 'var(--pierre)'
        }}>BLACKTHORN</div>
        <div style={{ fontSize: '12px', color: 'var(--gris)', letterSpacing: '1px', marginTop: '2px' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="label">Cette semaine</div>
          <div className="value">{loading ? '...' : fmt(stats.semaine)}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: pctSemaine+'%' }} /></div>
          <div className="sub">{pctSemaine.toFixed(0)}% de 1 055€</div>
        </div>
        <div className="stat-card">
          <div className="label">Cumul 2026</div>
          <div className="value">{loading ? '...' : fmt(stats.cumul2026)}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: pct2026+'%' }} /></div>
          <div className="sub">{pct2026.toFixed(0)}% de 30 000€</div>
        </div>
        <div className="stat-card">
          <div className="label">Sessions sem.</div>
          <div className="value" style={{ fontSize: '22px' }}>{loading ? '...' : stats.sessionsSemaine}</div>
          <div className="sub">🖤 tattoo</div>
        </div>
        <div className="stat-card">
          <div className="label">Piercings sem.</div>
          <div className="value" style={{ fontSize: '22px' }}>{loading ? '...' : stats.piercingsSemaine}</div>
          <div className="sub">💎 piercing</div>
        </div>
      </div>

      {/* Brief matin */}
      <button className="btn btn-primary" onClick={briefMatin} style={{ width: '100%', marginBottom: '20px', padding: '14px' }}>
        ✦ Générer le brief matin
      </button>

      {/* Alertes */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-title">Alertes actives</div>
        {[
          { icon: '🔴', text: 'Cuota Cero Balear → appeler gestor', urgence: 'danger' },
          { icon: '🟡', text: 'Template WhatsApp soir → donner à Tony', urgence: 'warn' },
          { icon: '🟡', text: 'Commander kit piercing + bijoux', urgence: 'warn' },
          { icon: '🟢', text: 'Meta Business Suite → configurer', urgence: 'ok' },
          { icon: '🟢', text: 'Tony : charte artistique Blackthorn', urgence: 'ok' }
        ].map((a, i) => (
          <div key={i} className="card" style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '8px', padding: '12px 16px'
          }}>
            <span>{a.icon}</span>
            <span style={{ fontSize: '13px', flex: 1 }}>{a.text}</span>
          </div>
        ))}
      </div>

      {/* Dernières sessions */}
      <div>
        <div className="section-title">Dernières sessions</div>
        {loading && <div style={{ color: 'var(--gris)', fontSize: '13px' }}>Chargement...</div>}
        {sessions.slice(0, 5).map(s => {
          const p = s.properties
          const type = p.Type?.select?.name || ''
          const client = p['Client prénom']?.rich_text?.[0]?.plain_text || '—'
          const prix = p.Prix?.number || 0
          const date = p.Date?.date?.start || ''
          const natio = p.Nationalité?.select?.name || ''
          return (
            <div key={s.id} className="card" style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '8px', padding: '12px 16px'
            }}>
              <span style={{ fontSize: '18px' }}>
                {type.includes('Tattoo') ? '🖤' : type.includes('Piercing') ? '💎' : '🛍️'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{client}</div>
                <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>
                  {date} · {natio}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--pierre)' }}>
                {prix}€
              </div>
            </div>
          )
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
