import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

// ── MODÈLE FINANCIER ─────────────────────────────────
const FIXES    = 956
const MATOS    = 0.08
const IVA_FL   = 150.47
const PERSO    = 1500
const OBJ_EQ   = 3895   // équilibre mensuel
const OBJ_HIV  = 5850   // tenir hiver
const OBJ_CONF = 7500   // confort

const netReel = (ca) => {
  const m = ca * MATOS, b = ca - FIXES - m
  const irpf = Math.max(0, b * 0.20)
  const iva  = Math.max(0, ca * 0.21 - IVA_FL - m * 0.21)
  return { net: Math.max(0, Math.round(b - irpf - iva)), irpf: Math.round(irpf), iva: Math.round(iva) }
}

const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => new Date().toISOString().substring(0, 7)
const fmt = (n) => { const a = Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }

// Lundi de la semaine courante
const weekStart = () => {
  const d = new Date(); const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]
}

// Obligations fiscales 2026
const FISCAL = [
  { date:'2026-07-20', label:'Modelo 303 + 130', periode:'T2 (avr-juin)', urgent: true },
  { date:'2026-10-20', label:'Modelo 303 + 130', periode:'T3 (juil-sept)', urgent: false },
  { date:'2027-01-30', label:'Modelo 303 + 130', periode:'T4 (oct-déc)',  urgent: false },
  { date:'2026-10-31', label:'Renta 2025', periode:'Déclaration annuelle IRPF', urgent: false },
]
const today = new Date()
const daysUntil = (dateStr) => Math.round((new Date(dateStr) - today) / 86400000)

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    // Auto-refresh quand on revient sur l'onglet
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  // ── CALCULS CA ─────────────────────────────────────
  const m   = thisMonth()
  const ws  = weekStart()

  const sessActifs = sessions.filter(s => !(s.properties.Type?.select?.name||'').includes('Amely'))

  const caMois    = sessConf.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caSemaine = sessConf.filter(s=>(s.properties.Date?.date?.start||'') >= ws).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  // CA annuel (tous depuis juin 2026)
  const caAnnee = sessConf.reduce((a,s)=>{
    const d = s.properties.Date?.date?.start||''
    return d >= '2026-06-01' ? a + (s.properties.Prix?.number||0) : a
  }, 0)

  // Hub Blackthorn = CA Tony uniquement
  const caTotal = caMois
  const rMois   = netReel(caTotal)

  // Prévisionnel RDV
  const today = new Date().toISOString().split('T')[0]
  const rdvsPrevu = sessPrevu.filter(s=>(s.properties.Date?.date?.start||'')>=today)
    .sort((a,b)=>(a.properties.Date?.date?.start||'').localeCompare(b.properties.Date?.date?.start||''))
  
  const in30 = new Date(); in30.setDate(in30.getDate()+30)
  const in30str = in30.toISOString().split('T')[0]
  
  const prevSem = rdvsPrevu.filter(s=>(s.properties.Date?.date?.start||'')<=new Date(new Date().setDate(new Date().getDate()+7)).toISOString().split('T')[0]).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const prevMois = rdvsPrevu.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const prevNext = rdvsPrevu.filter(s=>{
    const next = new Date(); next.setMonth(next.getMonth()+1)
    return (s.properties.Date?.date?.start||'').startsWith(next.toISOString().substring(0,7))
  }).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  // Dépenses mois
  const depMois = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)

  // ── VISION ANNUELLE ────────────────────────────
  // Profil saisonnier Jun 2026 → Mai 2027
  const MKEYS_ANN = ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']
  const JOURS_ANN = [25,25,25,25,22,15,0,0,5,12,18,20]
  const IS_ETE_ANN= [1,1,1,1,1,0,0,0,0,0,0,0]
  // CA target MINIMUM (équilibre = 156€/j, tenir hiver en été = 234€/j)
  const PM_MIN    = [234,234,234,234,234,200,0,0,130,130,200,200]
  const ciblesMois= MKEYS_ANN.map((k,i)=>PM_MIN[i]*JOURS_ANN[i])
  // CA cumulé cible par mois
  const cibleCumul= ciblesMois.reduce((acc,v,i)=>[...acc, (acc[i-1]||0)+v],[])
  // CA réel par mois
  const caByMois  = {}
  sessConf.forEach(s=>{const d=s.properties.Date?.date?.start||''; if(d){const mk=d.substring(0,7); caByMois[mk]=(caByMois[mk]||0)+(s.properties.Prix?.number||0)}})
  const caActifs  = MKEYS_ANN.map(k=>Math.round(caByMois[k]||0))
  // Cumul réel
  const caAnnuelCumul = caActifs.reduce((a,v)=>a+v,0)
  const curIdxAnn = MKEYS_ANN.indexOf(m)
  const cibleAujourdhui = curIdxAnn>=0 ? cibleCumul[curIdxAnn] : 0
  const caObjectifAnnuel = cibleCumul[11]  // total annuel cible

  // Réserve hiver accumulée
  const PROV_HIVER = 5285
  const PROV_MAX_M = 1057
  let resAccum = 0
  caActifs.forEach((ca,i)=>{
    const r2 = netReel(ca)
    const d2 = r2.net - PERSO
    if(IS_ETE_ANN[i] && d2>0) resAccum=Math.min(PROV_HIVER,resAccum+Math.min(d2,PROV_MAX_M))
    else if(!IS_ETE_ANN[i] && d2<0) resAccum=Math.max(0,resAccum+d2)
  })
  resAccum = Math.round(resAccum)

  // Vitesse actuelle vs vitesse nécessaire
  const moisEcoules = Math.max(1, curIdxAnn+1)
  const vitActuelle = Math.round(caAnnuelCumul / moisEcoules)
  const moisRestants= Math.max(1, 12 - moisEcoules)
  const caRestant   = Math.max(0, caObjectifAnnuel - caAnnuelCumul)
  const vitNecessaire = Math.round(caRestant / moisRestants)
  const avance       = caAnnuelCumul - cibleAujourdhui
  const surParcours  = avance >= 0

  // Objectif atteint
  const statusObj = caTotal >= OBJ_CONF ? 'confort'
                  : caTotal >= OBJ_HIV  ? 'hiver'
                  : caTotal >= OBJ_EQ   ? 'equil'
                  : 'below'

  const STATUS_CFG = {
    below: { icon:'🔴', color:'#E24B4A', bg:'rgba(226,75,74,.1)', label:'Pas encore à l\'équilibre', sub:`Encore ${fmt(OBJ_EQ - caTotal)} pour couvrir les charges` },
    equil: { icon:'⚖️', color:'#E8A020', bg:'rgba(232,160,32,.1)', label:'À l\'équilibre', sub:`Encore ${fmt(OBJ_HIV - caTotal)} pour tenir l'hiver` },
    hiver: { icon:'🌊', color:'#BA7517', bg:'rgba(186,117,23,.1)', label:'Vous tenez l\'hiver', sub:`Encore ${fmt(OBJ_CONF - caTotal)} pour être confortable` },
    confort:{ icon:'✅', color:'#1D9E75', bg:'rgba(29,158,117,.1)', label:'Vous êtes confortables', sub:`+${fmt(caTotal - OBJ_CONF)} au-dessus du confort` },
  }
  const st = STATUS_CFG[statusObj]

  // Prochaines obligations fiscales
  const nextFiscal = FISCAL.filter(f => daysUntil(f.date) >= 0).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3)

  return (
    <div style={{ padding:'16px 16px 32px' }}>

      {/* ── HEADER ──────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{ height:'40px', filter:'brightness(0) opacity(0.85)', opacity:0.85 }} />
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'11px', color:'var(--gris)' }}>{new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span>
          <button onClick={load} style={{ background:'none', border:'none', color:'var(--gris)', fontSize:'16px', cursor:'pointer', padding:'4px' }}>↻</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 1 : FINANCES
      ══════════════════════════════════════════════ */}
      <div style={{ fontSize:'10px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>Finances</div>

      {/* 3 chiffres clés */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
        {[
          { l:'Semaine', v:caSemaine, max:OBJ_HIV/4 },
          { l:'Mois',    v:caTotal,   max:OBJ_CONF },
          { l:'Année',   v:caAnnee,   max:47208 },
        ].map(({ l, v, max }) => (
          <div key={l} style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'10px 8px', border:'1px solid var(--noir3)' }}>
            <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{l}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:500, color:v>=max*0.9?'var(--vert)':v>=max*0.5?'var(--pierre)':v>0?'var(--gris)':'var(--gris2)' }}>
              {loading ? '...' : fmt(v)}
            </div>
            <div style={{ height:'3px', background:'var(--noir3)', borderRadius:'2px', marginTop:'6px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:Math.min(100,(v/max)*100)+'%', background:v>=max*0.9?'var(--vert)':'var(--pierre)', borderRadius:'2px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Jauge objectifs */}
      <div style={{ marginBottom:'14px', background:'var(--noir2)', borderRadius:'var(--r)', padding:'14px 16px', border:`1px solid ${st.color}40` }}>
        {/* Barre */}
        <div style={{ position:'relative', height:'32px', marginBottom:'8px' }}>
          {/* Zones colorées */}
          <div style={{ position:'absolute', inset:0, borderRadius:'6px', overflow:'hidden', display:'flex' }}>
            <div style={{ width:(OBJ_EQ/OBJ_CONF/1.2)*100+'%', background:'rgba(226,75,74,.2)' }} />
            <div style={{ width:((OBJ_HIV-OBJ_EQ)/OBJ_CONF/1.2)*100+'%', background:'rgba(232,160,32,.2)' }} />
            <div style={{ width:((OBJ_CONF-OBJ_HIV)/OBJ_CONF/1.2)*100+'%', background:'rgba(186,117,23,.2)' }} />
            <div style={{ flex:1, background:'rgba(29,158,117,.2)' }} />
          </div>
          {/* Remplissage actuel */}
          <div style={{ position:'absolute', inset:0, borderRadius:'6px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:Math.min(100,(caTotal/(OBJ_CONF*1.2))*100)+'%', background:st.color, opacity:0.85, transition:'width .6s ease' }} />
          </div>
          {/* Marqueurs */}
          {[{v:OBJ_EQ,l:'Équil.'},{v:OBJ_HIV,l:'Hiver'},{v:OBJ_CONF,l:'Confort'}].map(mk=>(
            <div key={mk.l} style={{ position:'absolute', top:0, bottom:0, left:(mk.v/(OBJ_CONF*1.2))*100+'%', width:'1px', background:'rgba(255,255,255,.3)', zIndex:2 }}>
              <div style={{ position:'absolute', top:'50%', left:'3px', transform:'translateY(-50%)', fontSize:'8px', color:'rgba(255,255,255,.6)', whiteSpace:'nowrap', fontWeight:600 }}>{mk.l}</div>
            </div>
          ))}
          {/* Montant actuel */}
          <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', right:'8px', fontFamily:'var(--font-mono)', fontSize:'13px', color:'#fff', fontWeight:700, textShadow:'0 0 8px rgba(0,0,0,.5)' }}>
            {loading ? '...' : fmt(caTotal)}
          </div>
        </div>
        {/* Message statut */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'18px' }}>{st.icon}</span>
          <div>
            <div style={{ fontSize:'13px', fontWeight:600, color:st.color }}>{st.label}</div>
            <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'1px' }}>{st.sub}</div>
          </div>
        </div>
      </div>

      {/* Détail financier mois */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
        {[
          { l:'IRPF à mettre de côté', v:rMois.irpf, c:'var(--jaune)' },
          { l:'IVA nette', v:rMois.iva, c:'var(--jaune)' },
          { l:'Net disponible', v:rMois.net, c:rMois.net>=PERSO?'var(--vert)':'var(--rouge)' },
        ].map(x=>(
          <div key={x.l} style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'8px', textAlign:'center' }}>
            <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', lineHeight:1.3, marginBottom:'4px' }}>{x.l}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', color:x.c }}>{loading?'...':fmt(x.v)}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 1b : VISION ANNUELLE
      ══════════════════════════════════════════════ */}
      <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>Tenir l'année</div>

      <div className="card" style={{ marginBottom:'20px' }}>
        {/* Verdict */}
        <div style={{ padding:'12px 14px', borderRadius:'10px', marginBottom:'14px',
          background:surParcours?'rgba(26,140,90,.07)':'rgba(192,57,43,.07)',
          border:`1px solid ${surParcours?'rgba(26,140,90,.25)':'rgba(192,57,43,.25)'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:surParcours?'#1A8C5A':'#C0392B' }}>
                {surParcours ? '✅ Dans les clous' : '⚠️ En retard sur le parcours'}
              </div>
              <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'3px' }}>
                {surParcours
                  ? `+${fmt(Math.abs(avance))} d'avance sur la cible`
                  : `${fmt(Math.abs(avance))} de retard — besoin de ${fmt(vitNecessaire)}/mois`}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:700, color:surParcours?'#1A8C5A':'#C0392B' }}>
                {Math.round((caAnnuelCumul/Math.max(1,caObjectifAnnuel))*100)}%
              </div>
              <div style={{ fontSize:'10px', color:'var(--txt3)' }}>de l'objectif annuel</div>
            </div>
          </div>
        </div>

        {/* Barre cumulative */}
        <div style={{ marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'var(--txt3)', marginBottom:'4px' }}>
            <span>CA cumulé</span>
            <span style={{ fontFamily:'var(--font-mono)' }}>{fmt(caAnnuelCumul)} / {fmt(cibleAujourdhui)} attendu</span>
          </div>
          <div style={{ position:'relative', height:'10px', background:'var(--bg2)', borderRadius:'5px', overflow:'hidden' }}>
            {/* Cible */}
            <div style={{ position:'absolute', height:'100%', width:(cibleAujourdhui/caObjectifAnnuel*100)+'%', background:'rgba(0,0,0,0.08)', borderRadius:'5px' }} />
            {/* Réel */}
            <div style={{ position:'absolute', height:'100%', width:Math.min(100,(caAnnuelCumul/caObjectifAnnuel*100))+'%',
              background:surParcours?'#1A8C5A':'#C0392B', borderRadius:'5px', transition:'width .5s' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'9px', color:'var(--txt3)', marginTop:'3px' }}>
            <span>Juin 2026</span>
            <span>Objectif : {fmt(caObjectifAnnuel)}</span>
            <span>Mai 2027</span>
          </div>
        </div>

        {/* Réserve hiver */}
        <div style={{ marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'var(--txt3)', marginBottom:'4px' }}>
            <span>Réserve hiver</span>
            <span style={{ fontFamily:'var(--font-mono)', color:resAccum>=PROV_HIVER?'#1A8C5A':'#D4820A' }}>
              {resAccum.toLocaleString()}€ / {PROV_HIVER.toLocaleString()}€
            </span>
          </div>
          <div style={{ height:'8px', background:'var(--bg2)', borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:Math.min(100,(resAccum/PROV_HIVER)*100)+'%',
              background:resAccum>=PROV_HIVER?'#1A8C5A':'#D4820A', borderRadius:'4px', transition:'width .5s' }} />
          </div>
        </div>

        {/* 3 indicateurs clés */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
          {[
            { l:'Rythme actuel', v:fmt(vitActuelle)+'/mois', ok: vitActuelle >= vitNecessaire },
            { l:'Besoin restant', v:fmt(vitNecessaire)+'/mois', ok: vitActuelle >= vitNecessaire },
            { l:'Mois restants', v:String(moisRestants), ok: true },
          ].map(x=>(
            <div key={x.l} style={{ textAlign:'center', padding:'8px 4px', background:'var(--bg)', borderRadius:'var(--r)' }}>
              <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', marginBottom:'3px', lineHeight:1.3 }}>{x.l}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'14px', fontWeight:600, color:x.ok?'#1A8C5A':'#C0392B' }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION PRÉVISIONNEL RDV
      ══════════════════════════════════════════════ */}
      {rdvsPrevu.length > 0 && (
        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>
            Prévisionnel rendez-vous
          </div>

          {/* Jauge prévisionnel */}
          {(()=>{
            const totalPrevu = caMois + prevMois
            const restant    = Math.max(0, 5850 - totalPrevu)
            const pctConf    = Math.min(100, (caMois  / 5850) * 100)
            const pctPrev    = Math.min(100 - pctConf, (prevMois / 5850) * 100)
            const depasse    = totalPrevu >= 5850
            const nRdvSem    = rdvsPrevu.filter(s=>(s.properties.Date?.date?.start||'')<=new Date(new Date().setDate(new Date().getDate()+7)).toISOString().split('T')[0]).length
            const nRdvMois   = rdvsPrevu.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).length
            return (
              <div className="card" style={{ marginBottom:'12px', padding:'14px' }}>
                {/* Titre + RDV count */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <span style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1.5px', fontWeight:600 }}>Prévisionnel ce mois</span>
                  <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{nRdvMois} RDV · {nRdvSem} cette sem.</span>
                </div>

                {/* Barre double */}
                <div style={{ position:'relative', height:'14px', background:'var(--bg2)', borderRadius:'7px', overflow:'hidden', marginBottom:'8px' }}>
                  {pctPrev > 0 && (
                    <div style={{ position:'absolute', left:pctConf+'%', top:0, bottom:0, width:pctPrev+'%',
                      background:'rgba(41,128,185,.35)',
                      backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.3) 4px,rgba(255,255,255,.3) 8px)',
                      transition:'width .5s' }}/>
                  )}
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:pctConf+'%',
                    background:caMois>=5850?'#1A8C5A':caMois>=3895?'#D4820A':'#C0392B',
                    borderRadius:'7px', transition:'width .5s' }}/>
                </div>

                {/* Chiffres */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'10px' }}>
                  {[
                    {l:'Réalisé',v:fmt(caMois),c:caMois>=3895?'#D4820A':'#C0392B'},
                    {l:'Planifié',v:prevMois>0?'+'+fmt(prevMois):'—',c:'#2980B9'},
                    {l:'Total estimé',v:fmt(totalPrevu),c:depasse?'#1A8C5A':totalPrevu>=3895?'#D4820A':'#C0392B'},
                  ].map(x=>(
                    <div key={x.l} style={{ textAlign:'center', padding:'6px 4px', background:'var(--bg)', borderRadius:'var(--r)' }}>
                      <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', marginBottom:'2px' }}>{x.l}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'14px', fontWeight:600, color:x.c }}>{x.v}</div>
                    </div>
                  ))}
                </div>

                {/* Message */}
                <div style={{ padding:'8px 12px', borderRadius:'var(--r)',
                  background:depasse?'rgba(26,140,90,.08)':'rgba(192,57,43,.05)',
                  borderLeft:`3px solid ${depasse?'#1A8C5A':restant<1000?'#D4820A':'#C0392B'}` }}>
                  {depasse ? (
                    <span style={{ fontSize:'12px', fontWeight:600, color:'#1A8C5A' }}>✅ Objectif hiver couvert avec {fmt(totalPrevu-5850)} de marge</span>
                  ) : (
                    <span style={{ fontSize:'12px', fontWeight:600, color:restant<1000?'#D4820A':'#C0392B' }}>
                      📍 Encore {fmt(restant)} à réaliser ce mois
                      {prevMois>0&&<span style={{ fontSize:'11px', fontWeight:400, color:'var(--txt3)' }}> (+{fmt(prevMois)} planifié)</span>}
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Liste des RDV à venir */}
          {rdvsPrevu.slice(0,8).map(s => {
            const client = s.properties['Client prénom']?.rich_text?.[0]?.plain_text || 'Client'
            const style  = s.properties['Style / Type']?.rich_text?.[0]?.plain_text || ''
            const prix   = s.properties.Prix?.number || 0
            const acompte= s.properties['Acompte reçu']?.number || 0
            const dateStr= s.properties.Date?.date?.start || ''
            const d = new Date(dateStr)
            const diff = Math.round((d - new Date(today)) / 86400000)
            const label = diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : diff <= 6 ? d.toLocaleDateString('fr-FR',{weekday:'long'}) : d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
            const isToday = diff === 0
            const isSoon  = diff <= 2
            return (
              <div key={s.id} className="card" style={{ marginBottom:'8px', padding:'12px 14px', borderLeft:`3px solid ${isToday?'#D4820A':isSoon?'#BA7517':'var(--pierre)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:isToday?'#D4820A':'var(--txt)' }}>{label}</span>
                      {isToday && <span style={{ fontSize:'9px', padding:'2px 5px', background:'rgba(212,130,10,.1)', color:'#D4820A', borderRadius:'4px', fontWeight:700 }}>AUJOURD'HUI</span>}
                    </div>
                    <div style={{ fontSize:'13px', fontWeight:500 }}>{client}</div>
                    {style && <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'1px' }}>{style}</div>}
                    {acompte > 0 && <div style={{ fontSize:'10px', color:'#1A8C5A', marginTop:'2px' }}>Acompte reçu : {acompte}€</div>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'16px', fontWeight:600, color:'#2980B9' }}>{prix}€</div>
                    <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'2px' }}>estimé</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SECTION 2 : RÉSEAUX SOCIAUX BLACKTHORN
      ══════════════════════════════════════════════ */}
      <div style={{ fontSize:'10px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>Réseaux sociaux</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'20px' }}>
        {/* Instagram Blackthorn */}
        <div style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px', border:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <span style={{ fontSize:'16px' }}>📸</span>
            <span style={{ fontSize:'12px', fontWeight:600, color:'var(--blanc)' }}>Instagram</span>
          </div>
          <div style={{ fontSize:'10px', color:'var(--gris2)', marginBottom:'8px' }}>@blackthorntattoo_campos</div>
          {[{l:'Abonnés',v:'—'},{l:'Reach mois',v:'—'},{l:'Rendez-vous',v:'—'}].map(x=>(
            <div key={x.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--noir3)', fontSize:'12px' }}>
              <span style={{ color:'var(--gris)' }}>{x.l}</span>
              <span style={{ fontFamily:'var(--font-mono)', color:'var(--gris2)' }}>{x.v}</span>
            </div>
          ))}
          <div style={{ marginTop:'6px', fontSize:'10px', color:'var(--gris2)' }}>Mise à jour manuelle dans Métriques</div>
        </div>

        {/* Facebook Blackthorn */}
        <div style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px', border:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <span style={{ fontSize:'16px' }}>👥</span>
            <span style={{ fontSize:'12px', fontWeight:600, color:'var(--blanc)' }}>Facebook</span>
          </div>
          <div style={{ fontSize:'10px', color:'var(--gris2)', marginBottom:'8px' }}>blackthorntattoocampos</div>
          {[{l:'Abonnés',v:'—'},{l:'Vues page',v:'—'},{l:'Avis Google',v:'—'}].map(x=>(
            <div key={x.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--noir3)', fontSize:'12px' }}>
              <span style={{ color:'var(--gris)' }}>{x.l}</span>
              <span style={{ fontFamily:'var(--font-mono)', color:'var(--gris2)' }}>{x.v}</span>
            </div>
          ))}
          <div style={{ marginTop:'6px', fontSize:'10px', color:'var(--gris2)' }}>Mise à jour manuelle dans Métriques</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 3 : OBLIGATIONS FISCALES
      ══════════════════════════════════════════════ */}
      <div style={{ fontSize:'10px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>Obligations fiscales</div>

      {nextFiscal.map((f, i) => {
        const days = daysUntil(f.date)
        const isUrgent = days <= 30
        const borderColor = days <= 14 ? '#E24B4A' : days <= 30 ? '#E8A020' : 'var(--noir3)'
        return (
          <div key={i} style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:'8px', border:`1px solid ${borderColor}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:600 }}>{f.label}</div>
              <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>{f.periode}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:isUrgent?'#E8A020':'var(--gris)' }}>
                {new Date(f.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
              </div>
              <div style={{ fontSize:'10px', color:days<=14?'#E24B4A':days<=30?'#E8A020':'var(--gris2)', marginTop:'2px', fontWeight:days<=30?600:400 }}>
                {days === 0 ? "Aujourd'hui !" : `J-${days}`}
              </div>
            </div>
          </div>
        )
      })}

      {/* Provisions IVA + IRPF accumulés */}
      <div style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:'8px' }}>
        <div style={{ fontSize:'11px', color:'var(--gris)', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>Provisions accumulées</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          <div>
            <div style={{ fontSize:'10px', color:'var(--gris2)' }}>IRPF ce mois</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', color:'var(--jaune)' }}>{fmt(rMois.irpf)}</div>
          </div>
          <div>
            <div style={{ fontSize:'10px', color:'var(--gris2)' }}>IVA nette ce mois</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', color:'var(--jaune)' }}>{fmt(rMois.iva)}</div>
          </div>
        </div>
        <div style={{ fontSize:'10px', color:'var(--gris2)', marginTop:'8px', lineHeight:1.5 }}>
          À virer sur compte provision dès l'encaissement.
        </div>
      </div>

      {/* Rappel dépenses */}
      {depMois > 0 && (
        <div style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'10px 14px', fontSize:'12px', color:'var(--gris)' }}>
          Dépenses enregistrées ce mois : <span style={{ fontFamily:'var(--font-mono)', color:'var(--pierre)' }}>{fmt(depMois)}</span>
        </div>
      )}

    </div>
  )
}
