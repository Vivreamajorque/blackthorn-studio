import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'
import { Sparkline, MiniBar, Donut, BigStat } from '../components/Charts'

const OBJ_JOUR = 210
const OBJ_MOIS = 5250
const LOYER_HT = 717
const RETA_TONY = 89

// ── helpers ──────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisMonth = () => todayStr().substring(0, 7)
const getLast = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
  return d.toISOString().split('T')[0]
})
const getLast4Weeks = () => Array.from({ length: 4 }, (_, i) => {
  const from = new Date(); from.setDate(from.getDate() - (3 - i) * 7 - 6)
  const to   = new Date(); to.setDate(to.getDate() - (3 - i) * 7)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0], label: `S-${3 - i}` }
})
const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k€` : `${Math.round(n)}€`
const fmtN = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${Math.round(n)}`

// Sources d'acquisition
const SOURCES = ['📱 Instagram', '🔍 Google Maps', '💬 Bouche-à-oreille', '🚪 Walk-in', '🎵 TikTok', '👥 Facebook', '🔗 Autre']

export default function Metriques() {
  const [sessions, setSessions]   = useState([])
  const [depenses, setDepenses]   = useState([])
  const [kpis, setKpis]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('dashboard') // dashboard | saisie
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState('')

  // Formulaire saisie métriques
  const [saisie, setSaisie] = useState({
    semaine: `Sem ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })}`,
    insta_abonnes: '', insta_dm: '', insta_rdv: '',
    tiktok_vues: '', google_clics: '', google_avis: '',
    facebook_abonnes: '',
    source_principale: '📱 Instagram',
    notes: ''
  })

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d, k] = await Promise.all([
        notion.getSessions(),
        notion.getDepenses(),
        notion.getKPIs()
      ])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
      if (k.results) setKpis(k.results)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── CALCULS AUTO ─────────────────────────────────────
  const caByDay = {}
  const natios  = {}
  sessions.forEach(s => {
    const date = s.properties.Date?.date?.start
    const ca   = s.properties.Prix?.number || 0
    const nat  = s.properties.Nationalité?.select?.name || 'Autre'
    if (date) {
      caByDay[date] = (caByDay[date] || 0) + ca
      natios[nat]   = (natios[nat] || 0) + 1
    }
  })

  const m = thisMonth()
  const mois    = sessions.filter(s => (s.properties.Date?.date?.start || '').startsWith(m))
  const caMois  = mois.reduce((a, s) => a + (s.properties.Prix?.number || 0), 0)
  const nbMois  = mois.length
  const panierM = nbMois > 0 ? caMois / nbMois : 0

  const depMois = depenses
    .filter(d => (d.properties.Date?.date?.start || '').startsWith(m))
    .reduce((a, d) => a + (d.properties.Montant?.number || 0), 0)

  const chargesFixes = LOYER_HT + RETA_TONY
  const margeB   = caMois * 0.75
  const resultat = margeB - chargesFixes
  const netEst   = resultat * 0.8  // après IRPF 20%

  // Days hitting objective
  const last30 = getLast(30)
  const joursOk = last30.filter(d => (caByDay[d] || 0) >= OBJ_JOUR).length
  const tauxObj = Math.round((joursOk / last30.length) * 100)

  // Sparkline 14 jours
  const last14 = getLast(14)
  const spark14 = last14.map(d => caByDay[d] || 0)

  // Barres semaine (4 dernières semaines)
  const sem4 = getLast4Weeks().map(s => {
    let v = 0
    let d = new Date(s.from)
    while (d.toISOString().split('T')[0] <= s.to) {
      v += caByDay[d.toISOString().split('T')[0]] || 0
      d.setDate(d.getDate() + 1)
    }
    return { v, label: s.label }
  })

  // Nationalités → donut
  const NATIO_COLORS = { '🇩🇪 DE': '#F5B942', '🇬🇧 EN': '#E74C3C', '🇫🇷 FR': '#5DADE2', '🇪🇸 ES': '#F39C12', 'Autre': '#555' }
  const donutSegs = Object.entries(natios)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => ({ label: k, v, color: NATIO_COLORS[k] || '#888' }))

  // Dernier KPI hebdo
  const lastKPI = kpis[0]?.properties || {}

  // Taux conversion DM → RDV
  const dm   = parseInt(lastKPI['DM reçus']?.number || 0)
  const rdv  = parseInt(lastKPI['DM convertis RDV']?.number || 0)
  const txConv = dm > 0 ? Math.round((rdv / dm) * 100) : 0

  const submitSaisie = async () => {
    if (!saisie.semaine) return
    setSaving(true)
    try {
      await notion.addKPI({
        semaine: saisie.semaine,
        ca_tattoo: 0, ca_piercing: 0, ca_bijoux: 0, ca_parallele: 0,
        total: caMois, sessions: nbMois, prix_moyen: panierM,
        insta_abonnes: saisie.insta_abonnes,
        tiktok_vues: saisie.tiktok_vues,
        google_clics: saisie.google_clics,
        avis_recus: saisie.google_avis,
        dm_recus: saisie.insta_dm,
        dm_convertis: saisie.insta_rdv,
        capital: 0,
        notes: `Source: ${saisie.source_principale} | FB: ${saisie.facebook_abonnes} | ${saisie.notes}`
      })
      showToast('✓ Métriques enregistrées')
      setTab('dashboard')
      load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'saisie',    label: '✏️ Saisir métriques' }
  ]

  return (
    <div style={{ padding: '20px 16px 8px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Métriques pilotage</div>
        <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>
          {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 'var(--r)',
            background: tab === t.id ? 'var(--pierre)' : 'var(--noir2)',
            color: tab === t.id ? 'var(--noir)' : 'var(--gris)',
            border: tab === t.id ? 'none' : '1px solid var(--noir3)',
            fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '11px',
            cursor: 'pointer', transition: 'all .2s', letterSpacing: '.5px'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════ */}
      {tab === 'dashboard' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--gris)', padding: '60px 0', fontSize: '14px' }}>Chargement des données...</div>
          ) : (
            <>

              {/* ── KPIs TOP ─────────────────────────────── */}
              <div className="section-title">Finance du mois</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <BigStat label="CA mois" value={fmt(caMois)} sub={`${Math.round(caMois/OBJ_MOIS*100)}% de l'objectif ${fmt(OBJ_MOIS)}`} icon="💰" />
                <BigStat label="Panier moyen" value={fmt(panierM)} sub={`objectif : 200€`} color={panierM >= 200 ? 'var(--vert)' : 'var(--pierre)'} icon="🎯" />
                <BigStat label="Net estimé" value={fmt(netEst)} sub="après IRPF 20%" color={netEst >= 2000 ? 'var(--vert)' : 'var(--rouge)'} icon="💳" />
                <BigStat label="Dépenses mois" value={`-${fmt(depMois)}`} sub={`${Math.round(depMois/caMois*100)||0}% du CA`} color="var(--rouge)" icon="🧾" />
              </div>

              {/* ── SESSIONS ─────────────────────────────── */}
              <div className="section-title">Sessions & production</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="label">RDV mois</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: 'var(--pierre)' }}>{nbMois}</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="label">Taux objectif</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: tauxObj >= 60 ? 'var(--vert)' : 'var(--pierre)' }}>{tauxObj}%</div>
                  <div className="sub">jours ≥ 200€/30j</div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="label">CA/session</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: 'var(--pierre)' }}>{fmt(panierM)}</div>
                </div>
              </div>

              {/* ── COURBE CA 14j ──────────────────────── */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>Tendance CA 14 jours</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--pierre)' }}>{fmt(spark14.reduce((a,v)=>a+v,0))}</span>
                </div>
                <Sparkline data={spark14} width={300} height={50} target={OBJ_JOUR} />
                <div style={{ fontSize: '10px', color: 'var(--gris2)', marginTop: '6px' }}>--- objectif {OBJ_JOUR}€/jour · 14 derniers jours</div>
              </div>

              {/* ── BARRES 4 SEMAINES ──────────────────── */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>CA 4 dernières semaines</span>
                </div>
                <MiniBar data={sem4} height={56} target={OBJ_MOIS / 4} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                  {sem4.map((s, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'var(--gris2)' }}>
                      <div>{s.label}</div>
                      <div style={{ color: s.v >= OBJ_MOIS/4 ? 'var(--vert)' : 'var(--gris)' }}>{fmt(s.v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── NATIONALITÉS ───────────────────────── */}
              {Object.keys(natios).length > 0 && (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Nationalités clients</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Donut segments={donutSegs} size={80} centerLabel={`${nbMois}\nsess.`} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {donutSegs.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', flex: 1 }}>{s.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--gris)' }}>
                            {s.v} ({Math.round(s.v / nbMois * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ACQUISITION (depuis dernier KPI) ──── */}
              <div className="section-title">Acquisition & réseaux</div>

              {lastKPI && Object.keys(lastKPI).length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div className="stat-card">
                      <div className="label">📱 Instagram</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--pierre)' }}>
                        {fmtN(lastKPI['Insta abonnés']?.number || 0)}
                      </div>
                      <div className="sub">abonnés</div>
                    </div>
                    <div className="stat-card">
                      <div className="label">🎵 TikTok</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--pierre)' }}>
                        {fmtN(lastKPI['TikTok vues']?.number || 0)}
                      </div>
                      <div className="sub">vues semaine</div>
                    </div>
                    <div className="stat-card">
                      <div className="label">🔍 Google clics</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: 'var(--pierre)' }}>
                        {lastKPI['Google clics appel']?.number || 0}
                      </div>
                      <div className="sub">appels/semaine</div>
                    </div>
                    <div className="stat-card">
                      <div className="label">🔄 DM → RDV</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: txConv >= 30 ? 'var(--vert)' : 'var(--pierre)' }}>
                        {txConv}%
                      </div>
                      <div className="sub">{rdv}/{dm} DMs convertis</div>
                    </div>
                  </div>

                  {/* Funnel acquisition */}
                  <div className="card" style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Funnel d'acquisition</div>
                    {[
                      { label: 'Impressions réseaux', v: (lastKPI['TikTok vues']?.number || 0) + (lastKPI['Insta abonnés']?.number || 0) * 3, color: '#555' },
                      { label: 'DMs / contacts reçus', v: lastKPI['DM reçus']?.number || 0, color: '#C4A882' },
                      { label: 'RDV confirmés', v: lastKPI['DM convertis RDV']?.number || 0, color: '#5DADE2' },
                      { label: 'Sessions réalisées', v: nbMois, color: '#27AE60' }
                    ].map((row, i) => {
                      const maxV = Math.max(row.v, 1)
                      const base = (lastKPI['TikTok vues']?.number || 1) + (lastKPI['Insta abonnés']?.number || 1) * 3
                      const pct = Math.round((row.v / Math.max(base, nbMois)) * 100)
                      return (
                        <div key={i} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{row.label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: row.color }}>{fmtN(row.v)}</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: Math.min(100, pct) + '%', background: row.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '12px' }}>
                    Aucune métrique réseau saisie encore.<br />Commence par la saisie hebdomadaire.
                  </div>
                  <button className="btn btn-primary" onClick={() => setTab('saisie')} style={{ padding: '10px 20px', fontSize: '12px' }}>
                    Saisir mes métriques
                  </button>
                </div>
              )}

              {/* ── PROJECTION FIN DE MOIS ─────────────── */}
              <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--epine2)' }}>
                <div style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>📈 Projection fin de mois</div>
                {(() => {
                  const jourDuMois = new Date().getDate()
                  const joursRestants = 25 - jourDuMois
                  const cadenceActuelle = nbMois > 0 ? caMois / jourDuMois : 0
                  const projCA = caMois + cadenceActuelle * joursRestants
                  const projNet = (projCA * 0.75 - chargesFixes) * 0.8
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--gris)', marginBottom: '3px' }}>CA projeté</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: projCA >= OBJ_MOIS ? 'var(--vert)' : 'var(--pierre)' }}>{fmt(projCA)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gris2)', marginTop: '2px' }}>cadence {fmt(cadenceActuelle)}/j</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--gris)', marginBottom: '3px' }}>Net projeté</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: projNet >= 2000 ? 'var(--vert)' : 'var(--rouge)' }}>{fmt(projNet)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gris2)', marginTop: '2px' }}>après charges + IRPF</div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ── LEVIER PANIER MOYEN ──────────────────── */}
              <div className="card" style={{ borderColor: 'var(--pierre3)' }}>
                <div style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💡 Levier : panier moyen</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { pm: 150, label: 'Actuel' },
                    { pm: 200, label: 'Cible' },
                    { pm: 300, label: 'Idéal' }
                  ].map(({ pm, label }) => {
                    const net = (pm * 25 * 0.75 - chargesFixes) * 0.80
                    return (
                      <div key={pm} style={{ padding: '10px', background: 'var(--noir3)', borderRadius: 'var(--r)', textAlign: 'center', border: Math.abs(panierM - pm) < 30 ? '1px solid var(--pierre)' : 'none' }}>
                        <div style={{ fontSize: '10px', color: 'var(--gris)', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: net >= 2000 ? 'var(--vert)' : 'var(--pierre)' }}>{pm}€</div>
                        <div style={{ fontSize: '10px', color: 'var(--gris2)', marginTop: '3px' }}>{fmt(net)} net</div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {/* ════════ SAISIE MÉTRIQUES ════════ */}
      {tab === 'saisie' && (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '16px', lineHeight: 1.6 }}>
            À saisir chaque lundi matin. Les données s'affichent dans le dashboard.
          </div>

          <div className="form-group">
            <label>Label semaine</label>
            <input placeholder="Ex: Sem 09/06" value={saisie.semaine} onChange={e => setSaisie({...saisie, semaine: e.target.value})} />
          </div>

          <div className="section-title" style={{ marginTop: '8px' }}>📱 Instagram</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Abonnés</label>
              <input type="number" placeholder="0" value={saisie.insta_abonnes} onChange={e => setSaisie({...saisie, insta_abonnes: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>DMs reçus</label>
              <input type="number" placeholder="0" value={saisie.insta_dm} onChange={e => setSaisie({...saisie, insta_dm: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>→ RDV</label>
              <input type="number" placeholder="0" value={saisie.insta_rdv} onChange={e => setSaisie({...saisie, insta_rdv: e.target.value})} />
            </div>
          </div>

          <div className="section-title">🎵 TikTok & Google</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>TikTok vues</label>
              <input type="number" placeholder="0" value={saisie.tiktok_vues} onChange={e => setSaisie({...saisie, tiktok_vues: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Google clics</label>
              <input type="number" placeholder="0" value={saisie.google_clics} onChange={e => setSaisie({...saisie, google_clics: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Avis reçus</label>
              <input type="number" placeholder="0" value={saisie.google_avis} onChange={e => setSaisie({...saisie, google_avis: e.target.value})} />
            </div>
          </div>

          <div className="section-title">👥 Facebook & Autres</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Facebook abonnés</label>
              <input type="number" placeholder="0" value={saisie.facebook_abonnes} onChange={e => setSaisie({...saisie, facebook_abonnes: e.target.value})} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Source principale</label>
              <select value={saisie.source_principale} onChange={e => setSaisie({...saisie, source_principale: e.target.value})}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes / observations</label>
            <textarea rows="2" placeholder="Post qui a bien marché, type de client qui convertit..." value={saisie.notes} onChange={e => setSaisie({...saisie, notes: e.target.value})} style={{ resize: 'none' }} />
          </div>

          <button className="btn btn-primary" onClick={submitSaisie} disabled={saving} style={{ width: '100%', padding: '14px', marginTop: '4px' }}>
            {saving ? 'Enregistrement...' : '✓ Sauvegarder les métriques'}
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
