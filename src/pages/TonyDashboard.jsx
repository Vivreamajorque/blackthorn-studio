import React, { useState, useEffect, useRef, useCallback } from 'react'
import { notion } from '../lib/notion'

// ── CONSTANTES ───────────────────────────────────────
const OBJ_JOUR   = 156   // équilibre mensuel réel (IRPF+IVA)
const OBJ_HIVER  = 234   // tenir l'hiver
const FIXES      = 956
const MATOS      = 0.08
const IVA_FL     = 150.47
const PERSO      = 1500
const PROV_MOIS  = 1057

const calcNet = (ca) => {
  const matos = ca * MATOS
  const ben   = ca - FIXES - matos
  const irpf  = Math.max(0, Math.round(ben * 0.20))
  const iva   = Math.max(0, Math.round(ca * 0.21 - IVA_FL - matos * 0.21))
  const net   = Math.max(0, Math.round(ben - irpf - iva))
  return { net, irpf, iva, ben: Math.round(ben), dispo: net - PERSO }
}

const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => new Date().toISOString().substring(0,7)
const fmtE = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }

const CATS = ['🖊️ Matériel tatouage','🧴 Consommables','📱 Marketing','🔧 Équipement','🏠 Charges fixes','🚗 Déplacements','📦 Autre']

export default function TonyDashboard({ onLogout }) {
  const [tab,       setTab]       = useState('home')
  const [sessions,  setSessions]  = useState([])
  const [depenses,  setDepenses]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState('')
  const fileRef = useRef(null)

  // Form CA
  const [caForm, setCaForm] = useState({
    ca: '', sessions: '1', paiement: 'cash', notes: '', date: todayStr()
  })
  const [caSaving, setCaSaving] = useState(false)

  // Form Dépense
  const [depForm, setDepForm] = useState({
    montant: '', fournisseur: '', categorie: '🖊️ Matériel tatouage',
    date: todayStr(), notes: '', iva_recuperable: true
  })
  const [depSaving, setDepSaving] = useState(false)
  const [photo, setPhoto]         = useState(null)
  const [editing, setEditing]     = useState(null)   // { id, ca, paiement, date, notes }
  const [editSaving, setEditSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    try {
      const [s,d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // ── Calculs stats ──────────────────────────────────
  const m   = thisMonth()
  const td  = todayStr()
  const sessM = sessions.filter(s => (s.properties.Date?.date?.start||'').startsWith(m) &&
    !(s.properties.Type?.select?.name||'').includes('Amely'))
  const caMois = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caJour = sessions.filter(s=>s.properties.Date?.date?.start===td && !(s.properties.Type?.select?.name||'').includes('Amely'))
    .reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  const r = calcNet(caMois)
  const depMois = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m))
    .reduce((a,d)=>a+(d.properties.Montant?.number||0),0)

  const status = r.net >= PERSO + PROV_MOIS ? '✅' : r.net >= PERSO ? '🟡' : '🔴'
  const isMonth = new Date().getMonth() + 1
  const isEte   = isMonth >= 6 && isMonth <= 10

  // ── Submit Edit ────────────────────────────────────
  const submitEdit = async () => {
    if (!editing?.ca) return
    setEditSaving(true)
    try {
      await notion.updateSession(editing.id, {
        prix: parseFloat(editing.ca), paiement: editing.paiement || 'cash',
        date: editing.date, notes: editing.notes, type: '🖤 Tattoo Tony', natio: 'Autre'
      })
      showToast('✓ Modifié')
      setEditing(null)
      load()
    } catch(e) { showToast('Erreur — réessaie') }
    setEditSaving(false)
  }

  const submitDelete = async (pageId) => {
    try {
      await notion.deleteSession(pageId)
      showToast('Supprimé')
      load()
    } catch(e) { showToast('Erreur') }
  }

  // ── Submit CA ──────────────────────────────────────
  const submitCA = async () => {
    if (!caForm.ca) return
    setCaSaving(true)
    try {
      await notion.addSession({
        session: `Tony · ${caForm.date} · ${caForm.ca}€`,
        type: '🖤 Tattoo Tony',
        client: '', natio: '—',
        style: caForm.notes,
        prix: parseFloat(caForm.ca) || 0,
        acompte: 0,
        solde: parseFloat(caForm.ca) || 0,
        paiement: caForm.paiement || 'cash',
        notes: `${caForm.sessions} session(s)${caForm.notes ? ' · '+caForm.notes : ''}`,
        date: caForm.date,
        avis: false
      })
      showToast(parseFloat(caForm.ca) >= OBJ_JOUR ? '🔥 Objectif atteint !' : '✓ CA enregistré')
      setCaForm({ ca:'', sessions:'1', paiement:'cash', notes:'', date:todayStr() })
      setTab('home')
      load()
    } catch(e) { showToast('Erreur: ' + (e.message||JSON.stringify(e)).substring(0,80)) }
    setCaSaving(false)
  }

  // ── Submit Dépense ─────────────────────────────────
  const submitDep = async () => {
    if (!depForm.montant) return
    setDepSaving(true)
    try {
      await notion.addDepense({ ...depForm, saisi_par: 'Tony' })
      showToast('✓ Dépense enregistrée')
      setDepForm({ montant:'', fournisseur:'', categorie:'🖊️ Matériel tatouage', date:todayStr(), notes:'', iva_recuperable:true })
      setPhoto(null)
      setTab('home')
      load()
    } catch(e) { showToast('Erreur: ' + (e.message||JSON.stringify(e)).substring(0,80)) }
    setDepSaving(false)
  }

  // ── Analyse photo ──────────────────────────────────
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzing(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setPhoto(ev.target.result)
      try {
        const res = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType: file.type })
        })
        const data = await res.json()
        if (!data.manual && data.montant) {
          setDepForm(f => ({
            ...f,
            montant: data.montant?.toString() || f.montant,
            fournisseur: data.fournisseur || f.fournisseur,
            categorie: CATS.find(c => c.toLowerCase().includes((data.categorie||'').toLowerCase().split(' ')[0])) || f.categorie,
            date: data.date || f.date,
            notes: data.description || f.notes,
          }))
          showToast('✓ Ticket analysé')
        } else {
          showToast('Saisis manuellement')
        }
      } catch(e) { showToast('Saisis manuellement') }
      setAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // ══════════════════════════════════════════════════
  // RENDU TABS
  // ══════════════════════════════════════════════════

  // ── SAISIE CA ──────────────────────────────────────
  if (tab === 'ca') return (
    <div style={{ padding:'28px 20px', minHeight:'100vh' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700 }}>Mon CA du jour</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{ padding:'6px 14px', fontSize:'12px' }}>← Retour</button>
      </div>

      {/* Grand chiffre CA */}
      <div style={{ textAlign:'center', marginBottom:'20px' }}>
        <div style={{ fontSize:'12px', color:'var(--gris)', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>CA encaissé (€ HT)</div>
        <input type="number" inputMode="decimal" placeholder="0"
          value={caForm.ca} onChange={e=>setCaForm({...caForm,ca:e.target.value})}
          style={{ fontSize:'52px', fontFamily:'var(--font-mono)', fontWeight:500, textAlign:'center', background:'transparent', border:'none', borderBottom:'2px solid var(--pierre)', borderRadius:0, color:'var(--pierre)', width:'220px', padding:'8px 0' }} />
        {caForm.ca > 0 && (
          <div style={{ marginTop:'10px', fontSize:'13px', color:parseFloat(caForm.ca)>=OBJ_JOUR?'var(--vert)':'var(--gris)' }}>
            {parseFloat(caForm.ca)>=OBJ_JOUR ? `✅ ${OBJ_JOUR}€ équilibre atteint !` : `encore ${(OBJ_JOUR-parseFloat(caForm.ca)).toFixed(0)}€ pour l'équilibre`}
          </div>
        )}
      </div>

      {/* Cash / Carte */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'18px' }}>
        {['cash','carte'].map(p=>(
          <button key={p} onClick={()=>setCaForm({...caForm,paiement:p})} style={{
            flex:1, padding:'14px', borderRadius:'var(--r)',
            background: caForm.paiement===p ? (p==='cash'?'var(--vert)':'#2980B9') : 'var(--noir2)',
            color: caForm.paiement===p ? 'var(--noir)' : 'var(--gris)',
            border: caForm.paiement===p ? 'none' : '1px solid var(--noir3)',
            fontFamily:'var(--font-head)', fontWeight:700, fontSize:'15px', cursor:'pointer',
            letterSpacing:'1px', transition:'all .2s'
          }}>
            {p==='cash' ? '💵 Cash' : '💳 Carte'}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
        <div className="form-group" style={{ margin:0 }}>
          <label>Sessions</label>
          <input type="number" inputMode="numeric" placeholder="1"
            value={caForm.sessions} onChange={e=>setCaForm({...caForm,sessions:e.target.value})}
            style={{ textAlign:'center', fontSize:'20px' }} />
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label>Date</label>
          <input type="date" min="2026-06-01" value={caForm.date} onChange={e=>setCaForm({...caForm,date:e.target.value})} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom:'20px' }}>
        <label>Notes (style, nationalité...)</label>
        <textarea rows="2" placeholder="Ex: botanical avant-bras, client DE..." value={caForm.notes} onChange={e=>setCaForm({...caForm,notes:e.target.value})} style={{ resize:'none' }} />
      </div>
      <button className="btn btn-primary" onClick={submitCA} disabled={caSaving||!caForm.ca} style={{ width:'100%', padding:'16px', fontSize:'15px' }}>
        {caSaving ? 'Enregistrement...' : '✓ Valider'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── DÉPENSE ────────────────────────────────────────
  if (tab === 'depense') return (
    <div style={{ padding:'28px 20px', minHeight:'100vh' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700 }}>Dépense / Facture</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('home');setPhoto(null)}} style={{ padding:'6px 14px', fontSize:'12px' }}>← Retour</button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display:'none' }} />

      {!photo ? (
        <button onClick={()=>fileRef.current?.click()} className="btn btn-ghost" style={{ width:'100%', padding:'18px', marginBottom:'16px', flexDirection:'column', gap:'6px', fontSize:'13px' }}>
          <span style={{ fontSize:'26px' }}>📷</span>
          Photo du ticket<br/>
          <span style={{ fontSize:'10px', color:'var(--gris)' }}>Analyse automatique si ANTHROPIC_API_KEY configurée</span>
        </button>
      ) : (
        <div style={{ marginBottom:'14px', position:'relative' }}>
          <img src={photo} style={{ width:'100%', borderRadius:'8px', maxHeight:'150px', objectFit:'cover' }} />
          {analyzing && (
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.7)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--pierre)', fontSize:'14px' }}>
              Analyse...
            </div>
          )}
          <button onClick={()=>{setPhoto(null)}} style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,.7)', border:'none', color:'#fff', borderRadius:'50%', width:26, height:26, cursor:'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
        <div className="form-group" style={{ margin:0 }}>
          <label>Montant TTC (€) *</label>
          <input type="number" inputMode="decimal" placeholder="0.00"
            value={depForm.montant} onChange={e=>setDepForm({...depForm,montant:e.target.value})}
            style={{ fontSize:'22px', textAlign:'center', fontFamily:'var(--font-mono)' }} />
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label>Date</label>
          <input type="date" min="2026-06-01" value={depForm.date} onChange={e=>setDepForm({...depForm,date:e.target.value})} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom:'10px' }}>
        <label>Catégorie</label>
        <select value={depForm.categorie} onChange={e=>setDepForm({...depForm,categorie:e.target.value})}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom:'10px' }}>
        <label>Fournisseur</label>
        <input placeholder="Kwadron, Mercadona..." value={depForm.fournisseur} onChange={e=>setDepForm({...depForm,fournisseur:e.target.value})} />
      </div>
      <div className="form-group" style={{ marginBottom:'12px' }}>
        <label>Notes</label>
        <input placeholder="Description rapide" value={depForm.notes} onChange={e=>setDepForm({...depForm,notes:e.target.value})} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px' }}>
        <input type="checkbox" id="iva" checked={depForm.iva_recuperable} onChange={e=>setDepForm({...depForm,iva_recuperable:e.target.checked})} style={{ width:20, height:20, accentColor:'var(--pierre)', cursor:'pointer' }} />
        <label htmlFor="iva" style={{ fontSize:'13px', color:'var(--gris)', cursor:'pointer' }}>IVA récupérable (21%)</label>
      </div>
      <button className="btn btn-primary" onClick={submitDep} disabled={depSaving||!depForm.montant} style={{ width:'100%', padding:'16px' }}>
        {depSaving ? 'Enregistrement...' : '✓ Enregistrer la dépense'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── FORMULAIRE ÉDITION ─────────────────────────────
  if (tab === 'edit' && editing) return (
    <div style={{ padding:'28px 20px', minHeight:'100vh' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700 }}>Modifier l'entrée</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('histo');setEditing(null)}} style={{ padding:'6px 14px', fontSize:'12px' }}>← Retour</button>
      </div>
      <div style={{ textAlign:'center', marginBottom:'20px' }}>
        <div style={{ fontSize:'12px', color:'var(--gris)', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1px' }}>CA (€ HT)</div>
        <input type="number" inputMode="decimal"
          value={editing.ca} onChange={e=>setEditing({...editing,ca:e.target.value})}
          style={{ fontSize:'48px', fontFamily:'var(--font-mono)', fontWeight:500, textAlign:'center', background:'transparent', border:'none', borderBottom:'2px solid var(--pierre)', borderRadius:0, color:'var(--pierre)', width:'200px', padding:'8px 0' }} />
      </div>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
        {['cash','carte'].map(p=>(
          <button key={p} onClick={()=>setEditing({...editing,paiement:p})} style={{
            flex:1, padding:'12px', borderRadius:'var(--r)',
            background: editing.paiement===p ? (p==='cash'?'var(--vert)':'#2980B9') : 'var(--noir2)',
            color: editing.paiement===p ? 'var(--noir)' : 'var(--gris)',
            border: editing.paiement===p ? 'none' : '1px solid var(--noir3)',
            fontFamily:'var(--font-head)', fontWeight:700, fontSize:'14px', cursor:'pointer'
          }}>
            {p==='cash' ? '💵 Cash' : '💳 Carte'}
          </button>
        ))}
      </div>
      <div className="form-group" style={{ marginBottom:'12px' }}>
        <label>Date</label>
        <input type="date" min="2026-06-01" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})} />
      </div>
      <div className="form-group" style={{ marginBottom:'20px' }}>
        <label>Notes</label>
        <input placeholder="Style, nationalité..." value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})} />
      </div>
      <button className="btn btn-primary" onClick={submitEdit} disabled={editSaving||!editing.ca} style={{ width:'100%', padding:'14px', marginBottom:'10px' }}>
        {editSaving ? 'Sauvegarde...' : '✓ Sauvegarder la modification'}
      </button>
      <button onClick={()=>{ if(confirm('Supprimer cette entrée ?')) { submitDelete(editing.id); setTab('histo'); setEditing(null) } }}
        style={{ width:'100%', padding:'12px', background:'transparent', border:'1px solid var(--rouge)', color:'var(--rouge)', borderRadius:'var(--r)', cursor:'pointer', fontSize:'13px' }}>
        🗑 Supprimer l'entrée
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ── HISTORIQUE ─────────────────────────────────────
  if (tab === 'histo') return (
    <div style={{ padding:'24px 16px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700 }}>Historique</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{ padding:'6px 14px', fontSize:'12px' }}>← Retour</button>
      </div>
      <div className="section-title">CA récent</div>
      {loading && <div style={{ color:'var(--gris)', padding:'20px', textAlign:'center', fontSize:'12px' }}>Chargement...</div>}
      {sessions.filter(s=>!(s.properties.Type?.select?.name||'').includes('Amely')).slice(0,8).map(s=>{
        const ca   = s.properties.Prix?.number || 0
        const date = s.properties.Date?.date?.start || ''
        const notes = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
        const title = s.properties.Session?.title?.[0]?.plain_text || ''
        const isCash = !title.includes('[CARTE]')
        const ok = ca >= OBJ_JOUR
        return (
          <div key={s.id} className="card" onClick={()=>{ setEditing({ id:s.id, ca:String(ca), paiement:isCash?'cash':'carte', date:date||todayStr(), notes }); setTab('edit') }}
            style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', cursor:'pointer', activeOpacity:0.7 }}>
            <div>
              <div style={{ fontSize:'12px', color:'var(--gris)' }}>{date}</div>
              {notes && <div style={{ fontSize:'11px', color:'var(--gris2)', marginTop:'2px', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{notes}</div>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'16px', color:ok?'var(--vert)':'var(--pierre)' }}>{ca}€</span>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={{ fontSize:'9px', padding:'2px 5px', borderRadius:'8px', background:isCash?'rgba(39,174,96,.2)':'rgba(41,128,185,.2)', color:isCash?'#2ecc71':'#5dade2' }}>
                  {isCash?'CASH':'CARTE'}
                </span>
                <span style={{ fontSize:'11px', color:'var(--gris2)' }}>✏️</span>
              </div>
            </div>
          </div>
        )
      })}
      <div className="section-title" style={{ marginTop:'16px' }}>Dépenses récentes</div>
      {depenses.slice(0,5).map(d=>{
        const m = d.properties.Montant?.number || 0
        const cat = d.properties.Catégorie?.select?.name || ''
        const date = d.properties.Date?.date?.start || ''
        const fourn = d.properties.Fournisseur?.rich_text?.[0]?.plain_text || ''
        return (
          <div key={d.id} className="card" style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px' }}>
            <div>
              <div style={{ fontSize:'12px' }}>{cat}</div>
              <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>{fourn} {date && '· '+date}</div>
            </div>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--rouge)' }}>-{m}€</span>
          </div>
        )
      })}
    </div>
  )

  // ── HOME ───────────────────────────────────────────
  return (
    <div style={{ padding:'24px 16px 32px', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
        <div>
          <div style={{ fontFamily:'var(--font-head)', fontSize:'22px', fontWeight:800, letterSpacing:'2px', color:'var(--pierre)' }}>BLACKTHORN</div>
          <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>
            {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
        </div>
        <button onClick={load} style={{ background:'none', border:'none', color:'var(--gris)', fontSize:'18px', cursor:'pointer' }}>↻</button>
      </div>

      {/* Jauge CA unique */}
      <div className="card" style={{ marginBottom:'14px' }}>
        {/* Chiffres jour / mois */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
          {[
            { l:"Aujourd'hui", v:caJour>0?caJour+'€':'—', c:caJour>=OBJ_JOUR?'var(--vert)':caJour>0?'var(--pierre)':'var(--gris2)' },
            { l:'Ce mois',      v:caMois>0?fmtE(caMois):'—', c:caMois>=5850?'var(--vert)':caMois>=3895?'var(--jaune)':caMois>0?'var(--pierre)':'var(--gris2)' },
          ].map(x=>(
            <div key={x.l} style={{ textAlign:'center', padding:'10px 6px', background:'var(--noir3)', borderRadius:'var(--r)' }}>
              <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{x.l}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'22px', color:x.c }}>{x.v}</div>
            </div>
          ))}
        </div>

        {/* Jauge unique */}
        {(() => {
          const MAX  = 8000
          const cur  = Math.min(100, (caMois / MAX) * 100)
          const barC = caMois >= 7500 ? '#1D9E75' : caMois >= 5850 ? '#BA7517' : caMois >= 3895 ? '#E8A020' : '#E24B4A'
          const msg  = caMois >= 7500
            ? { icon:'✅', text:"Vous êtes confortable", sub:`+${Math.round(caMois-7500)}€ au-dessus du confort`, c:'var(--vert)' }
            : caMois >= 5850
            ? { icon:'🌊', text:"Vous tenez l'hiver", sub:`+${Math.round(caMois-5850)}€ vers le confort (${Math.round(7500-caMois)}€ restants)`, c:'#BA7517' }
            : caMois >= 3895
            ? { icon:'⚖️', text:"Equilbre atteint", sub:`Encore ${Math.round(5850-caMois)}€ pour tenir l'hiver`, c:'var(--jaune)' }
            : { icon:'🔴', text:"Pas encore à l'équilibre", sub:`Encore ${Math.round(3895-caMois)}€ pour couvrir toutes les charges`, c:'var(--rouge)' }

          return (
            <div>
              <div style={{ position:'relative', marginBottom:'8px' }}>
                {/* Fond */}
                <div style={{ height:'10px', background:'var(--noir3)', borderRadius:'5px', overflow:'visible', position:'relative' }}>
                  {/* Remplissage */}
                  <div style={{ height:'100%', width:`${cur}%`, background:barC, borderRadius:'5px', transition:'width .6s ease', position:'relative', zIndex:1 }} />
                  {/* Traits seuils */}
                  {[{p:(3895/MAX)*100,c:'#E8A020'},{p:(5850/MAX)*100,c:'#BA7517'},{p:(7500/MAX)*100,c:'#1D9E75'}].map((s,i)=>(
                    <div key={i} style={{ position:'absolute', left:`${s.p}%`, top:'-4px', width:'2px', height:'18px', background:s.c, zIndex:2, opacity:0.8 }} />
                  ))}
                </div>
              </div>
              {/* Labels seuils */}
              <div style={{ position:'relative', height:'14px', marginBottom:'12px' }}>
                {[{p:(3895/MAX)*100,l:'156€/j',c:'#E8A020'},{p:(5850/MAX)*100,l:'234€/j',c:'#BA7517'},{p:(7500/MAX)*100,l:'300€/j',c:'#1D9E75'}].map((s,i)=>(
                  <div key={i} style={{ position:'absolute', left:`${s.p}%`, transform:'translateX(-50%)', fontSize:'9px', color:s.c, fontWeight:600, textAlign:'center', whiteSpace:'nowrap' }}>
                    {s.l}
                  </div>
                ))}
              </div>
              {/* Message statut */}
              <div style={{ padding:'10px 12px', background:caMois>=3895?'var(--epine)':'rgba(192,57,43,.1)', borderRadius:'var(--r)', borderLeft:`3px solid ${msg.c}` }}>
                <div style={{ fontSize:'14px', fontWeight:600, color:msg.c }}>{msg.icon} {msg.text}</div>
                <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'3px' }}>{msg.sub}</div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Impôts du mois */}
      <div className="card" style={{ marginBottom:'14px' }}>
        <div style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>À mettre de côté ce mois</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
          {[
            { l:'IRPF 20%', v:r.irpf+'€', c:'var(--jaune)' },
            { l:'IVA nette', v:r.iva+'€', c:'var(--jaune)' },
            { l:isEte?'Réserve hiver':'Hiver', v:isEte?PROV_MOIS+'€':'—', c:isEte?'var(--pierre)':'var(--gris2)' },
          ].map(x=>(
            <div key={x.l} style={{ textAlign:'center', padding:'8px 4px', background:'var(--noir3)', borderRadius:'var(--r)' }}>
              <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', marginBottom:'3px' }}>{x.l}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', color:x.c }}>{x.v}</div>
            </div>
          ))}
        </div>
        {depMois > 0 && (
          <div style={{ marginTop:'8px', display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--gris)' }}>
            <span>Dépenses ce mois</span>
            <span style={{ fontFamily:'var(--font-mono)', color:'var(--rouge)' }}>-{fmtE(depMois)}</span>
          </div>
        )}
      </div>

      {/* Seuils rappel */}
      <div className="card" style={{ marginBottom:'20px', padding:'10px 14px' }}>
        <div style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Seuils (IRPF + IVA inclus)</div>
        {[
          { pm:156, l:'Équilibre mensuel' },
          { pm:234, l:'Tenir l\'hiver' },
          { pm:300, l:'Confort' },
        ].map(s=>(
          <div key={s.pm} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'12px' }}>
            <span style={{ color:'var(--gris)' }}>{s.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', color:caJour>0&&caJour/1>=s.pm?'var(--vert)':'var(--gris2)' }}>{s.pm}€/j</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
        <button className="btn btn-primary" onClick={()=>setTab('ca')} style={{ padding:'16px', fontSize:'15px', fontWeight:700 }}>
          + Mon CA du jour
        </button>
        <button className="btn btn-ghost" onClick={()=>setTab('depense')} style={{ padding:'13px' }}>
          🧾 Ajouter une dépense / facture
        </button>
        <button className="btn btn-ghost" onClick={()=>setTab('histo')} style={{ padding:'11px', fontSize:'13px' }}>
          Voir l'historique
        </button>
      </div>

      <button onClick={onLogout} style={{ background:'none', border:'none', color:'var(--gris2)', fontSize:'11px', cursor:'pointer', width:'100%', textAlign:'center' }}>
        Déconnexion
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
