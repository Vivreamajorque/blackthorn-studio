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
  useEffect(() => { load() }, [load])

  // ── CALCULS CA ─────────────────────────────────────
  const m   = thisMonth()
  const ws  = weekStart()

  const sessActifs = sessions.filter(s => !(s.properties.Type?.select?.name||'').includes('Amely'))

  const caMois    = sessActifs.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caSemaine = sessActifs.filter(s=>(s.properties.Date?.date?.start||'') >= ws).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  // CA annuel (tous depuis juin 2026)
  const caAnnee = sessActifs.reduce((a,s)=>{
    const d = s.properties.Date?.date?.start||''
    return d >= '2026-06-01' ? a + (s.properties.Prix?.number||0) : a
  }, 0)

  // Revenus Amely ce mois
  const caAmely = sessions.filter(s=>(s.properties.Type?.select?.name||'').includes('Amely') && (s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  const caTotal = caMois + caAmely
  const rMois   = netReel(caTotal)

  // Dépenses mois
  const depMois = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)

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
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{ height:'40px', filter:'invert(1) sepia(1) saturate(0.3) brightness(0.85)', opacity:0.85 }} />
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
          SECTION 2 : RÉSEAUX SOCIAUX
      ══════════════════════════════════════════════ */}
      <div style={{ fontSize:'10px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'2px', fontWeight:600, marginBottom:'10px' }}>Réseaux sociaux</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
        {/* TikTok */}
        <div style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px', border:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <span style={{ fontSize:'16px' }}>🎵</span>
            <span style={{ fontSize:'12px', fontWeight:600, color:'var(--blanc)' }}>TikTok</span>
            <span style={{ fontSize:'10px', color:'var(--gris)', marginLeft:'auto' }}>@amelymallorcaraw</span>
          </div>
          {[{l:'Followers',v:'~1 000'},{l:'Vues 30j',v:'34k'},{l:'Complétion',v:'30%'}].map(x=>(
            <div key={x.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--noir3)', fontSize:'12px' }}>
              <span style={{ color:'var(--gris)' }}>{x.l}</span>
              <span style={{ fontFamily:'var(--font-mono)', color:'var(--blanc)' }}>{x.v}</span>
            </div>
          ))}
          <div style={{ marginTop:'6px', fontSize:'10px', color:'var(--gris2)', lineHeight:1.4 }}>Plan 90j — J{Math.ceil((new Date('2026-09-02')-today)/86400000)} restants</div>
        </div>

        {/* Instagram */}
        <div style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px', border:'1px solid var(--noir3)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <span style={{ fontSize:'16px' }}>📸</span>
            <span style={{ fontSize:'12px', fontWeight:600, color:'var(--blanc)' }}>Instagram</span>
            <span style={{ fontSize:'10px', color:'var(--gris)', marginLeft:'auto' }}>@amely_mallorca_raw</span>
          </div>
          {[{l:'Followers',v:'~385'},{l:'Meilleur reel',v:'267k'},{l:'Public cible',v:'Touristes'}].map(x=>(
            <div key={x.l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--noir3)', fontSize:'12px' }}>
              <span style={{ color:'var(--gris)' }}>{x.l}</span>
              <span style={{ fontFamily:'var(--font-mono)', color:'var(--blanc)' }}>{x.v}</span>
            </div>
          ))}
          <div style={{ marginTop:'6px', fontSize:'10px', color:'var(--gris2)' }}>73% femmes · 74% France</div>
        </div>
      </div>

      {/* Blackthorn RS */}
      <div style={{ background:'var(--noir2)', borderRadius:'var(--r)', padding:'12px', border:'1px solid var(--noir3)', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
          <span style={{ fontSize:'16px' }}>🖤</span>
          <span style={{ fontSize:'12px', fontWeight:600, color:'var(--blanc)' }}>Blackthorn Tattoo</span>
          <span style={{ fontSize:'10px', color:'var(--gris)', marginLeft:'auto' }}>@blackthorntattoo_campos</span>
        </div>
        <div style={{ fontSize:'11px', color:'var(--gris2)' }}>
          Profil Instagram + Facebook — présence locale Campos/Mallorca
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
