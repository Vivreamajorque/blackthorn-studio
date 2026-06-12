import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

// ── MODÈLE FINANCIER ─────────────────────────────────
const FIXES    = 956
const MATOS    = 0.08
const IVA_FL   = 150.47
const OBJ_EQ   = 3895
const OBJ_CONF = 7500
const OBJ_HIV  = 5850

const netReel = (ca) => {
  const m=ca*MATOS, b=ca-FIXES-m
  const irpf=Math.max(0,b*0.20)
  const iva=Math.max(0,ca*0.21-IVA_FL-m*0.21)
  return { net:Math.max(0,Math.round(b-irpf-iva)), irpf:Math.round(irpf), iva:Math.round(iva) }
}

const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => new Date().toISOString().substring(0,7)
const fmt = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }
const fmtN = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k':String(a)) }

const weekStart = () => {
  const d=new Date(); const day=d.getDay()
  d.setDate(d.getDate()+(day===0?-6:1-day))
  return d.toISOString().split('T')[0]
}

const FISCAL = [
  { date:'2026-07-20', label:'Modelo 303 + 130', periode:'T2', urgent:true },
  { date:'2026-10-20', label:'Modelo 303 + 130', periode:'T3', urgent:false },
  { date:'2026-10-31', label:'Renta 2025',        periode:'IRPF annuel', urgent:false },
  { date:'2027-01-30', label:'Modelo 303 + 130', periode:'T4', urgent:false },
]
const daysUntil = (d) => Math.round((new Date(d)-new Date())/86400000)

// Objectif annuel saisonnier (confort ajusté)
const PM_MOIS = [
  [7500,25],[7500,25],[7500,25],[7500,25],[6500,22],
  [4500,15],[0,0],[0,0],[2000,5],[3250,12],[5400,18],[6000,20]
]
const caObjectifAnnuel = PM_MOIS.reduce((a,[pm,j])=>a+pm*j/25*1,0)

const getNbSess = (s) => { const t=s.properties.Notes?.rich_text?.[0]?.plain_text||''; const m=t.match(/^(\d+)/); return m?parseInt(m[1]):1 }
const isConfirme = (s) => { const st=s.properties.Statut?.select?.name||''; return st===''||st==='✅ Confirmé' }
const isPrevu    = (s) => s.properties.Statut?.select?.name==='🗓 Prévu'

// Mois activité (pour graphe annuel)
const MKEYS = ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']
const MLABELS = ['Juin','Juil','Août','Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr','Mai']
const MSHORT  = ['J','Jl','A','S','O','N','D','J','F','M','A','M']

// Arc SVG
function Arc({ pct, color, size=120, stroke=10, value, sub, label, sub2 }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r
  const arcLen=circ*240/360, filled=Math.min(arcLen, arcLen*Math.min(1,pct/100))
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
      <div style={{position:'relative',width:size,height:size*0.82}}>
        <svg width={size} height={size} style={{position:'absolute',top:0,left:0}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8E2D8" strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${circ-arcLen}`} strokeLinecap="round"
            transform={`rotate(150 ${size/2} ${size/2})`}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round"
            transform={`rotate(150 ${size/2} ${size/2})`}
            style={{transition:'stroke-dasharray .6s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',paddingTop:'8px'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'19px',fontWeight:500,color:'var(--txt)'}}>{value}</div>
          {sub && <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px'}}>{sub}</div>}
        </div>
      </div>
      <div style={{fontSize:'11px',fontWeight:700,color:'var(--txt2)',textTransform:'uppercase',letterSpacing:'1px'}}>{label}</div>
      {sub2 && <div style={{fontSize:'10px',color,fontWeight:600,textAlign:'center',maxWidth:size}}>{sub2}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s,d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const td  = todayStr()
  const m   = thisMonth()
  const ws  = weekStart()
  const tom = (() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()

  const sessActifs = sessions.filter(s=>!(s.properties.Type?.select?.name||'').includes('Amely'))
  const sessConf   = sessActifs.filter(isConfirme)
  const sessPrevu  = sessActifs.filter(isPrevu).filter(s=>(s.properties.Date?.date?.start||'')>=td)

  // ── AUJOURD'HUI
  const sessJ = sessConf.filter(s=>s.properties.Date?.date?.start===td)
  const caJ   = sessJ.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const rdvAujourdhui = sessPrevu.filter(s=>s.properties.Date?.date?.start===td)
  const rdvDemain     = sessPrevu.filter(s=>s.properties.Date?.date?.start===tom)

  // ── SEMAINE
  const sessW = sessConf.filter(s=>(s.properties.Date?.date?.start||'')>=ws)
  const caSem = sessW.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const OBJ_SEM = Math.round(OBJ_CONF/4.3)

  // ── MOIS
  const sessM    = sessConf.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const caMois   = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbSessM  = sessM.reduce((a,s)=>a+getNbSess(s),0)
  const panier   = nbSessM>0 ? Math.round(caMois/nbSessM) : 0
  const prevMois = sessPrevu.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const totalM   = caMois+prevMois
  const depMois  = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)
  const r        = netReel(caMois)
  const pctConf  = Math.round(totalM/OBJ_CONF*100)

  // ── VISION ANNUELLE
  const caAnnee = sessConf.reduce((a,s)=>{const d=s.properties.Date?.date?.start||''; return d?a+(s.properties.Prix?.number||0):a},0)
  const curMIdx = MKEYS.indexOf(m)

  // Cible proratisée : mois passés en entier + mois courant au prorata du jour
  const today_d  = new Date()
  const daysInM  = new Date(today_d.getFullYear(), today_d.getMonth()+1, 0).getDate()
  const dayOfM   = today_d.getDate()
  const ratioM   = dayOfM / daysInM  // ex: 9/30 = 0.30 le 9 juin

  const cibleDate = curMIdx>=0
    ? PM_MOIS.slice(0, curMIdx).reduce((a,[pm,j])=>a+pm*j/25, 0)          // mois passés entiers
      + PM_MOIS[curMIdx][0] * PM_MOIS[curMIdx][1] / 25 * ratioM           // mois courant proraté
    : 0
  const caByM = {}
  sessConf.forEach(s=>{const d=s.properties.Date?.date?.start||''; if(d){const mk=d.substring(0,7); caByM[mk]=(caByM[mk]||0)+(s.properties.Prix?.number||0)}})
  const prevByM = {}
  sessPrevu.forEach(s=>{const d=s.properties.Date?.date?.start||''; if(d){const mk=d.substring(0,7); prevByM[mk]=(prevByM[mk]||0)+(s.properties.Prix?.number||0)}})

  // ── ALERTES
  const rdvPassesNonValid = sessActifs.filter(isPrevu).filter(s=>(s.properties.Date?.date?.start||'').split('T')[0]<td)
  const prochainFiscal = FISCAL.filter(f=>daysUntil(f.date)>=0).sort((a,b)=>daysUntil(a.date)-daysUntil(b.date))[0]
  const fiscalUrgent   = prochainFiscal && daysUntil(prochainFiscal.date)<=30

  // ── Message mois
  const msgMois = totalM>=OBJ_CONF
    ? {icon:'🎯',text:'Objectif confort atteint !',c:'var(--green)',bg:'var(--green-bg)'}
    : totalM>=OBJ_EQ
    ? {icon:'⚖️',text:`À l'équilibre · ${pctConf}% de l'objectif confort`,c:'var(--amber)',bg:'var(--amber-bg)'}
    : {icon:'📍',text:`En retard · encore ${fmt(OBJ_EQ-caMois)} pour l'équilibre`,c:'var(--red)',bg:'var(--red-bg)'}

  // ── RENDER ──────────────────────────────────────────
  return (
    <div style={{background:'var(--bg)',minHeight:'100dvh',paddingBottom:'90px'}}>

      {/* HEADER STICKY */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 16px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 8px rgba(26,18,9,.04)'}}>
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{height:'32px',opacity:.9}}/>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'11px',color:'var(--txt3)',fontWeight:500}}>{new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span>
          <button onClick={load} style={{width:32,height:32,borderRadius:'50%',background:'var(--bg)',border:'1px solid var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',color:'var(--txt3)',cursor:'pointer'}}>↻</button>
        </div>
      </div>

      <div style={{padding:'14px 16px 0'}}>

        {/* ══ ALERTES ════════════════════════════════════ */}
        {(rdvPassesNonValid.length>0 || fiscalUrgent) && (
          <div style={{marginBottom:'14px',display:'flex',flexDirection:'column',gap:'6px'}}>
            {rdvPassesNonValid.length>0 && (
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',background:'var(--red-bg)',borderRadius:'var(--r)',borderLeft:'3px solid var(--red)'}}>
                <span style={{fontSize:'16px'}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'var(--red)'}}>
                    {rdvPassesNonValid.length} RDV passé{rdvPassesNonValid.length>1?'s':''} non validé{rdvPassesNonValid.length>1?'s':''}
                  </div>
                  <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'1px'}}>
                    {rdvPassesNonValid.map(s=>s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client').join(' · ')}
                  </div>
                </div>
                <span style={{fontSize:'12px',color:'var(--red)',fontWeight:700}}>!</span>
              </div>
            )}
            {fiscalUrgent && (
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',background:'var(--amber-bg)',borderRadius:'var(--r)',borderLeft:'3px solid var(--amber)'}}>
                <span style={{fontSize:'16px'}}>📋</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'var(--amber)'}}>{prochainFiscal.label} · {prochainFiscal.periode}</div>
                  <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'1px'}}>Dans {daysUntil(prochainFiscal.date)} jours · {new Date(prochainFiscal.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ AUJOURD'HUI ════════════════════════════════ */}
        <div style={{marginBottom:'14px'}}>
          <div className="section-title-gold" style={{marginBottom:'10px'}}>Aujourd'hui</div>
          <div className="card" style={{padding:'16px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom: (rdvAujourdhui.length>0||sessJ.length>0) ?'12px':'0'}}>
              {/* CA du jour */}
              <div style={{textAlign:'center',padding:'12px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                <div style={{fontSize:'9px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:'5px'}}>CA du jour</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'28px',fontWeight:400,color:caJ>0?'var(--green)':'var(--txt3)',lineHeight:1}}>
                  {caJ>0?fmt(caJ):'—'}
                </div>
                <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'3px'}}>
                  {sessJ.length>0?`${sessJ.length} session${sessJ.length>1?'s':''}`:'Aucune saisie'}
                </div>
              </div>
              {/* Prochain RDV */}
              <div style={{textAlign:'center',padding:'12px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                <div style={{fontSize:'9px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:'5px'}}>RDV aujourd'hui</div>
                {rdvAujourdhui.length>0 ? (
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'24px',fontWeight:500,color:'var(--amber)',lineHeight:1}}>{rdvAujourdhui.length}</div>
                    <div style={{fontSize:'10px',color:'var(--txt2)',marginTop:'3px',fontWeight:500}}>
                      {rdvAujourdhui.map(s=>s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client').join(', ')}
                    </div>
                  </div>
                ) : rdvDemain.length>0 ? (
                  <div>
                    <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'4px'}}>Demain :</div>
                    <div style={{fontSize:'12px',color:'var(--txt2)',fontWeight:600,marginTop:'2px'}}>
                      {rdvDemain.map(s=>s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client').join(', ')}
                    </div>
                    <div style={{fontSize:'11px',color:'var(--gold-dk)',marginTop:'1px'}}>
                      {fmt(rdvDemain.reduce((a,s)=>a+(s.properties.Prix?.number||0),0))} estimé
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'24px',color:'var(--txt3)',lineHeight:1}}>—</div>
                    <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'3px'}}>Pas de RDV prévu</div>
                  </div>
                )}
              </div>
            </div>
            {/* RDVs du jour planifiés */}
            {rdvAujourdhui.length>0 && (
              <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                {rdvAujourdhui.map(s=>{
                  const notes=s.properties.Notes?.rich_text?.[0]?.plain_text||''
                  const heure=notes.match(/·\s*(\d{2}:\d{2})/)?.[1]||null
                  const style=s.properties['Style / Type']?.rich_text?.[0]?.plain_text||''
                  const prix=s.properties.Prix?.number||0
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background:'rgba(212,130,10,.06)',borderRadius:'var(--r)',borderLeft:'2px solid var(--amber)'}}>
                      {heure&&<span style={{fontSize:'11px',fontFamily:'var(--font-mono)',color:'var(--amber)',flexShrink:0}}>🕐 {heure}</span>}
                      <span style={{fontSize:'12px',fontWeight:600,flex:1}}>{s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'}</span>
                      {style&&<span style={{fontSize:'11px',color:'var(--txt3)'}}>{style}</span>}
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:600,flexShrink:0}}>{prix}€</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ CE MOIS ════════════════════════════════════ */}
        <div style={{marginBottom:'14px'}}>
          <div className="section-title-gold" style={{marginBottom:'10px'}}>Ce mois — {new Date().toLocaleDateString('fr-FR',{month:'long'})}</div>
          <div className="card" style={{padding:'16px'}}>

            {/* Grand chiffre + badge */}
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'10px'}}>
              <div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'42px',fontWeight:400,color:msgMois.c,lineHeight:1}}>{fmt(caMois)}</div>
                {prevMois>0&&<div style={{fontSize:'11px',color:'var(--blue)',marginTop:'3px'}}>+ {fmt(prevMois)} planifié → {fmt(totalM)}</div>}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'10px',color:'var(--txt3)',marginBottom:'2px'}}>/ {fmt(OBJ_CONF)}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'24px',fontWeight:500,color:msgMois.c}}>{pctConf}%</div>
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{height:'8px',background:'var(--bg2)',borderRadius:'4px',overflow:'hidden',marginBottom:'8px',position:'relative'}}>
              {prevMois>0&&(
                <div style={{position:'absolute',left:`${Math.min(100,caMois/OBJ_CONF*100)}%`,top:0,bottom:0,width:`${Math.min(100-caMois/OBJ_CONF*100, prevMois/OBJ_CONF*100)}%`,background:'rgba(41,128,185,.35)',backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.3) 3px,rgba(255,255,255,.3) 6px)'}}/>
              )}
              <div style={{height:'100%',width:`${Math.min(100,caMois/OBJ_CONF*100)}%`,background:msgMois.c,borderRadius:'4px',transition:'width .5s'}}/>
              {/* Marqueur équilibre */}
              <div style={{position:'absolute',top:0,bottom:0,left:`${OBJ_EQ/OBJ_CONF*100}%`,width:'1.5px',background:'rgba(0,0,0,.15)'}}/>
            </div>

            {/* Message seuil */}
            <div style={{padding:'8px 12px',background:msgMois.bg,borderRadius:'var(--r)',borderLeft:`3px solid ${msgMois.c}`,marginBottom:'12px'}}>
              <span style={{fontSize:'12px',fontWeight:700,color:msgMois.c}}>{msgMois.icon} {msgMois.text}</span>
            </div>

            {/* 3 jauges — objectif glissant calendaire */}
            {(()=>{
              const now      = new Date()
              const daysInM  = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
              const dayOfM   = now.getDate()

              const joursRestants = daysInM - dayOfM + 1
              const joursEcoules  = dayOfM - 1

              const OBJ_JOUR_BASE = Math.round(OBJ_CONF / daysInM)
              const resteAFaire   = Math.max(0, OBJ_CONF - caMois)
              const OBJ_JOUR_ADJ  = joursRestants > 0 ? Math.round(resteAFaire / joursRestants) : 0

              const todayDow     = now.getDay()
              const joursRestSem = todayDow === 0 ? 1 : 7 - todayDow + 1
              const OBJ_SEM_ADJ  = OBJ_JOUR_ADJ * joursRestSem

              const caAttendu = OBJ_JOUR_BASE * joursEcoules
              const deltaM    = caMois - caAttendu
              const enAvance  = deltaM >= 0

              const colJour  = caJ>=OBJ_JOUR_ADJ?'var(--green)':caJ>=OBJ_JOUR_ADJ*0.5?'var(--amber)':'var(--red)'
              const colSem   = caSem>=OBJ_SEM_ADJ?'var(--green)':caSem>=OBJ_SEM_ADJ*0.5?'var(--amber)':'var(--red)'
              const colMois  = caMois>=OBJ_CONF?'var(--green)':caMois>=OBJ_EQ?'var(--amber)':'var(--red)'
              const pctJour  = Math.min(100, OBJ_JOUR_ADJ>0?Math.round(caJ/OBJ_JOUR_ADJ*100):0)
              const pctSem   = Math.min(100, OBJ_SEM_ADJ>0?Math.round(caSem/OBJ_SEM_ADJ*100):0)
              const pctMois  = Math.min(100, Math.round(caMois/OBJ_CONF*100))

              return (
                <>
                  <div style={{textAlign:'center',marginBottom:'16px'}}>
                    <div style={{fontSize:'10px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>
                      Objectif aujourd'hui
                    </div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'38px',fontWeight:500,lineHeight:1,
                      color:OBJ_JOUR_ADJ<=OBJ_JOUR_BASE?'var(--green)':OBJ_JOUR_ADJ<=OBJ_JOUR_BASE*1.3?'var(--amber)':'var(--red)'}}>
                      {fmt(OBJ_JOUR_ADJ)}
                    </div>
                    <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'4px'}}>
                      base {fmt(OBJ_JOUR_BASE)}/j · {joursRestants} j. restants
                    </div>
                    {joursEcoules>0&&(
                      <div style={{display:'inline-flex',alignItems:'center',gap:'4px',marginTop:'6px',fontSize:'10px',fontWeight:700,padding:'3px 10px',borderRadius:'20px',
                        background:enAvance?'rgba(26,140,90,.1)':'rgba(192,57,43,.1)',
                        color:enAvance?'var(--green)':'var(--red)'}}>
                        {enAvance?'▲':'▼'} {enAvance?'+':''}{fmt(deltaM)} vs rythme
                      </div>
                    )}
                  </div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',justifyItems:'center',marginBottom:'14px'}}>
                    <Arc pct={pctJour} color={colJour} size={108} stroke={9}
                      label="Jour"
                      value={caJ>0?fmt(caJ):'—'}
                      sub={`/ ${fmt(OBJ_JOUR_ADJ)}`}
                      sub2={caJ>=OBJ_JOUR_ADJ?'✓ Ok':caJ>0?`-${fmt(OBJ_JOUR_ADJ-caJ)}`:null}
                    />
                    <Arc pct={pctSem} color={colSem} size={108} stroke={9}
                      label="Semaine"
                      value={caSem>0?fmt(caSem):'—'}
                      sub={`/ ${fmt(OBJ_SEM_ADJ)}`}
                      sub2={caSem>=OBJ_SEM_ADJ?'✓ Ok':caSem>0?`-${fmt(OBJ_SEM_ADJ-caSem)}`:null}
                    />
                    <Arc pct={pctMois} color={colMois} size={108} stroke={9}
                      label="Mois"
                      value={caMois>0?fmt(caMois):'—'}
                      sub={`/ ${fmt(OBJ_CONF)}`}
                      sub2={caMois>=OBJ_CONF?'🎯 Confort':caMois>=OBJ_EQ?`⚖️ ${pctMois}%`:caMois>0?`-${fmt(OBJ_CONF-caMois)}`:null}
                    />
                  </div>
                </>
              )
            })()}

            {/* Stats inline */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px'}}>
              {[
                {l:'Panier moyen',v:panier>0?panier+'€':'—',s:`${nbSessM} sess.`,c:'var(--txt)'},
                {l:'Net estimé',v:fmt(r.net),s:'après impôts',c:r.net>1500?'var(--green)':'var(--txt)'},
                {l:'Dépenses',v:fmt(depMois),s:'ce mois',c:depMois>FIXES?'var(--red)':'var(--txt)'},
              ].map(x=>(
                <div key={x.l} style={{textAlign:'center',padding:'7px 4px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                  <div style={{fontSize:'8px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'3px',lineHeight:1.2}}>{x.l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'14px',fontWeight:500,color:x.c}}>{x.v}</div>
                  <div style={{fontSize:'9px',color:'var(--txt3)',marginTop:'1px'}}>{x.s}</div>
                </div>
              ))}
            </div>

            {/* IRPF + IVA */}
            {caMois>0&&(
              <div style={{marginTop:'10px',padding:'8px 12px',background:'rgba(154,82,0,.05)',borderRadius:'var(--r)',borderLeft:'2px solid var(--amber)'}}>
                <div style={{fontSize:'9px',color:'var(--amber)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>À mettre de côté</div>
                <div style={{display:'flex',gap:'16px',fontSize:'11px'}}>
                  <span>IRPF : <span style={{fontFamily:'var(--font-mono)',fontWeight:600}}>{fmt(r.irpf)}</span></span>
                  <span>IVA nette : <span style={{fontFamily:'var(--font-mono)',fontWeight:600}}>{fmt(r.iva)}</span></span>
                  <span style={{color:'var(--amber)',fontWeight:700}}>Total : <span style={{fontFamily:'var(--font-mono)'}}>{fmt(r.irpf+r.iva)}</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ PROCHAINS RDV (compacts) ══════════════════ */}
        {sessPrevu.length>0&&(
          <div style={{marginBottom:'14px'}}>
            <div className="section-title-gold" style={{marginBottom:'10px'}}>Prochains rendez-vous</div>
            {sessPrevu.slice(0,4).map(s=>{
              const date   = s.properties.Date?.date?.start?.split('T')[0]||''
              const client = s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'
              const style  = s.properties['Style / Type']?.rich_text?.[0]?.plain_text||''
              const prix   = s.properties.Prix?.number||0
              const notes  = s.properties.Notes?.rich_text?.[0]?.plain_text||''
              const heure  = notes.match(/·\s*(\d{2}:\d{2})/)?.[1]||null
              const d      = new Date(date)
              const diff   = Math.round((d-new Date(td))/86400000)
              const label  = diff===0?"Auj.":diff===1?'Dem.':d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})
              return (
                <div key={s.id} style={{
                  display:'flex',alignItems:'center',gap:'0',marginBottom:'6px',
                  borderRadius:'var(--r)',overflow:'hidden',
                  boxShadow:'var(--shadow-xs)',border:'1px solid var(--border)'
                }}>
                  <div style={{
                    width:50,flexShrink:0,background:diff===0?'var(--txt)':diff===1?'rgba(196,168,130,.2)':'var(--bg2)',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                    padding:'10px 4px',gap:'1px',alignSelf:'stretch'
                  }}>
                    <span style={{fontSize:'10px',fontWeight:700,color:diff===0?'var(--bg)':'var(--txt3)',textTransform:'uppercase'}}>{label.split(' ')[0]}</span>
                    {diff>=2&&<span style={{fontSize:'16px',fontWeight:800,color:'var(--txt)',lineHeight:1}}>{d.getDate()}</span>}
                    {diff>=2&&<span style={{fontSize:'9px',color:'var(--txt3)'}}>{d.toLocaleDateString('fr-FR',{month:'short'})}</span>}
                  </div>
                  <div style={{flex:1,padding:'8px 10px',background:'var(--surface)',display:'flex',justifyContent:'space-between',alignItems:'center',minWidth:0}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:'13px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{client}</div>
                      <div style={{fontSize:'10px',color:'var(--txt3)',display:'flex',gap:'6px',marginTop:'1px'}}>
                        {style&&<span>{style}</span>}
                        {heure&&<span style={{fontFamily:'var(--font-mono)'}}>🕐{heure}</span>}
                      </div>
                    </div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'15px',fontWeight:600,color:'var(--txt)',flexShrink:0,marginLeft:'8px'}}>{prix}€</div>
                  </div>
                </div>
              )
            })}
            {sessPrevu.length>4&&(
              <div style={{textAlign:'center',padding:'6px',fontSize:'11px',color:'var(--txt3)',background:'var(--surface)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
                +{sessPrevu.length-4} autres rendez-vous planifiés · {fmt(sessPrevu.slice(4).reduce((a,s)=>a+(s.properties.Prix?.number||0),0))} estimé
              </div>
            )}
          </div>
        )}

        {/* ══ GRAPHE ANNUEL (compact) ════════════════════ */}
        <div style={{marginBottom:'14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <div className="section-title-gold" style={{margin:0}}>Vision annuelle</div>
            <div style={{fontSize:'11px',color:'var(--txt3)',fontFamily:'var(--font-mono)'}}>{fmt(caAnnee)} / {fmt(caObjectifAnnuel)}</div>
          </div>
          <div className="card" style={{padding:'14px'}}>
            {/* Barres mensuelles */}
            <div style={{display:'flex',alignItems:'flex-end',gap:'3px',height:'56px',marginBottom:'4px'}}>
              {MKEYS.map((mk,i)=>{
                const val   = Math.round(caByM[mk]||0)
                const prev  = Math.round(prevByM[mk]||0)
                const isFut = i > (curMIdx>=0?curMIdx:0)
                const isCur = mk===m
                const MAX   = Math.max(...MKEYS.map(k=>(caByM[k]||0)+(prevByM[k]||0)),OBJ_CONF,1)
                const hV    = isFut?0:Math.max(2,Math.round((val/MAX)*56))
                const hP    = Math.round((prev/MAX)*56)
                const col   = isFut?'var(--border)':val>=OBJ_CONF?'var(--green)':val>=OBJ_EQ?'var(--amber)':val>0?'var(--red)':'var(--border)'
                return (
                  <div key={mk} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%',position:'relative',gap:0}}>
                    {(val>0||prev>0)&&!isFut&&(
                      <div style={{position:'absolute',top:Math.max(0,56-hV-hP-12)+'px',fontSize:'8px',fontFamily:'var(--font-mono)',color:col,fontWeight:600,lineHeight:1,textAlign:'center',whiteSpace:'nowrap'}}>
                        {val>=1000?(val/1000).toFixed(1)+'k':val>0?val:''}
                      </div>
                    )}
                    <div style={{width:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:'100%'}}>
                      {hP>0&&<div style={{width:'100%',height:hP+'px',background:'rgba(41,128,185,.25)',borderRadius:hV>0?0:'2px 2px 0 0',backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.3) 3px,rgba(255,255,255,.3) 6px)'}}/>}
                      {hV>0&&<div style={{width:'100%',height:hV+'px',background:col,borderRadius:hP>0?0:'2px 2px 0 0',position:'relative'}}>
                        {isCur&&<div style={{position:'absolute',top:'-5px',left:'50%',transform:'translateX(-50%)',width:5,height:5,borderRadius:'50%',background:'var(--gold)'}}/>}
                      </div>}
                      {hV===0&&!isFut&&<div style={{width:'100%',height:'2px',background:'var(--border)',borderRadius:'2px 2px 0 0'}}/>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{display:'flex',gap:'3px',borderTop:'1px solid var(--border)',paddingTop:'3px'}}>
              {MSHORT.map((mo,i)=>(
                <div key={i} style={{flex:1,textAlign:'center',fontSize:'8px',color:MKEYS[i]===m?'var(--gold-dk)':'var(--txt3)',fontWeight:MKEYS[i]===m?700:400}}>{mo}</div>
              ))}
            </div>
            {/* Stats cumulées */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px',marginTop:'10px'}}>
              {[
                {l:'CA cumulé',v:fmt(caAnnee),c:'var(--txt)'},
                {l:'Cible J-'+new Date().getDate(),v:fmt(cibleDate),c:caAnnee>=cibleDate?'var(--green)':'var(--red)'},
                {l:'Avance/retard',v:fmt(caAnnee-cibleDate),c:caAnnee>=cibleDate?'var(--green)':'var(--red)'},
              ].map(x=>(
                <div key={x.l} style={{textAlign:'center',padding:'6px 4px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                  <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'2px'}}>{x.l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:600,color:x.c}}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ FISCAL + GOOGLE ══════════════════════════ */}
        <div style={{marginBottom:'14px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
          {/* Prochaine échéance */}
          {prochainFiscal&&(
            <div className="card" style={{padding:'12px'}}>
              <div style={{fontSize:'9px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>Prochaine échéance</div>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--txt)',marginBottom:'2px'}}>{prochainFiscal.label}</div>
              <div style={{fontSize:'10px',color:'var(--txt3)',marginBottom:'6px'}}>{prochainFiscal.periode}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',fontWeight:600,color:daysUntil(prochainFiscal.date)<=30?'var(--red)':daysUntil(prochainFiscal.date)<=60?'var(--amber)':'var(--txt)'}}>
                J-{daysUntil(prochainFiscal.date)}
              </div>
              <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px'}}>
                {new Date(prochainFiscal.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
              </div>
            </div>
          )}
          {/* Liens rapides */}
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="card" style={{
              display:'flex',alignItems:'center',gap:'8px',padding:'11px 12px',
              textDecoration:'none',color:'var(--txt)',cursor:'pointer',flex:1
            }}>
              <span style={{fontSize:'18px',flexShrink:0}}>📅</span>
              <div>
                <div style={{fontSize:'11px',fontWeight:700}}>Google Calendar</div>
                <div style={{fontSize:'9px',color:'var(--txt3)',marginTop:'1px'}}>Planning Tony</div>
              </div>
            </a>
            <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="card" style={{
              display:'flex',alignItems:'center',gap:'8px',padding:'11px 12px',
              textDecoration:'none',color:'var(--txt)',cursor:'pointer',flex:1
            }}>
              <span style={{fontSize:'18px',flexShrink:0}}>⭐</span>
              <div>
                <div style={{fontSize:'11px',fontWeight:700}}>Google Business</div>
                <div style={{fontSize:'9px',color:'var(--txt3)',marginTop:'1px'}}>Avis clients</div>
              </div>
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
