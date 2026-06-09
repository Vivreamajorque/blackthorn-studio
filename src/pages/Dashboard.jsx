import React, { useState, useEffect, useCallback, useRef } from 'react'
import { notion, parsePaiement } from '../lib/notion'

// ── CONSTANTES ──────────────────────────────────────────
const LOYER_TTC  = 867
const FIXES      = 956      // loyer 867 + RETA 89
const MATOS_PCT  = 0.08
const IVA_FL     = 150.47   // IVA loyer récupérable fixe/mois
const PERSO      = 1500
const PROV_HIVER = 5285
const PROV_MOIS  = 1057

// Formule nette réelle (IRPF 20% + IVA nette)
const netReel = (ca) => {
  const matos  = ca * MATOS_PCT
  const ben    = ca - FIXES - matos
  const irpf   = Math.max(0, ben * 0.20)
  const iva    = Math.max(0, ca * 0.21 - IVA_FL - matos * 0.21)
  return {
    net  : Math.max(0, Math.round(ben - irpf - iva)),
    irpf : Math.round(irpf),
    iva  : Math.round(iva),
    ben  : Math.round(ben)
  }
}


// ── PROFIL ANNUEL (Jun 2026 → Mai 2027) ──────────────
// CA cible à 234€/j (tenir l'hiver IRPF+IVA inclus)
const ANNUAL_CA_TARGET = 47208  // sum JOURS × PM_cible
const JOURS_TRAVAIL_ANNUEL = 192
// CA cumulé cible par mois (cumsum des targets)
const CUMUL_TARGETS = [5850,11700,17550,23400,28548,31548,31548,31548,32198,33758,37358,41358]

// Juin 2026 → Mai 2027
const MONTHS  = ['Jun','Jul','Aoû','Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr','Mai']
const MKEYS   = ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']
const JOURS   = [25,25,25,25,22,15,0,0,5,12,18,20]
const IS_ETE  = [1,1,1,1,1,0,0,0,0,0,0,0]
const PM_BASE = [0,0,0,0,0,200,0,0,130,130,200,200]
const TARGETS = PM_BASE.map((pm,i) => pm * JOURS[i])

const thisMonth = () => new Date().toISOString().substring(0,7)
const todayStr  = () => new Date().toISOString().split('T')[0]
const fmt  = (n) => { const a = Math.abs(Math.round(n)); return (n<0?'-':'') + (a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }
const fmts = (n) => (n>=0?'+':'')+fmt(n)

function Bar({ pct, color='var(--pierre)', h=6 }) {
  return (
    <div style={{height:h,background:'var(--noir3)',borderRadius:3,overflow:'hidden'}}>
      <div style={{height:'100%',width:Math.min(100,Math.max(0,pct))+'%',background:color,borderRadius:3,transition:'width .5s'}} />
    </div>
  )
}

function Row({ label, value, color='var(--blanc)', indent, sub, bold }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--noir3)'}}>
      <span style={{fontSize:'12px',color:'var(--gris)',paddingLeft:indent?'12px':0}}>{label}</span>
      <div style={{textAlign:'right'}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:bold?'14px':'13px',color,fontWeight:bold?700:400}}>{value}</span>
        {sub && <div style={{fontSize:'10px',color:'var(--gris2)'}}>{sub}</div>}
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
      const [s,d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // ── CA par mois (12 mois) ──────────────────────
  const caByMonth = {}
  sessions.forEach(s => {
    const d = s.properties.Date?.date?.start
    if (d) { const mk=d.substring(0,7); caByMonth[mk]=(caByMonth[mk]||0)+(s.properties.Prix?.number||0) }
  })
  const actuals = MKEYS.map(k => Math.round(caByMonth[k]||0))
  const nowKey  = thisMonth()
  const curIdx  = MKEYS.indexOf(nowKey)

  // Réserve mois par mois
  let resAcc = 0
  const resLine = actuals.map((ca,i) => {
    const r = netReel(ca)
    const dispo = r.net - PERSO
    if (IS_ETE[i] && dispo > 0) resAcc = Math.min(PROV_HIVER, resAcc + Math.min(dispo, PROV_MOIS))
    else if (!IS_ETE[i] && dispo < 0) resAcc = Math.max(0, resAcc + dispo)
    return Math.round(Math.max(0, resAcc))
  })
  const resActuelle = curIdx >= 0 ? resLine[curIdx] : 0

  // ── Stats mois courant ─────────────────────────
  const m     = thisMonth()
  const today = todayStr()
  const sessM = sessions.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const caMois= sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbMois= sessM.length
  const panierM = nbMois>0 ? Math.round(caMois/nbMois) : 0
  const sessJ = sessions.filter(s=>s.properties.Date?.date?.start===today)
  const caJour= sessJ.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbJour= sessJ.length
  const last7 = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().split('T')[0]})
  const s7    = sessions.filter(s=>last7.includes(s.properties.Date?.date?.start))
  const pm7   = s7.length>0 ? Math.round(s7.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)/s7.length) : 0
  const depM  = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)
  const caCash  = sessM.filter(s=>parsePaiement(s)==='cash').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caCarte = sessM.filter(s=>parsePaiement(s)==='carte').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  // Calculs financiers mois courant
  const r      = netReel(caMois)
  const surplus= r.net - PERSO
  const month  = new Date().getMonth() + 1
  const isEte  = month >= 6 && month <= 10
  const pctEq  = Math.min(100, Math.round((caMois / 3895) * 100))


  // ── AVANCEMENT ANNUEL ──────────────────────────────
  const caAnnuelCumul = actuals.reduce((a,v)=>a+v,0)
  // CA cumulé cible jusqu'au mois courant
  const caCibleAujourdhui = curIdx >= 0 ? CUMUL_TARGETS[curIdx] : 0
  // Jours travaillés écoulés (estimation : jour du mois × jours mois courant / jours dans le mois)
  const jourDuMois = new Date().getDate()
  const joursEcoules = MKEYS.slice(0, Math.max(0,curIdx)).reduce((a,_,i)=>a+JOURS[i],0) + Math.round(jourDuMois/30 * (JOURS[curIdx]||0))
  const joursRestants = JOURS_TRAVAIL_ANNUEL - joursEcoules
  const caRestant = Math.max(0, ANNUAL_CA_TARGET - caAnnuelCumul)
  const vitesseActuelle = joursEcoules > 0 ? Math.round(caAnnuelCumul / joursEcoules) : 0
  const vitesseNecessaire = joursRestants > 0 ? Math.round(caRestant / joursRestants) : 0
  const avancePctAnnuel = Math.round((caAnnuelCumul / ANNUAL_CA_TARGET) * 100)
  const surParcours = caAnnuelCumul >= caCibleAujourdhui

  // ── CHART ──────────────────────────────────────
  useEffect(() => {
    if (loading || !chartRef.current) return
    const build = () => {
      if (chartInst.current) chartInst.current.destroy()
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const gc = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
      const tc = isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.45)'
      const barColors = actuals.map((ca,i) => {
        if (i > curIdx && curIdx >= 0) return isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'
        const nr = netReel(ca)
        if (nr.net >= PERSO) return '#1D9E75'
        if (resLine[i] > 0) return '#BA7517'
        return '#E24B4A'
      })
      chartInst.current = new window.Chart(chartRef.current, {
        data: {
          labels: MONTHS,
          datasets: [
            { type:'bar', label:'CA réel', data:actuals, backgroundColor:barColors, borderRadius:3, order:2 },
            { type:'line', label:'Équilibre (156€/j)', data:new Array(12).fill(3895),
              borderColor:'#E24B4A', borderWidth:1.5, borderDash:[4,3], pointRadius:0, fill:false, order:1 }
          ]
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false},
            tooltip:{ callbacks:{ label:ctx => {
              if (ctx.datasetIndex===1) return 'Équilibre: 3 895€'
              const i = ctx.dataIndex
              const nr = netReel(actuals[i])
              return [`CA: ${Math.round(ctx.parsed.y).toLocaleString()}€`,
                      `IRPF: -${nr.irpf}€`, `IVA: -${nr.iva}€`,
                      `Net: ${nr.net}€`, `Dispo: ${nr.net>=PERSO?'+':''}${nr.net-PERSO}€`]
            }}}},
          scales:{
            x:{ticks:{color:tc,font:{size:10},autoSkip:false,maxRotation:0},grid:{color:gc}},
            y:{ticks:{color:tc,font:{size:10},callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v},grid:{color:gc}}
          }
        }
      })
    }
    if (!window.Chart) {
      const sc=document.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
      sc.onload=build; document.head.appendChild(sc)
    } else build()
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current=null } }
  }, [loading, sessions])

  return (
    <div style={{padding:'20px 16px 8px'}}>

      {/* ── HEADER ──────────────────────────────── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'18px'}}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <img src="/blackthorn-logo.png" alt="Blackthorn" style={{ height:'44px', filter:'invert(1) sepia(1) saturate(0.3) brightness(0.85)', opacity:0.85 }} />
          <div style={{fontSize:'11px',color:'var(--gris)'}}>
            {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
        </div>
        <button onClick={load} style={{background:'none',border:'none',color:'var(--gris)',fontSize:'18px',cursor:'pointer',padding:'4px'}}>↻</button>
      </div>

      {/* ── PANIER MOYEN ─────────────────────────── */}
      <div className="card" style={{marginBottom:'14px'}}>
        <div style={{fontSize:'11px',color:'var(--gris)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Panier moyen — CA ÷ sessions</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'10px'}}>
          {[{l:"Auj.",pm:nbJour>0?Math.round(caJour/nbJour):0,n:nbJour},{l:'7j',pm:pm7,n:s7.length},{l:'Mois',pm:panierM,n:nbMois}].map(({l,pm,n})=>(
            <div key={l} style={{padding:'8px 4px',background:'var(--noir3)',borderRadius:'var(--r)',textAlign:'center'}}>
              <div style={{fontSize:'9px',color:'var(--gris)',textTransform:'uppercase',marginBottom:'3px'}}>{l}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:pm>=300?'var(--vert)':pm>=156?'var(--pierre)':n===0?'var(--gris2)':'var(--rouge)'}}>
                {n===0?'—':pm+'€'}
              </div>
              <div style={{fontSize:'9px',color:'var(--gris2)',marginTop:'2px'}}>{n>0?`${n}s`:'—'}</div>
            </div>
          ))}
        </div>
        <Bar pct={(panierM/300)*100} color={panierM>=300?'var(--vert)':panierM>=156?'var(--pierre)':'var(--rouge)'} h={5} />
        <div style={{display:'flex',justifyContent:'space-between',marginTop:'3px',fontSize:'9px',color:'var(--gris2)'}}>
          <span>0</span><span>156€ équil.</span><span>234€ hiver</span><span>300€ été</span>
        </div>
      </div>

      {/* ── GRAPHIQUE 12 MOIS ────────────────────── */}
      <div className="card" style={{marginBottom:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:'var(--gris)',textTransform:'uppercase',letterSpacing:'1px'}}>Juin 2026 → Mai 2027</div>
          <div style={{display:'flex',gap:'8px'}}>
            {[{c:'#1D9E75',l:'≥ équil.'},{c:'#BA7517',l:'réserve'},{c:'#E24B4A',l:'déficit'}].map(x=>(
              <span key={x.l} style={{display:'flex',alignItems:'center',gap:'3px',fontSize:'9px',color:'var(--gris)'}}>
                <span style={{width:8,height:8,borderRadius:1,background:x.c,display:'inline-block'}}/>{x.l}
              </span>
            ))}
          </div>
        </div>
        {loading
          ? <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gris)',fontSize:'12px'}}>Chargement...</div>
          : <div style={{position:'relative',height:200}}><canvas ref={chartRef} role="img" aria-label="CA mensuel juin 2026 à mai 2027"/></div>
        }
        {/* Réserve hiver */}
        <div style={{marginTop:'12px',paddingTop:'10px',borderTop:'1px solid var(--noir3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
            <span style={{fontSize:'11px',color:'var(--gris)'}}>Réserve hiver</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'#BA7517'}}>{resActuelle.toLocaleString()}€ / {PROV_HIVER.toLocaleString()}€</span>
          </div>
          <Bar pct={(resActuelle/PROV_HIVER)*100} color={resActuelle>=PROV_HIVER?'var(--vert)':'#BA7517'} h={7} />
          <div style={{fontSize:'10px',color:'var(--gris2)',marginTop:'3px'}}>
            {isEte?`Mettre ${PROV_MOIS}€/mois de côté · encore ${Math.max(0,PROV_HIVER-resActuelle)}€ à accumuler`:'Compte réserve — décompte hiver'}
          </div>
        </div>
      </div>

      {/* ── OBJECTIF ANNUEL JOURNALIER ──────────── */}
      <div className="card" style={{marginBottom:'14px', borderColor: surParcours ? 'var(--epine2)' : 'rgba(192,57,43,.3)'}}>
        <div style={{fontSize:'11px',color:'var(--gris)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>
          Objectif annuel — tenir toute l'année
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'9px',color:'var(--gris)',textTransform:'uppercase',marginBottom:'3px'}}>CA à ce jour</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:surParcours?'var(--vert)':'var(--rouge)'}}>{Math.round(caAnnuelCumul).toLocaleString()}€</div>
            <div style={{fontSize:'10px',color:'var(--gris2)'}}>cible {caCibleAujourdhui.toLocaleString()}€</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'9px',color:'var(--gris)',textTransform:'uppercase',marginBottom:'3px'}}>Vitesse nécessaire</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:vitesseActuelle>=vitesseNecessaire?'var(--vert)':'var(--rouge)'}}>{vitesseNecessaire}€/j</div>
            <div style={{fontSize:'10px',color:'var(--gris2)'}}>actuelle {vitesseActuelle}€/j</div>
          </div>
        </div>
        <div style={{height:'7px',background:'var(--noir3)',borderRadius:'4px',overflow:'hidden',marginBottom:'4px'}}>
          <div style={{height:'100%',width:Math.min(100,avancePctAnnuel)+'%',background:surParcours?'var(--vert)':'var(--rouge)',borderRadius:'4px',transition:'width .5s'}} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'var(--gris2)'}}>
          <span>{avancePctAnnuel}% de l'objectif annuel</span>
          <span>{joursRestants} jours travail restants</span>
        </div>
      </div>

      {/* ── CA MOIS + CASH/CARTE ─────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
        <div className="stat-card">
          <div className="label">CA mois HT</div>
          <div className="value" style={{color:caMois>=3895?'var(--vert)':caMois>0?'var(--pierre)':'var(--gris2)'}}>{loading?'...':fmt(caMois)}</div>
          <Bar pct={pctEq} color={pctEq>=100?'var(--vert)':'var(--pierre)'} />
          <div className="sub">{pctEq}% de l'équilibre (156€/j)</div>
        </div>
        <div className="stat-card">
          <div className="label">Aujourd'hui</div>
          <div className="value" style={{color:caJour>0?'var(--pierre)':'var(--gris2)'}}>{caJour>0?fmt(caJour):'—'}</div>
          <div className="sub">{nbJour>0?`${nbJour} session${nbJour>1?'s':''}  · ${Math.round(caJour/Math.max(1,nbJour))}€ panier`:'Pas encore saisi'}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
        <div className="stat-card" style={{borderColor:'rgba(39,174,96,.3)'}}>
          <div className="label" style={{color:'#2ecc71'}}>💵 Cash</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:'#2ecc71'}}>{fmt(caCash)}</div>
          <div className="sub">{caMois>0?Math.round(caCash/caMois*100):0}%</div>
        </div>
        <div className="stat-card" style={{borderColor:'rgba(41,128,185,.3)'}}>
          <div className="label" style={{color:'#5dade2'}}>💳 Carte</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',color:'#5dade2'}}>{fmt(caCarte)}</div>
          <div className="sub">{caMois>0?Math.round(caCarte/caMois*100):0}%</div>
        </div>
      </div>

      {/* ── FINANCES MOIS ─────────────────────────── */}
      <div className="section-title">Finances du mois — IRPF + IVA inclus</div>
      <div className="card" style={{marginBottom:'14px'}}>
        <div style={{fontSize:'10px',color:'var(--vert)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'4px 0 2px'}}>ENTRÉES</div>
        <Row label="CA total HT" value={fmt(caMois)} color="var(--vert)" />
        <Row label="↳ Cash" value={fmt(caCash)} color="#2ecc71" indent />
        <Row label="↳ Carte" value={fmt(caCarte)} color="#5dade2" indent />

        <div style={{fontSize:'10px',color:'var(--rouge)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'8px 0 2px'}}>SORTIES</div>
        <Row label="Charges (fixes 956€ + matos 8%)" value={`-${fmt(FIXES + Math.round(caMois*MATOS_PCT))}`} />
        {depM>0 && <Row label="Dépenses saisies" value={`-${fmt(depM)}`} />}

        <div style={{fontSize:'10px',color:'var(--pierre3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'8px 0 2px'}}>IMPÔTS</div>
        <Row label="IRPF (20% du bénéfice)" value={`-${fmt(r.irpf)}`} color="var(--jaune)" sub="→ compte provision" />
        <Row label="IVA nette à reverser" value={`-${fmt(r.iva)}`} color="var(--jaune)" sub="→ compte provision" />
        <Row label="Net disponible" value={fmt(r.net)} color={r.net>=PERSO?'var(--vert)':'var(--rouge)'} bold />

        <div style={{fontSize:'10px',color:'var(--gris)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',padding:'8px 0 2px'}}>VIE</div>
        <Row label="Charges ménage" value="-1 500€" />
        {isEte && <Row label="Réserve hiver (à mettre de côté)" value={`-${PROV_MOIS}€`} color="var(--pierre)" />}

        <div style={{padding:'10px',marginTop:'6px',background:surplus>0?'var(--epine)':'rgba(192,57,43,.12)',borderRadius:'var(--r)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',fontWeight:600}}>Dispo libre</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:'17px',color:surplus>0?'var(--vert)':'var(--rouge)',fontWeight:700}}>
            {isEte ? fmts(surplus - PROV_MOIS) : fmts(surplus)}
          </span>
        </div>
      </div>

      {/* ── PROVISIONS ────────────────────────────── */}
      <div className="section-title">À mettre de côté ce mois</div>
      <div className="card" style={{marginBottom:'14px'}}>
        {[
          {l:'IRPF (20% bénéfice)', v:r.irpf},
          {l:'IVA nette', v:r.iva},
          {l:isEte?'Réserve hiver':'Réserve hiver', v:isEte?PROV_MOIS:0},
        ].map(row=>(
          <div key={row.l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--noir3)'}}>
            <span style={{fontSize:'12px',color:'var(--gris)'}}>{row.l}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'13px',color:row.v>0?'var(--jaune)':'var(--gris2)'}}>{row.v>0?fmt(row.v):'—'}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:'8px',fontWeight:600}}>
          <span style={{fontSize:'12px'}}>Total provisions</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:'14px',color:'var(--rouge)'}}>{fmt(r.irpf+r.iva+(isEte?PROV_MOIS:0))}</span>
        </div>
        <div style={{fontSize:'10px',color:'var(--gris2)',marginTop:'6px'}}>
          Seuils : 156€/j équilibre · 234€/j hiver couvert · 300€/j confort
        </div>
      </div>

      {/* ── CHARGES FIXES ─────────────────────────── */}
      <div className="section-title">Charges fixes incompressibles</div>
      <div className="card">
        {[{l:'Loyer TTC',v:`${LOYER_TTC}€`},{l:'RETA Tony',v:'89€'},{l:'Ménage',v:`${PERSO}€`}].map(r=>(
          <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--noir3)'}}>
            <span style={{fontSize:'12px',color:'var(--gris)'}}>{r.l}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--pierre)'}}>{r.v}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0 0',fontWeight:600}}>
          <span style={{fontSize:'12px'}}>Total / mois</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:'14px',color:'var(--rouge)'}}>{LOYER_TTC+89+PERSO}€</span>
        </div>
      </div>

    </div>
  )
}
