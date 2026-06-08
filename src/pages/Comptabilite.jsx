import React, { useState, useEffect, useCallback } from 'react'
import { notion, parsePaiement } from '../lib/notion'

// ── MODÈLE RÉEL : IRPF 20% + IVA nette ──────────────
const FIXES    = 956      // loyer 867 + RETA 89
const MATOS    = 0.08
const IVA_FL   = 150.47   // IVA loyer récupérable
const PERSO    = 1500
const PROV_MOIS = 1057

const calcNet = (ca) => {
  const matos   = ca * MATOS
  const ben     = ca - FIXES - matos
  const irpf    = Math.max(0, ben * 0.20)
  const iva_net = Math.max(0, ca * 0.21 - IVA_FL - matos * 0.21)
  return {
    matos : Math.round(matos),
    ben   : Math.round(ben),
    irpf  : Math.round(irpf),
    iva   : Math.round(iva_net),
    net   : Math.max(0, Math.round(ben - irpf - iva_net)),
    dispo : Math.max(0, Math.round(ben - irpf - iva_net)) - PERSO
  }
}

const fmt  = n => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }
const fmts = n => (n>=0?'+':'')+fmt(n)

const thisMonth = () => new Date().toISOString().substring(0,7)

// ── SAISIE REVENU AMELY ──────────────────────────────
function SaisieRevenu({ onSaved }) {
  const [form, setForm] = useState({ montant:'', source:'VAM', date:new Date().toISOString().split('T')[0], notes:'' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const SOURCES = ['VAM','La Ligne','Consultation','Autre']

  const submit = async () => {
    if (!form.montant) return
    setSaving(true)
    try {
      await notion.addSession({
        session: `Amely · ${form.date} · ${form.montant}€`,
        type: '💚 Revenu Amely',
        client:'', natio:'—', style:'', paiement:'cash',
        prix: parseFloat(form.montant), acompte:0, solde: parseFloat(form.montant),
        notes: `${form.source}${form.notes ? ' — ' + form.notes : ''}`, date: form.date, avis: false
      })
      setToast('✓ Revenu enregistré')
      setForm({ montant:'', source:'VAM', date:new Date().toISOString().split('T')[0], notes:'' })
      setTimeout(() => { setToast(''); onSaved && onSaved() }, 1500)
    } catch(e) { setToast('Erreur') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
        <div className="form-group" style={{ margin:0 }}>
          <label>Montant (€ HT)</label>
          <input type="number" inputMode="decimal" placeholder="0"
            value={form.montant} onChange={e=>setForm({...form,montant:e.target.value})}
            style={{ fontSize:'20px', textAlign:'center', fontFamily:'var(--font-mono)' }} />
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label>Source</label>
          <select value={form.source} onChange={e=>setForm({...form,source:e.target.value})}>
            {SOURCES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginBottom:'10px' }}>
        <label>Date</label>
        <input type="date" min="2026-06-01" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
      </div>
      <div className="form-group" style={{ marginBottom:'14px' }}>
        <label>Notes</label>
        <input placeholder="Client, projet..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={saving||!form.montant} style={{ width:'100%', padding:'14px' }}>
        {saving ? 'Enregistrement...' : '+ Ajouter mon revenu'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── SIMULATEUR P&L ───────────────────────────────────
function PLSimulateur({ ca }) {
  const r = calcNet(ca)
  const pct = Math.min(100, Math.round((ca / 3895) * 100))
  const label = r.net >= PERSO + PROV_MOIS
    ? { t:`✅ Équilibre + réserve hiver`, c:'var(--vert)' }
    : r.net >= PERSO
    ? { t:`✅ Charges couvertes — ${fmts(r.dispo)} libre`, c:'var(--jaune)' }
    : { t:`⚠️ Déficit — manque ${fmt(PERSO-r.net)}`, c:'var(--rouge)' }

  return (
    <div>
      <div style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:'14px', borderLeft:`3px solid ${label.c}` }}>
        <div style={{ fontSize:'13px', color:label.c, fontWeight:600 }}>{label.t}</div>
      </div>
      <div style={{ marginBottom:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
          <span style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px' }}>vs équilibre (156€/j)</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--pierre)' }}>{pct}%</span>
        </div>
        <div style={{ height:'7px', background:'var(--noir3)', borderRadius:'4px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:r.net>=PERSO?'var(--vert)':pct>70?'var(--jaune)':'var(--rouge)', borderRadius:'4px', transition:'width .4s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'10px', color:'var(--gris2)' }}>
          <span>0€</span><span>Équilibre 3 895€</span>
        </div>
      </div>
      <div className="card" style={{ marginBottom:'10px' }}>
        {[
          { l:`CA HT  (${Math.round(ca/25)}€/j × 25j)`,        v:fmt(ca),            c:'var(--vert)' },
          { l:'Charges (fixes 956€ + matos 8%)',                v:`-${fmt(FIXES+r.matos)}`, c:'var(--gris)' },
          { l:'Bénéfice brut',                                  v:r.ben>0?fmt(r.ben):`-${fmt(Math.abs(r.ben))}`, c:r.ben>=0?'var(--pierre)':'var(--rouge)' },
          { l:'IRPF (20%)',                                     v:`-${fmt(r.irpf)}`,  c:'var(--jaune)' },
          { l:'IVA nette à reverser',                           v:`-${fmt(r.iva)}`,   c:'var(--jaune)' },
          { l:'Net disponible',                                 v:fmt(r.net),         c:r.net>=PERSO?'var(--vert)':'var(--rouge)', bold:true },
          { l:'Charges ménage',                                 v:`-${PERSO}€`,       c:'var(--gris)' },
          { l:'Dispo libre',                                    v:fmts(r.dispo),      c:r.dispo>=0?'var(--vert)':'var(--rouge)', bold:true },
        ].map(row=>(
          <div key={row.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:row.bold?'14px':'13px', color:row.c, fontWeight:row.bold?700:400 }}>{row.v}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-title">IVA — Modelo 303</div>
        {[
          { l:`Collecté (${fmt(ca)} × 21%)`, v:fmt(Math.round(ca*0.21)) },
          { l:'Nette trimestrielle (× 3)', v:fmt(r.iva*3), bold:true },
        ].map(row=>(
          <div key={row.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:row.bold?'var(--rouge)':'var(--blanc)', fontWeight:row.bold?700:400 }}>{row.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PAGE PRINCIPALE ──────────────────────────────────
export default function Comptabilite() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [caInput, setCaInput]   = useState('')
  const [tab, setTab]           = useState('amelys')   // amelys | simulateur | charges | fiscal

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await notion.getSessions()
      if (s.results) setSessions(s.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const m      = thisMonth()
  // Séparer revenus Tony vs Amely
  const sessM  = sessions.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const tonyM  = sessM.filter(s=>(s.properties.Type?.select?.name||'').includes('Tony')||(s.properties.Type?.select?.name||'').includes('Tattoo')||(!(s.properties.Type?.select?.name||'').includes('Amely')))
  const amelyM = sessM.filter(s=>(s.properties.Type?.select?.name||'').includes('Amely'))
  const caTony  = tonyM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caAmely = amelyM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caTotal = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  const TABS = [
    { id:'amelys', label:'Mon revenu' },
    { id:'simulateur', label:'Simulateur' },
    { id:'charges', label:'Charges' },
    { id:'fiscal', label:'Fiscal' },
  ]

  return (
    <div style={{ padding:'24px 16px 8px' }}>
      <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700, marginBottom:'16px' }}>Comptabilité</div>

      {/* Seuils */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
        {[
          { l:'Équilibre mensuel', v:'156€/j', c:'var(--jaune)' },
          { l:'Tenir l\'hiver', v:'234€/j', c:'var(--pierre)' },
          { l:'Confort', v:'300€/j', c:'var(--vert)' },
        ].map(s=>(
          <div key={s.l} style={{ background:'var(--noir2)', border:`1px solid ${s.c}33`, borderRadius:'var(--r)', padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', marginBottom:'4px', lineHeight:1.3 }}>{s.l}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'17px', color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Revenus mois courant */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
        {[
          { l:'Tony mois', v:loading?'...':Math.round(caTony)+'€', c:'var(--pierre)' },
          { l:'Amely mois', v:loading?'...':Math.round(caAmely)+'€', c:'#2ecc71' },
          { l:'Total', v:loading?'...':Math.round(caTotal)+'€', c:'var(--blanc)' },
        ].map(s=>(
          <div key={s.l} className="stat-card" style={{ textAlign:'center' }}>
            <div className="label">{s.l}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', color:s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', overflowX:'auto' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flexShrink:0, padding:'8px 12px', borderRadius:'var(--r)', fontSize:'11px',
            background:tab===t.id?'var(--pierre)':'var(--noir2)',
            color:tab===t.id?'var(--noir)':'var(--gris)',
            border:tab===t.id?'none':'1px solid var(--noir3)',
            fontFamily:'var(--font-head)', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      {/* MON REVENU */}
      {tab === 'amelys' && (
        <div>
          <div style={{ fontSize:'12px', color:'var(--gris)', marginBottom:'16px', lineHeight:1.6 }}>
            Saisis ici tes revenus VAM, La Ligne, consultations. Ils apparaissent dans le hub et les métriques.
          </div>
          <SaisieRevenu onSaved={load} />
          {amelyM.length > 0 && (
            <div style={{ marginTop:'16px' }}>
              <div className="section-title">Mes revenus ce mois</div>
              {amelyM.map(s=>{
                const prix = s.properties.Prix?.number||0
                const date = s.properties.Date?.date?.start||''
                const type = s.properties.Type?.select?.name||''
                return (
                  <div key={s.id} className="card" style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px', padding:'10px 14px' }}>
                    <div>
                      <div style={{ fontSize:'12px' }}>{type.replace('💚 Revenu Amely — ','')}</div>
                      <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>{date}</div>
                    </div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'16px', color:'#2ecc71' }}>{prix}€</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SIMULATEUR */}
      {tab === 'simulateur' && (
        <div>
          <div className="form-group">
            <label>CA Tony ce mois (€ HT)</label>
            <input type="number" placeholder="3895" value={caInput}
              onChange={e=>setCaInput(e.target.value)}
              style={{ fontSize:'22px', textAlign:'center', fontFamily:'var(--font-mono)' }} />
          </div>
          <PLSimulateur ca={parseFloat(caInput)||3895} />
        </div>
      )}

      {/* CHARGES */}
      {tab === 'charges' && (
        <div>
          <div className="card" style={{ marginBottom:'12px' }}>
            <div style={{ fontSize:'12px', color:'var(--gris)', lineHeight:1.8 }}>
              <strong style={{ color:'var(--rouge)' }}>Fixes (dues même à 0 CA) :</strong> loyer 867€ + RETA 89€ = <strong style={{ color:'var(--pierre)' }}>956€/mois</strong><br/>
              <strong style={{ color:'var(--gris)' }}>Variables :</strong> matériel ~8% du CA
            </div>
          </div>
          <div className="card">
            <div className="section-title">Net selon panier (Tony seul, IRPF+IVA)</div>
            {[100,123,150,156,200,234,250,300,350,400].map(pm=>{
              const r=calcNet(pm*25)
              const icon=r.dispo>=PROV_MOIS?'✅':r.dispo>=0?'🟡':'🔴'
              return (
                <div key={pm} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)', alignItems:'center' }}>
                  <div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px' }}>{pm}€/j</span>
                    {pm===156&&<span style={{ fontSize:'9px', color:'var(--jaune)', marginLeft:'6px' }}>équil.</span>}
                    {pm===234&&<span style={{ fontSize:'9px', color:'var(--pierre)', marginLeft:'6px' }}>hiver</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:r.dispo>=0?'var(--vert)':'var(--rouge)' }}>
                      {r.dispo>=0?'+':''}{Math.round(r.dispo)}€
                    </span>
                    <span>{icon}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FISCAL */}
      {tab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {[{p:'T2 (avr-juin)',d:'20 juillet'},{p:'T3 (juil-sept)',d:'20 octobre'},{p:'T4 (oct-déc)',d:'30 janv. 2027'}].map((t,i)=>(
            <div key={i} className="card" style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600 }}>Modelo 303 + 130</div>
                <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>{t.p}</div>
              </div>
              <span className="tag tag-warn">{t.d}</span>
            </div>
          ))}
          <div className="card" style={{ marginTop:'8px' }}>
            <div className="section-title">Hiver (déc+jan = 0€ CA)</div>
            <div style={{ fontSize:'13px', color:'var(--gris)', lineHeight:1.9 }}>
              Loyer 867€ + RETA 89€ + ménage 1 500€<br/>
              = <strong style={{ color:'var(--rouge)' }}>2 456€/mois × 2 = 4 912€</strong><br/>
              Réserve à constituer : <strong style={{ color:'var(--pierre)' }}>5 285€</strong><br/>
              Mettre de côté en été : <strong style={{ color:'var(--pierre)' }}>1 057€/mois</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
