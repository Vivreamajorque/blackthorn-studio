import React, { useState, useEffect, useCallback, useRef } from 'react'
import { notion } from '../lib/notion'

const LOYER_TTC  = 867
const LOYER_HT   = 716.53
const RETA       = 89
const PERSO      = 1500
const OBJ_JOUR   = 143
const PROV_HIVER = 5285
const PROV_MOIS  = 1057

// Saisons — targets mensuels HT (Jun→Mai)
const MONTHS     = ['Jun','Jul','Aoû','Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr','Mai']
const TARGETS    = [7500, 7500, 7500, 7500, 7500, 3000, 0, 0, 650, 1560, 3600, 4000]
const IS_ETE     = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]

const thisMonth  = () => new Date().toISOString().substring(0, 7)
const todayStr   = () => new Date().toISOString().split('T')[0]

const fmt = (n) => {
  const abs = Math.abs(Math.round(n))
  return (n < 0 ? '-' : '') + (abs >= 1000 ? (abs/1000).toFixed(1) + 'k€' : abs + '€')
}

function Bar({ pct, color = 'var(--pierre)', height = 6 }) {
  return (
    <div style={{ height, background: 'var(--noir3)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: Math.min(100, Math.max(0, pct)) + '%', background: color, borderRadius: 3, transition: 'width .5s ease' }} />
    </div>
  )
}

function Row({ label, value, color = 'var(--blanc)', indent = false, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
      <span style={{ fontSize: '12px', color: 'var(--gris)', paddingLeft: indent ? '12px' : 0 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color }}>{value}</span>
        {sub && <div style={{ fontSize: '10px', color: 'var(--gris2)' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const chartRef  = useRef(null)
  const chartInst = useRef(null)

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── CA par mois depuis Notion ──────────────────
  const caByMonth = {}
  sessions.forEach(s => {
    const d = s.properties.Date?.date?.start
    if (d) {
      const mk = d.substring(0, 7)
      caByMonth[mk] = (caByMonth[mk] || 0) + (s.properties.Prix?.number || 0)
    }
  })

  // Mapper sur l'ordre Jun→Mai 2026/2027
  const year = 2026
  const monthKeys = [
    `${year}-06`, `${year}-07`, `${year}-08`, `${year}-09`, `${year}-10`,
    `${year}-11`, `${year}-12`, `${year+1}-01`, `${year+1}-02`, `${year+1}-03`,
    `${year+1}-04`, `${year+1}-05`
  ]
  const actuals = monthKeys.map(k => Math.round(caByMonth[k] || 0))

  // Mois courant (index dans Jun→Mai)
  const nowKey = thisMonth()
  const currentIdx = monthKeys.indexOf(nowKey)

  // Réserve accumulée (simulée)
  let reserveAcc = 0
  const reserveLine = []
  const targetLine  = []
  let cumTarget = 0
  actuals.forEach((ca, i) => {
    const surplus = Math.max(0, (ca * 0.75 - LOYER_HT - RETA) * 0.80) - PERSO
    if (IS_ETE[i] && surplus > 0) reserveAcc = Math.min(PROV_HIVER, reserveAcc + Math.min(surplus, PROV_MOIS))
    else if (!IS_ETE[i] && i >= 5) reserveAcc = Math.max(0, reserveAcc - Math.max(0, PERSO - Math.max(0, (ca * 0.75 - LOYER_HT - RETA) * 0.80)))
    reserveLine.push(Math.round(reserveAcc))
    cumTarget += TARGETS[i]
    targetLine.push(cumTarget)
  })

  // Stats mois courant
  const m         = thisMonth()
  const today     = todayStr()
  const sessM     = sessions.filter(s => (s.properties.Date?.date?.start||'').startsWith(m))
  const caMois    = sessM.reduce((a,s) => a + (s.properties.Prix?.number||0), 0)
  const nbMois    = sessM.length
  const panierM   = nbMois > 0 ? Math.round(caMois/nbMois) : 0
  const sessJ     = sessions.filter(s => s.properties.Date?.date?.start === today)
  const caJour    = sessJ.reduce((a,s) => a + (s.properties.Prix?.number||0), 0)
  const nbJour    = sessJ.length
  const last7     = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return d.toISOString().split('T')[0] })
  const s7        = sessions.filter(s=>last7.includes(s.properties.Date?.date?.start))
  const pm7       = s7.length > 0 ? Math.round(s7.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)/s7.length) : 0

  const matos     = Math.round(caMois * 0.25)
  const ben       = caMois * 0.75 - LOYER_HT - RETA
  const netMois   = Math.max(0, Math.round(ben * 0.80))
  const irpf      = Math.max(0, Math.round(ben * 0.20))
  const ivaNette  = Math.max(0, Math.round(caMois * 0.21 - LOYER_HT * 0.21 - matos * 0.21))
  const depMois   = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)
  const month     = new Date().getMonth() + 1
  const isEte     = month >= 6 && month <= 10
  const surplus   = netMois - PERSO

  // Réserve actuelle (dernier mois connu)
  const reserveActuelle = currentIdx >= 0 ? reserveLine[currentIdx] : 0
  const pctReserve = Math.round((reserveActuelle / PROV_HIVER) * 100)

  // Chart
  useEffect(() => {
    if (loading || !chartRef.current || typeof window === 'undefined') return
    const loadChart = async () => {
      if (!window.Chart) {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
        script.onload = () => buildChart()
        document.head.appendChild(script)
      } else {
        buildChart()
      }
    }

    const buildChart = () => {
      if (chartInst.current) chartInst.current.destroy()
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const gridC  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const textC  = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.45)'

      chartInst.current = new window.Chart(chartRef.current, {
        data: {
          labels: MONTHS,
          datasets: [
            {
              type: 'bar',
              label: 'CA réel',
              data: actuals,
              backgroundColor: actuals.map((v,i) => {
                if (i > currentIdx && currentIdx >= 0) return 'rgba(255,255,255,0.06)'
                return v >= TARGETS[i] * 0.9 ? '#1D9E75' : v > 0 ? '#C4A882' : '#2A2A2A'
              }),
              borderRadius: 3,
              order: 2
            },
            {
              type: 'line',
              label: 'Objectif',
              data: TARGETS,
              borderColor: 'rgba(196,168,130,0.35)',
              borderWidth: 1.5,
              borderDash: [4, 3],
              pointRadius: 0,
              fill: false,
              order: 1
            },
            {
              type: 'line',
              label: 'Réserve hiver',
              data: reserveLine,
              borderColor: '#BA7517',
              borderWidth: 2,
              pointRadius: reserveLine.map((_,i) => i === currentIdx ? 4 : 0),
              pointBackgroundColor: '#BA7517',
              fill: false,
              yAxisID: 'y2',
              order: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}€`
              }
            }
          },
          scales: {
            x: { ticks: { color: textC, font: { size: 10 }, autoSkip: false }, grid: { color: gridC } },
            y: {
              ticks: { color: textC, font: { size: 10 }, callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v },
              grid: { color: gridC }
            },
            y2: {
              position: 'right',
              min: 0, max: PROV_HIVER + 500,
              ticks: { color: '#BA7517', font: { size: 9 }, callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v },
              grid: { display: false }
            }
          }
        }
      })
    }
    loadChart()
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [loading, sessions])

  return (
    <div style={{ padding: '20px 16px 8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, letterSpacing: '3px', color: 'var(--pierre)' }}>BLACKTHORN</div>
          <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>
        <button onClick={load} style={{ background:'none', border:'none', color:'var(--gris)', fontSize:'18px', cursor:'pointer', padding:'4px' }}>↻</button>
      </div>

      {/* ── PANIER MOYEN ─────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Panier moyen — CA ÷ sessions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
          {[
            { label: "Auj.", pm: caJour > 0 ? Math.round(caJour/Math.max(1,nbJour)) : 0, n: nbJour },
            { label: '7 jours', pm: pm7, n: s7.length },
            { label: 'Mois', pm: panierM, n: nbMois },
          ].map(({ label, pm, n }) => (
            <div key={label} style={{ padding: '8px 4px', background: 'var(--noir3)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '9px', color: 'var(--gris)', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: pm >= 300 ? 'var(--vert)' : pm >= 143 ? 'var(--pierre)' : n===0 ? 'var(--gris2)' : 'var(--rouge)' }}>
                {n === 0 ? '—' : pm + '€'}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--gris2)', marginTop: '2px' }}>{n > 0 ? `${n}s` : '—'}</div>
            </div>
          ))}
        </div>
        <Bar pct={(panierM/300)*100} color={panierM>=300?'var(--vert)':panierM>=143?'var(--pierre)':'var(--rouge)'} height={5} />
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'9px', color:'var(--gris2)' }}>
          <span>0</span><span>143€ équil.</span><span>300€ été</span>
        </div>
      </div>

      {/* ── GRAPHIQUE AVANCEMENT ANNUEL ───────────── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avancement annuel</div>
          <div style={{ display:'flex', gap:'10px' }}>
            {[
              { color:'#1D9E75', label:'CA réel' },
              { color:'rgba(196,168,130,0.5)', label:'Objectif', dash:true },
              { color:'#BA7517', label:'Réserve' },
            ].map(l => (
              <span key={l.label} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'9px', color:'var(--gris)' }}>
                <span style={{ width:10, height:l.dash?2:8, background:l.color, borderRadius:1, display:'inline-block' }}/>
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gris)', fontSize:'12px' }}>Chargement...</div>
        ) : (
          <div style={{ position:'relative', height:180 }}>
            <canvas ref={chartRef} role="img" aria-label="Avancement CA annuel par mois de juin à mai" />
          </div>
        )}

        {/* Réserve hiver */}
        <div style={{ marginTop:'12px', paddingTop:'10px', borderTop:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
            <span style={{ fontSize:'11px', color:'var(--gris)' }}>Réserve hiver constituée</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'#BA7517' }}>{reserveActuelle}€ / {PROV_HIVER}€</span>
          </div>
          <Bar pct={pctReserve} color={pctReserve>=100?'var(--vert)':'#BA7517'} height={7} />
          <div style={{ fontSize:'10px', color:'var(--gris2)', marginTop:'4px' }}>
            {isEte ? `→ Mettre ${PROV_MOIS}€/mois de côté (encore ${Math.max(0,PROV_HIVER-reserveActuelle)}€ à accumuler)` : 'Décompte hiver en cours'}
          </div>
        </div>
      </div>

      {/* ── FINANCES MOIS ─────────────────────────── */}
      <div className="section-title">Finances du mois</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ fontSize:'10px', color:'var(--vert)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'4px 0 2px' }}>ENTRÉES</div>
        <Row label="CA encaissé HT" value={fmt(caMois)} color="var(--vert)" />

        <div style={{ fontSize:'10px', color:'var(--rouge)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'8px 0 2px' }}>SORTIES</div>
        <Row label="Loyer HT" value="-717€" />
        <Row label="RETA" value="-89€" />
        <Row label="Matériel 25%" value={`-${fmt(matos)}`} />
        {depMois > 0 && <Row label="Dépenses saisies" value={`-${fmt(depMois)}`} />}

        <div style={{ fontSize:'10px', color:'var(--pierre3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'8px 0 2px' }}>RÉSULTAT</div>
        <Row label="Net disponible" value={fmt(netMois)} color={netMois>=PERSO?'var(--vert)':'var(--rouge)'} />
        <Row label="Charges ménage" value="-1 500€" />
        <div style={{ padding:'10px', marginTop:'6px', background: surplus>0 ? 'var(--epine)' : 'rgba(192,57,43,.12)', borderRadius:'var(--r)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'12px', fontWeight:600 }}>Dispo libre</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'17px', color: surplus>0 ? 'var(--vert)' : 'var(--rouge)', fontWeight:700 }}>
            {surplus>=0?'+':''}{fmt(surplus)}
          </span>
        </div>
      </div>

      {/* ── PROVISIONS ────────────────────────────── */}
      <div className="section-title">À mettre de côté</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        {[
          { l: 'IRPF (20% bénéfice)', v: irpf },
          { l: 'IVA nette', v: ivaNette },
          { l: isEte ? 'Réserve hiver (été)' : 'Réserve hiver (hors saison)', v: isEte ? PROV_MOIS : 0 },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color: r.v>0?'var(--jaune)':'var(--gris2)' }}>{r.v>0?fmt(r.v):'—'}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', fontWeight:600 }}>
          <span style={{ fontSize:'12px' }}>Total provisions</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--rouge)' }}>{fmt(irpf + ivaNette + (isEte?PROV_MOIS:0))}</span>
        </div>
      </div>

    </div>
  )
}
