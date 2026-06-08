import React, { useState, useEffect, useCallback, useRef } from 'react'
import { notion, parsePaiement } from '../lib/notion'

const LOYER_TTC  = 867
const RETA       = 89
const PERSO      = 1500
const CHARGES_FIXES_HIVER = LOYER_TTC + RETA  // 956€ incompressible
const OBJ_JOUR = 123   // CA × 0.60 = 1500 → 2500€/mois = 100€/j
const PROV_HIVER = 5285  // réserve nécessaire pour passer l'hiver
const PROV_MOIS  = 1057  // à mettre de côté juin→oct

// Juin → Décembre 2026
const MONTHS  = ['Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const MKEYS   = ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12']
const TARGETS = [7500, 7500, 7500, 7500, 7500, 3000, 0]
const IS_ETE  = [1,1,1,1,1,0,0]

const thisMonth = () => new Date().toISOString().substring(0,7)
const todayStr  = () => new Date().toISOString().split('T')[0]
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
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
      <span style={{ fontSize:'12px', color:'var(--gris)', paddingLeft: indent?'12px':0 }}>{label}</span>
      <div style={{ textAlign:'right' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color }}>{value}</span>
        {sub && <div style={{ fontSize:'10px', color:'var(--gris2)' }}>{sub}</div>}
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
    setLoading(true)
    try {
      const [s, d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // ── CA par mois (Jun→Déc 2026) ─────────────────
  const caByMonth = {}
  sessions.forEach(s => {
    const d = s.properties.Date?.date?.start
    if (d) { const mk = d.substring(0,7); caByMonth[mk] = (caByMonth[mk]||0) + (s.properties.Prix?.number||0) }
  })
  const actuals = MKEYS.map(k => Math.round(caByMonth[k]||0))

  // Mois courant dans Jun→Déc
  const nowKey     = thisMonth()
  const currentIdx = MKEYS.indexOf(nowKey)

  // Réserve accumulée mois par mois
  let resAcc = 0
  const resLine = actuals.map((ca, i) => {
    const net     = ca * 0.75 * 0.80
    const surplus = net - PERSO
    if (IS_ETE[i] && surplus > 0) resAcc = Math.min(PROV_HIVER, resAcc + Math.min(surplus, PROV_MOIS))
    else if (!IS_ETE[i] && surplus < 0) resAcc = Math.max(0, resAcc + surplus - CHARGES_FIXES_HIVER)
    return Math.round(resAcc)
  })

  // Stats mois courant
  const m      = thisMonth()
  const today  = todayStr()
  const sessM  = sessions.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const caMois = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbMois = sessM.length
  const panierM = nbMois>0 ? Math.round(caMois/nbMois) : 0
  const sessJ  = sessions.filter(s=>s.properties.Date?.date?.start===today)
  const caJour = sessJ.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbJour = sessJ.length
  const last7  = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-i); return d.toISOString().split('T')[0] })
  const s7     = sessions.filter(s=>last7.includes(s.properties.Date?.date?.start))
  const pm7    = s7.length>0 ? Math.round(s7.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)/s7.length) : 0

  // P&L avec modèle simplifié : charges = 25% CA (tout compris)
  // Modèle réel : fixes 956€ + variables 8% CA
  const chargesM  = Math.round(956 + caMois * 0.08)
  const ben       = caMois - chargesM
  const netMois   = Math.max(0, Math.round(ben * 0.80))
  const irpf      = Math.max(0, Math.round(ben * 0.20))
  const ivaNette  = Math.max(0, Math.round(caMois * 0.21 * 0.25))  // net ~5% du CA
  const depMois   = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)
  const caCash    = sessM.filter(s=>parsePaiement(s)==='cash').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caCarte   = sessM.filter(s=>parsePaiement(s)==='carte').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const surplus   = netMois - PERSO
  const month     = new Date().getMonth() + 1
  const isEte     = month >= 6 && month <= 10
  const resActuelle = currentIdx >= 0 ? resLine[currentIdx] : 0
  const pctEq     = Math.min(100, Math.round((caMois / (OBJ_JOUR * 25)) * 100))

  // Restant 2026 : sum targets mois futurs
  const caRestantCible = MKEYS.reduce((a, k, i) => {
    const parsed = new Date(k + '-01')
    const now = new Date()
    return parsed > now ? a + TARGETS[i] : a
  }, 0)
  const caFaitEnCoursAnne = actuals.reduce((a,v)=>a+v, 0)

  // ── CHART ─────────────────────────────────────
  useEffect(() => {
    if (loading || !chartRef.current) return
    const build = () => {
      if (chartInst.current) chartInst.current.destroy()
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const gc = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tc = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.45)'

      chartInst.current = new window.Chart(chartRef.current, {
        data: {
          labels: MONTHS,
          datasets: [
            {
              type: 'bar', label: 'CA réel',
              data: actuals,
              backgroundColor: actuals.map((v,i) => {
                if (i > currentIdx && currentIdx >= 0) return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
                return v >= TARGETS[i]*0.9 ? '#1D9E75' : v > 0 ? '#C4A882' : '#2A2A2A'
              }),
              borderRadius: 3, order: 2
            },
            {
              type: 'line', label: 'Objectif mensuel',
              data: TARGETS,
              borderColor: 'rgba(196,168,130,0.4)', borderWidth: 1.5,
              borderDash: [4,3], pointRadius: 0, fill: false, order: 1
            },
            {
              type: 'line', label: 'Réserve hiver',
              data: resLine,
              borderColor: '#BA7517', borderWidth: 2,
              pointRadius: resLine.map((_,i) => i===currentIdx ? 5 : 0),
              pointBackgroundColor: '#BA7517',
              fill: false, yAxisID: 'y2', order: 0
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}€` } } },
          scales: {
            x: { ticks: { color: tc, font: { size: 11 }, autoSkip: false }, grid: { color: gc } },
            y: { ticks: { color: tc, font: { size: 10 }, callback: v => v>=1000?(v/1000).toFixed(0)+'k':v }, grid: { color: gc } },
            y2: { position: 'right', min: 0, max: PROV_HIVER + 300, ticks: { color: '#BA7517', font: { size: 9 }, callback: v => v>=1000?(v/1000).toFixed(1)+'k':v }, grid: { display: false } }
          }
        }
      })
    }
    if (!window.Chart) {
      const sc = document.createElement('script')
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      sc.onload = build
      document.head.appendChild(sc)
    } else build()
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [loading, sessions])

  return (
    <div style={{ padding:'20px 16px 8px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'18px' }}>
        <div>
          <div style={{ fontFamily:'var(--font-head)', fontSize:'22px', fontWeight:800, letterSpacing:'3px', color:'var(--pierre)' }}>BLACKTHORN</div>
          <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>
            {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
        </div>
        <button onClick={load} style={{ background:'none', border:'none', color:'var(--gris)', fontSize:'18px', cursor:'pointer', padding:'4px' }}>↻</button>
      </div>

      {/* ── PANIER MOYEN ─────────────────────────── */}
      <div className="card" style={{ marginBottom:'14px' }}>
        <div style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>Panier moyen — CA ÷ sessions</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', textAlign:'center', marginBottom:'10px' }}>
          {[
            { label:'Auj.', pm: nbJour>0?Math.round(caJour/nbJour):0, n:nbJour },
            { label:'7 jours', pm:pm7, n:s7.length },
            { label:'Mois', pm:panierM, n:nbMois },
          ].map(({ label, pm, n }) => (
            <div key={label} style={{ padding:'8px 4px', background:'var(--noir3)', borderRadius:'var(--r)' }}>
              <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', marginBottom:'3px' }}>{label}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', color: pm>=300?'var(--vert)':pm>=100?'var(--pierre)':n===0?'var(--gris2)':'var(--rouge)' }}>
                {n===0 ? '—' : pm+'€'}
              </div>
              <div style={{ fontSize:'9px', color:'var(--gris2)', marginTop:'2px' }}>{n>0?`${n}s`:'—'}</div>
            </div>
          ))}
        </div>
        <Bar pct={(panierM/300)*100} color={panierM>=300?'var(--vert)':panierM>=100?'var(--pierre)':'var(--rouge)'} height={5} />
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'9px', color:'var(--gris2)' }}>
          <span>0</span><span>100€ équil.</span><span>300€ été</span>
        </div>
      </div>

      {/* ── GRAPHIQUE JUIN → DÉCEMBRE 2026 ───────── */}
      <div className="card" style={{ marginBottom:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px' }}>Avancement Juin → Décembre 2026</div>
          <div style={{ display:'flex', gap:'8px' }}>
            {[{c:'#1D9E75',l:'CA'},{c:'rgba(196,168,130,0.5)',l:'Cible',d:true},{c:'#BA7517',l:'Réserve'}].map(l=>(
              <span key={l.l} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'9px', color:'var(--gris)' }}>
                <span style={{ width:l.d?14:10, height:l.d?2:8, background:l.c, borderRadius:1, display:'inline-block' }}/>
                {l.l}
              </span>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gris)', fontSize:'12px' }}>Chargement...</div>
        ) : (
          <div style={{ position:'relative', height:180 }}>
            <canvas ref={chartRef} role="img" aria-label="CA mensuel juin à décembre 2026" />
          </div>
        )}
        {/* Réserve hiver */}
        <div style={{ marginTop:'12px', paddingTop:'10px', borderTop:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
            <span style={{ fontSize:'11px', color:'var(--gris)' }}>Réserve hiver</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'#BA7517' }}>
              {resActuelle}€ / {PROV_HIVER}€
            </span>
          </div>
          <Bar pct={(resActuelle/PROV_HIVER)*100} color={resActuelle>=PROV_HIVER?'var(--vert)':'#BA7517'} height={7} />
          <div style={{ fontSize:'10px', color:'var(--gris2)', marginTop:'3px' }}>
            {isEte
              ? `→ Mettre ${PROV_MOIS}€/mois de côté · encore ${Math.max(0,PROV_HIVER-resActuelle)}€ à accumuler`
              : 'Hors saison — la réserve couvre les mois creux'
            }
          </div>
        </div>
      </div>

      {/* ── CASH vs CARTE ──────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
        <div className="stat-card" style={{ borderColor:'rgba(39,174,96,.3)' }}>
          <div className="label" style={{ color:'#2ecc71' }}>💵 Cash</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', color:'#2ecc71' }}>{fmt(caCash)}</div>
          <div className="sub">{nbMois>0?Math.round(caCash/caMois*100):0}% du CA</div>
        </div>
        <div className="stat-card" style={{ borderColor:'rgba(41,128,185,.3)' }}>
          <div className="label" style={{ color:'#5dade2' }}>💳 Carte</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', color:'#5dade2' }}>{fmt(caCarte)}</div>
          <div className="sub">{nbMois>0?Math.round(caCarte/caMois*100):0}% du CA</div>
        </div>
      </div>

      {/* ── FINANCES MOIS ─────────────────────────── */}
      <div className="section-title">Finances du mois</div>
      <div className="card" style={{ marginBottom:'14px' }}>
        <div style={{ fontSize:'10px', color:'var(--vert)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'4px 0 2px' }}>ENTRÉES</div>
        <Row label="CA total HT" value={fmt(caMois)} color="var(--vert)" />
        <Row label="↳ Cash" value={fmt(caCash)} color="#2ecc71" indent />
        <Row label="↳ Carte" value={fmt(caCarte)} color="#5dade2" indent />

        <div style={{ fontSize:'10px', color:'var(--rouge)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'8px 0 2px' }}>SORTIES</div>
        <Row label="Loyer TTC + RETA" value="-956€" color="var(--gris)" sub="fixe — dû quoi qu'il arrive" />
        <Row label="Matériel ~8%" value={`-${fmt(Math.round(caMois*0.08))}`} color="var(--gris)" />
        {depMois>0 && <Row label="Dépenses saisies" value={`-${fmt(depMois)}`} color="var(--gris)" />}

        <div style={{ fontSize:'10px', color:'var(--pierre3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', padding:'8px 0 2px' }}>RÉSULTAT</div>
        <Row label="Bénéfice brut" value={fmt(Math.round(caMois*0.75))} color="var(--pierre)" />
        <Row label="IRPF à réserver (20%)" value={`-${fmt(irpf)}`} color="var(--jaune)" sub="→ compte provision" />
        <Row label="Net disponible" value={fmt(netMois)} color={netMois>=PERSO?'var(--vert)':'var(--rouge)'} />
        <Row label="Charges ménage" value="-1 500€" />
        <div style={{ padding:'10px', marginTop:'6px', background: surplus>0?'var(--epine)':'rgba(192,57,43,.12)', borderRadius:'var(--r)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'12px', fontWeight:600 }}>Dispo libre</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'17px', color:surplus>0?'var(--vert)':'var(--rouge)', fontWeight:700 }}>
            {surplus>=0?'+':''}{fmt(surplus)}
          </span>
        </div>
      </div>

      {/* ── PROVISIONS ────────────────────────────── */}
      <div className="section-title">À mettre de côté</div>
      <div className="card" style={{ marginBottom:'14px' }}>
        {[
          { l:'IRPF (20% bénéfice)', v:irpf },
          { l:'IVA nette estimée', v:ivaNette },
          { l:isEte?'Réserve hiver (juin→oct)':'Réserve hiver', v:isEte?PROV_MOIS:0 },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.v>0?'var(--jaune)':'var(--gris2)' }}>{r.v>0?fmt(r.v):'—'}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', fontWeight:600 }}>
          <span style={{ fontSize:'12px' }}>Total provisions</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--rouge)' }}>{fmt(irpf+ivaNette+(isEte?PROV_MOIS:0))}</span>
        </div>
      </div>

      {/* ── CHARGES FIXES RAPPEL ─────────────────── */}
      <div className="section-title">Charges fixes incompressibles</div>
      <div className="card">
        {[
          { l:'Loyer studio TTC', v:`${LOYER_TTC}€` },
          { l:'RETA Tony', v:`${RETA}€` },
          { l:'Charges ménage', v:`${PERSO}€` },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--pierre)' }}>{r.v}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 0', fontWeight:600 }}>
          <span style={{ fontSize:'12px' }}>Total / mois</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--rouge)' }}>{LOYER_TTC+RETA+PERSO}€</span>
        </div>
        <div style={{ fontSize:'11px', color:'var(--gris2)', marginTop:'6px', lineHeight:1.5 }}>
          Équilibre mensuel : <strong style={{ color:'var(--pierre)' }}>123€/j × 25j</strong><br/>
          Tenir l'hiver : <strong style={{ color:'var(--pierre)' }}>181€/j en été</strong>
        </div>
      </div>
    </div>
  )
}
