import React, { useState, useEffect, useCallback } from 'react'
import { notion, parsePaiement } from '../lib/notion'

const FIXES   = 956
const IVA_FL  = 150.47
const PERSO   = 1500

const calcFin = (ca) => {
  const matos = ca * 0.08
  const ben   = ca - FIXES - matos
  const irpf  = Math.max(0, Math.round(ben * 0.20))
  const ivaColl = Math.round(ca * 0.21)
  const ivaRecup = Math.round(IVA_FL + matos * 0.21)
  const ivaNette = Math.max(0, ivaColl - ivaRecup)
  const net   = Math.max(0, Math.round(ben - irpf - ivaNette))
  return { matos: Math.round(matos), ben: Math.round(ben), irpf, ivaColl, ivaRecup, ivaNette, net }
}

const fmt = (n, sign=false) => {
  const a=Math.abs(Math.round(n))
  const s=(n<0?'-':(sign&&n>0?'+':''))
  return s+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€')
}

const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const thisMonth = () => new Date().toISOString().substring(0,7)

// Ligne du tableau
function Row({ label, value, sub, color='var(--txt)', bold, indent, right, bg }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0',
      borderBottom:'1px solid var(--border)', background: bg||'transparent' }}>
      <span style={{ fontSize:'13px', color:indent?'var(--txt3)':'var(--txt2)', paddingLeft:indent?14:0, fontWeight:bold?600:400 }}>{label}</span>
      <div style={{ textAlign:'right' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:bold?'15px':'13px', color, fontWeight:bold?600:400 }}>{value}</span>
        {sub && <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'1px' }}>{sub}</div>}
      </div>
    </div>
  )
}

// Badge paiement
function PayBadge({ isCash }) {
  return (
    <span style={{ fontSize:'9px', padding:'2px 6px', borderRadius:'6px', fontWeight:700,
      background:isCash?'rgba(26,140,90,.1)':'rgba(41,128,185,.1)',
      color:isCash?'#1A8C5A':'#2980B9', whiteSpace:'nowrap' }}>
      {isCash?'CASH':'CARTE'}
    </span>
  )
}

export default function Comptabilite() {
  const [sessions,  setSessions]  = useState([])
  const [depenses,  setDepenses]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('resume')
  const [moisSelect,setMoisSelect]= useState(thisMonth())

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

  // Filtres par mois sélectionné
  const sessM = sessions.filter(s=>{
    const d=s.properties.Date?.date?.start||''
    const isAmely=(s.properties.Type?.select?.name||'').includes('Amely')
    return d.startsWith(moisSelect) && !isAmely
  })
  const depM = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(moisSelect))

  // Calculs CA
  const caMois    = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caCash    = sessM.filter(s=>parsePaiement(s)==='cash').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caCarte   = sessM.filter(s=>parsePaiement(s)!=='cash').reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbSess    = sessM.length

  // Calculs charges
  const totalDep  = depM.reduce((a,d)=>a+(d.properties.Montant?.number||0),0)
  const totalIvaRecup = depM.filter(d=>d.properties['IVA récupérable']?.checkbox).reduce((a,d)=>a+(d.properties['Montant IVA']?.number||0),0)

  // Financier
  const fin = calcFin(caMois)

  // IVA compte
  const ivaCollectee = fin.ivaColl
  const ivaRecuperee = fin.ivaRecup + totalIvaRecup
  const ivaARegler   = Math.max(0, ivaCollectee - ivaRecuperee)

  // Catégories dépenses
  const catDep = {}
  depM.forEach(d=>{
    const cat=d.properties.Catégorie?.select?.name||'Autre'
    const m=d.properties.Montant?.number||0
    catDep[cat]=(catDep[cat]||0)+m
  })

  // Disponible pour les mois passés
  const moisDisponibles = (() => {
    const set = new Set()
    sessions.forEach(s=>{ const d=s.properties.Date?.date?.start||''; if(d) set.add(d.substring(0,7)) })
    depenses.forEach(d=>{ const d2=d.properties.Date?.date?.start||''; if(d2) set.add(d2.substring(0,7)) })
    set.add(thisMonth())
    return [...set].sort().reverse().slice(0,12)
  })()

  const TABS = [
    { id:'resume', l:'Résumé P&L' },
    { id:'ca',     l:'CA détaillé' },
    { id:'charges',l:'Charges' },
    { id:'fiscal', l:'Fiscal' },
  ]

  return (
    <div style={{ padding:'20px 16px 90px', background:'var(--bg)', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:800 }}>Comptabilité</div>
        <button onClick={load} style={{ background:'none', border:'none', fontSize:'16px', color:'var(--txt3)', cursor:'pointer' }}>↻</button>
      </div>

      {/* Sélecteur de mois */}
      <div style={{ marginBottom:'16px' }}>
        <select value={moisSelect} onChange={e=>setMoisSelect(e.target.value)} style={{ fontFamily:'var(--font-head)', fontWeight:600, fontSize:'14px' }}>
          {moisDisponibles.map(m=>{
            const [y,mo]=m.split('-')
            return <option key={m} value={m}>{MOIS_LABELS[parseInt(mo)-1]} {y}</option>
          })}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'18px', overflowX:'auto', paddingBottom:'2px' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flexShrink:0, padding:'8px 14px', borderRadius:'20px', fontSize:'12px', cursor:'pointer',
            background:tab===t.id?'var(--txt)':'var(--card)',
            color:tab===t.id?'var(--bg)':'var(--txt2)',
            border:tab===t.id?'none':'1px solid var(--border2)',
            fontFamily:'var(--font-head)', fontWeight:600, transition:'all .2s',
            boxShadow:tab===t.id?'var(--shadow)':'none'
          }}>{t.l}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:'40px', color:'var(--txt3)', fontSize:'13px' }}>Chargement...</div>}

      {/* ── RÉSUMÉ P&L ─────────────────────────────── */}
      {!loading && tab==='resume' && (
        <div>
          {/* Résultat net en grand */}
          <div className="card" style={{ textAlign:'center', padding:'20px', marginBottom:'16px',
            borderColor: fin.net>=PERSO?'rgba(26,140,90,.3)':'rgba(192,57,43,.3)',
            background: fin.net>=PERSO?'rgba(26,140,90,.03)':'rgba(192,57,43,.03)' }}>
            <div style={{ fontSize:'11px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Résultat net du mois</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'36px', fontWeight:500, color:fin.net>=PERSO?'#1A8C5A':'#C0392B' }}>
              {fmt(fin.net)}
            </div>
            <div style={{ fontSize:'12px', color:'var(--txt3)', marginTop:'6px' }}>
              {fin.net>=PERSO
                ? `✅ Charges couvertes — ${fmt(fin.net-PERSO)} dispo`
                : `⚠️ Déficit de ${fmt(PERSO-fin.net)}`}
            </div>
          </div>

          {/* P&L complet */}
          <div className="card" style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, padding:'4px 0 8px' }}>ENTRÉES</div>
            <Row label="CA total HT" value={fmt(caMois)} bold color={caMois>0?'#1A8C5A':'var(--txt3)'} />
            <Row label="↳ Cash" value={fmt(caCash)} indent sub={nbSess>0?`${Math.round(caCash/caMois*100||0)}%`:undefined} />
            <Row label="↳ Carte / virement" value={fmt(caCarte)} indent sub={nbSess>0?`${Math.round(caCarte/caMois*100||0)}%`:undefined} />

            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, padding:'12px 0 8px' }}>CHARGES OPÉRATIONNELLES</div>
            <Row label="Loyer + RETA (fixes)" value={`-${fmt(FIXES)}`} />
            <Row label="Matériel ~8% CA" value={`-${fmt(fin.matos)}`} />
            <Row label="Bénéfice brut" value={fmt(fin.ben)} bold color={fin.ben>0?'var(--txt)':'#C0392B'} />

            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, padding:'12px 0 8px' }}>IMPÔTS</div>
            <Row label="IRPF (20% bénéfice)" value={`-${fmt(fin.irpf)}`} color='#D4820A' sub="→ provision" />
            <Row label="IVA collectée" value={fmt(fin.ivaColl)} color='var(--txt3)' />
            <Row label="IVA récupérable" value={`-${fmt(fin.ivaRecup)}`} color='var(--txt3)' indent />
            <Row label="IVA nette à reverser" value={`-${fmt(fin.ivaNette)}`} color='#D4820A' bold sub="→ provision" />

            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, padding:'12px 0 8px' }}>RÉSULTAT</div>
            <Row label="Net disponible" value={fmt(fin.net)} bold color={fin.net>=PERSO?'#1A8C5A':'#C0392B'} />
            <Row label="Charges ménage" value="-1 500€" />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0 4px', borderTop:'1px solid var(--border)', marginTop:'4px' }}>
              <span style={{ fontSize:'14px', fontWeight:700 }}>Dispo libre</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:700, color:fin.net-PERSO>=0?'#1A8C5A':'#C0392B' }}>
                {fmt(fin.net-PERSO, true)}
              </span>
            </div>
          </div>

          {/* Cash vs Carte */}
          <div className="card" style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'10px' }}>Répartition paiements</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {[
                { l:'💵 Cash', v:caCash, pct:caMois>0?Math.round(caCash/caMois*100):0, c:'#1A8C5A' },
                { l:'💳 Carte', v:caCarte, pct:caMois>0?Math.round(caCarte/caMois*100):0, c:'#2980B9' }
              ].map(x=>(
                <div key={x.l} style={{ textAlign:'center', padding:'10px', background:'var(--bg)', borderRadius:'var(--r)' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:x.c, marginBottom:'4px' }}>{x.l}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:500 }}>{fmt(x.v)}</div>
                  <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'2px' }}>{x.pct}%</div>
                  <div style={{ height:'4px', background:'var(--border)', borderRadius:'2px', marginTop:'6px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:x.pct+'%', background:x.c, borderRadius:'2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CA DÉTAILLÉ ─────────────────────────────── */}
      {!loading && tab==='ca' && (
        <div>
          {/* Synthèse */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
            {[
              { l:'Sessions', v:nbSess, unit:'' },
              { l:'CA total', v:fmt(caMois), unit:'' },
              { l:'Panier moyen', v:nbSess>0?Math.round(caMois/nbSess)+'€':'—', unit:'' },
            ].map(x=>(
              <div key={x.l} className="card" style={{ textAlign:'center', padding:'10px 6px' }}>
                <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', marginBottom:'4px' }}>{x.l}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:500 }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Sources */}
          {(() => {
            const srcCount = {}
            sessM.forEach(s => {
              const src = s.properties.Source?.select?.name || '—'
              srcCount[src] = (srcCount[src]||0) + (s.properties.Prix?.number||0)
            })
            const entries = Object.entries(srcCount).sort(([,a],[,b])=>b-a)
            if(entries.length===0||entries.every(([k])=>k==='—')) return null
            return (
              <div className="card" style={{marginBottom:'12px'}}>
                <div style={{fontSize:'10px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:600,marginBottom:'8px'}}>Origine des clients</div>
                {entries.filter(([k])=>k!=='—').map(([src,ca])=>(
                  <div key={src} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:'12px',color:'var(--txt2)'}}>{src}</span>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{height:'4px',width:Math.round((ca/caMois)*60)+'px',background:'var(--pierre)',borderRadius:'2px'}}/>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',fontWeight:500}}>{fmt(ca)}</span>
                      <span style={{fontSize:'10px',color:'var(--txt3)'}}>{Math.round(ca/caMois*100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Liste des sessions */}
          {sessM.length === 0
            ? <div style={{ textAlign:'center', padding:'40px 0', color:'var(--txt3)', fontSize:'13px' }}>Aucune session ce mois</div>
            : sessM.sort((a,b)=>(b.properties.Date?.date?.start||'').localeCompare(a.properties.Date?.date?.start||'')).map(s => {
              const ca     = s.properties.Prix?.number||0
              const date   = s.properties.Date?.date?.start||''
              const notes  = s.properties.Notes?.rich_text?.[0]?.plain_text||''
              const type   = s.properties.Type?.select?.name||''
              const isCash = parsePaiement(s)==='cash'
              return (
                <div key={s.id} className="card" style={{ marginBottom:'8px', padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                        <span style={{ fontSize:'13px', fontWeight:600 }}>{date}</span>
                        <PayBadge isCash={isCash} />
                      </div>
                      {notes && <div style={{ fontSize:'11px', color:'var(--txt3)' }}>{notes}</div>}
                      {type && <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'2px' }}>{type}</div>}
                    </div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:600, color:ca>=156?'#1A8C5A':'var(--txt)' }}>
                      {ca}€
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── CHARGES ─────────────────────────────────── */}
      {!loading && tab==='charges' && (
        <div>
          {/* Synthèse */}
          <div className="card" style={{ marginBottom:'14px', padding:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', textAlign:'center' }}>
              {[
                { l:'Total charges', v:fmt(totalDep+FIXES), c:'#C0392B' },
                { l:'Dépenses saisies', v:fmt(totalDep), c:'var(--txt)' },
                { l:'IVA récup.', v:fmt(totalIvaRecup), c:'#1A8C5A' },
              ].map(x=>(
                <div key={x.l} style={{ padding:'8px', background:'var(--bg)', borderRadius:'var(--r)' }}>
                  <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', marginBottom:'4px', lineHeight:1.3 }}>{x.l}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'16px', fontWeight:500, color:x.c }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixes */}
          <div className="card" style={{ marginBottom:'10px' }}>
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'8px' }}>Charges fixes (mensuelles)</div>
            {[{l:'Loyer studio TTC',v:'867€'},{l:'RETA Tony',v:'89€'}].map(r=>(
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
                <span style={{ color:'var(--txt2)' }}>{r.l}</span>
                <span style={{ fontFamily:'var(--font-mono)', color:'#C0392B' }}>-{r.v}</span>
              </div>
            ))}
          </div>

          {/* Par catégorie */}
          {Object.keys(catDep).length > 0 && (
            <div className="card" style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'8px' }}>Par catégorie</div>
              {Object.entries(catDep).sort(([,a],[,b])=>b-a).map(([cat,val])=>(
                <div key={cat} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px', alignItems:'center' }}>
                  <span style={{ color:'var(--txt2)' }}>{cat}</span>
                  <span style={{ fontFamily:'var(--font-mono)', color:'#C0392B' }}>-{fmt(val)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Liste dépenses */}
          <div className="section-title">Toutes les dépenses</div>
          {depM.length === 0
            ? <div style={{ textAlign:'center', padding:'30px 0', color:'var(--txt3)', fontSize:'13px' }}>Aucune dépense enregistrée</div>
            : depM.sort((a,b)=>(b.properties.Date?.date?.start||'').localeCompare(a.properties.Date?.date?.start||'')).map(d => {
              const m2  = d.properties.Montant?.number||0
              const cat = d.properties.Catégorie?.select?.name||''
              const date= d.properties.Date?.date?.start||''
              const four= d.properties.Fournisseur?.rich_text?.[0]?.plain_text||''
              const ivaR= d.properties['IVA récupérable']?.checkbox
              const ivaM= d.properties['Montant IVA']?.number||0
              const par = d.properties['Saisi par']?.select?.name||''
              return (
                <div key={d.id} className="card" style={{ marginBottom:'8px', padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'12px', fontWeight:600 }}>{date}</span>
                        <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'6px', background:'var(--bg2)', color:'var(--txt3)', fontWeight:600 }}>{cat.replace(/^[^\s]+ /,'')}</span>
                        {par && <span style={{ fontSize:'10px', color:'var(--txt3)' }}>{par}</span>}
                      </div>
                      {four && <div style={{ fontSize:'11px', color:'var(--txt2)' }}>{four}</div>}
                      {ivaR && <div style={{ fontSize:'10px', color:'#1A8C5A', marginTop:'2px' }}>IVA récup. {fmt(ivaM)}</div>}
                    </div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'16px', fontWeight:600, color:'#C0392B', flexShrink:0, marginLeft:'12px' }}>
                      -{fmt(m2)}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── FISCAL ──────────────────────────────────── */}
      {!loading && tab==='fiscal' && (
        <div>
          {/* IVA */}
          <div className="card" style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'10px' }}>Tableau IVA</div>
            {[
              { l:'IVA collectée (CA × 21%)', v:fmt(ivaCollectee), c:'#C0392B' },
              { l:'IVA récupérable (loyer + charges)', v:`-${fmt(ivaRecuperee)}`, c:'#1A8C5A' },
              { l:'IVA nette à reverser', v:fmt(ivaARegler), c:'#D4820A', bold:true },
              { l:'IVA trimestrielle estimée (×3)', v:fmt(ivaARegler*3), c:'#D4820A', bold:true },
            ].map(r=>(
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:'12px', color:'var(--txt2)' }}>{r.l}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:r.bold?'15px':'13px', fontWeight:r.bold?700:400, color:r.c }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* IRPF */}
          <div className="card" style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'10px' }}>IRPF — Modelo 130</div>
            {[
              { l:'Bénéfice brut', v:fmt(fin.ben) },
              { l:'IRPF mensuel (20%)', v:fmt(fin.irpf), bold:true, c:'#D4820A' },
              { l:'IRPF trimestriel (×3)', v:fmt(fin.irpf*3), bold:true, c:'#D4820A' },
            ].map(r=>(
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:'12px', color:'var(--txt2)' }}>{r.l}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:r.bold?'15px':'13px', fontWeight:r.bold?700:400, color:r.c||'var(--txt)' }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Échéances */}
          <div className="card">
            <div style={{ fontSize:'10px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'10px' }}>Échéances 2026</div>
            {[
              { d:'2026-07-20', l:'Modelo 303 + 130 — T2', p:'Avr-Juin 2026' },
              { d:'2026-10-20', l:'Modelo 303 + 130 — T3', p:'Jul-Sep 2026' },
              { d:'2027-01-30', l:'Modelo 303 + 130 — T4', p:'Oct-Déc 2026' },
              { d:'2026-10-31', l:'Renta IRPF 2025', p:'Déclaration annuelle' },
            ].map((e,i)=>{
              const days=Math.round((new Date(e.d)-new Date())/86400000)
              const isPast=days<0
              const isUrgent=days>=0&&days<=30
              return (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:'12px', fontWeight:600, color:isPast?'var(--txt3)':'var(--txt)' }}>{e.l}</div>
                    <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'1px' }}>{e.p}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'11px', fontFamily:'var(--font-mono)', color:isPast?'var(--txt3)':'var(--txt2)' }}>
                      {new Date(e.d).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                    </div>
                    <div style={{ fontSize:'10px', fontWeight:600, marginTop:'2px',
                      color:isPast?'var(--txt3)':days<=14?'#C0392B':isUrgent?'#D4820A':'#1A8C5A' }}>
                      {isPast?'Passé':days===0?"Aujourd'hui !":`J-${days}`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
