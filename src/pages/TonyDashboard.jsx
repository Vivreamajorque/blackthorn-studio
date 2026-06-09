import React, { useState, useEffect, useRef, useCallback } from 'react'
import { notion } from '../lib/notion'

const OBJ_EQ   = 3895   // équilibre mensuel (156€/j × 25j)
const OBJ_HIV  = 5850   // tenir hiver (234€/j × 25j)
const OBJ_CONF = 7500   // confort (300€/j × 25j)
const PERSO    = 1500
const FIXES    = 956
const IVA_FL   = 150.47

const netReel = (ca) => {
  const m=ca*0.08, b=ca-FIXES-m
  const irpf=Math.max(0,b*0.20), iva=Math.max(0,ca*0.21-IVA_FL-m*0.21)
  return { net:Math.max(0,Math.round(b-irpf-iva)), irpf:Math.round(irpf), iva:Math.round(iva) }
}

const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => new Date().toISOString().substring(0,7)
const fmt = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }

const weekStart = () => {
  const d=new Date(); const day=d.getDay()
  const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff)
  return d.toISOString().split('T')[0]
}

// Arc SVG de progression
function ArcProgress({ pct, color, size=100, stroke=9, label, value, sub, sub2 }) {
  const r = (size-stroke)/2
  const circ = 2*Math.PI*r
  // Arc couvre 240 degrés (de 150° à 390°)
  const arcLen = circ * (240/360)
  const filled = Math.min(arcLen, arcLen * Math.min(1, pct/100))
  const gapLen = circ - arcLen
  const startAngle = 150
  const cx = size/2, cy = size/2

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <div style={{ position:'relative', width:size, height:size*0.8 }}>
        <svg width={size} height={size} style={{ position:'absolute', top:0, left:0 }}>
          {/* Arc fond */}
          <circle cx={cx} cy={cy} r={r}
            fill="none" stroke="#E8E2D8" strokeWidth={stroke}
            strokeDasharray={`${arcLen} ${gapLen}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${startAngle} ${cx} ${cy})`} />
          {/* Arc rempli */}
          <circle cx={cx} cy={cy} r={r}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${startAngle} ${cx} ${cy})`}
            style={{ transition:'stroke-dasharray .6s ease' }} />
        </svg>
        {/* Valeur centrale */}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:'10px' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:500, color:'var(--txt)', lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'2px' }}>{sub}</div>}
        </div>
      </div>
      <div style={{ fontSize:'11px', fontWeight:700, color:'var(--txt2)', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</div>
      {sub2 && <div style={{ fontSize:'10px', color:color, fontWeight:600, textAlign:'center' }}>{sub2}</div>}
    </div>
  )
}

const CATS = ['🖊️ Matériel tatouage','🧴 Consommables','📱 Marketing','🔧 Équipement','🏠 Charges fixes','🚗 Déplacements','📦 Autre']

export default function TonyDashboard({ onLogout }) {
  const [tab, setTab]           = useState('home')
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const fileRef   = useRef(null)
  const cameraRef = useRef(null)

  const [caForm,    setCaForm]    = useState({ ca:'', sessions:'1', paiement:'cash', notes:'', date:todayStr() })
  const [caSaving,  setCaSaving]  = useState(false)
  const [depForm,   setDepForm]   = useState({ montant:'', fournisseur:'', categorie:'🖊️ Matériel tatouage', date:todayStr(), notes:'', iva_recuperable:true })
  const [depSaving, setDepSaving] = useState(false)
  const [photo,     setPhoto]     = useState(null)
  const [photoUrl,  setPhotoUrl]  = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [editSaving,setEditSaving]= useState(false)

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''), 2500) }

  const load = useCallback(async () => {
    try {
      const [s,d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const m  = thisMonth()
  const td = todayStr()
  const ws = weekStart()

  const sessT = sessions.filter(s=>!(s.properties.Type?.select?.name||'').includes('Amely'))
  const sessM = sessT.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const sessW = sessT.filter(s=>(s.properties.Date?.date?.start||'')>=ws)
  const sessJ = sessT.filter(s=>s.properties.Date?.date?.start===td)

  const caMois   = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caSem    = sessW.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caJour   = sessJ.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const nbMois   = sessM.length
  const panier   = nbMois>0 ? Math.round(caMois/nbMois) : 0

  const r = netReel(caMois)

  // Objectif semaine : tenir l'hiver = 5850/4 sem ≈ 1462€
  const OBJ_SEM  = Math.round(OBJ_HIV / 4.3)  // ~1360€
  const pctSem   = Math.min(100, Math.round((caSem/OBJ_SEM)*100))
  const pctMois  = Math.min(100, Math.round((caMois/OBJ_HIV)*100))

  const colSem  = caSem>=OBJ_SEM?'#1A8C5A':caSem>=OBJ_SEM*0.6?'#D4820A':'#C0392B'
  const colMois = caMois>=OBJ_CONF?'#1A8C5A':caMois>=OBJ_HIV?'#BA7517':caMois>=OBJ_EQ?'#D4820A':'#C0392B'

  const msgMois = caMois>=OBJ_CONF
    ? { icon:'✅', text:'Confort atteint', c:'#1A8C5A' }
    : caMois>=OBJ_HIV
    ? { icon:'🌊', text:`Hiver couvert — encore ${fmt(OBJ_CONF-caMois)} pour le confort`, c:'#BA7517' }
    : caMois>=OBJ_EQ
    ? { icon:'⚖️', text:`Équilibre — encore ${fmt(OBJ_HIV-caMois)} pour tenir l'hiver`, c:'#D4820A' }
    : { icon:'📍', text:`Encore ${fmt(OBJ_EQ-caMois)} pour atteindre l'équilibre`, c:'#C0392B' }

  // Submit CA
  const submitCA = async () => {
    if (!caForm.ca) return
    setCaSaving(true)
    try {
      await notion.addSession({
        session:`Tony · ${caForm.date} · ${caForm.ca}€`,
        type:'🖤 Tattoo Tony', client:'', natio:'Autre',
        style:caForm.notes,
        prix:parseFloat(caForm.ca)||0, acompte:0, solde:parseFloat(caForm.ca)||0,
        paiement:caForm.paiement||'cash',
        notes:`${caForm.sessions} session(s)${caForm.notes?' · '+caForm.notes:''}`,
        date:caForm.date, avis:false
      })
      showToast(parseFloat(caForm.ca)>=156?'🔥 Belle session !':'✓ CA enregistré')
      setCaForm({ca:'',sessions:'1',paiement:'cash',notes:'',date:todayStr()})
      setTab('home'); load()
    } catch(e) { showToast('Erreur — réessaie') }
    setCaSaving(false)
  }

  // Submit Dépense
  const submitDep = async () => {
    if (!depForm.montant) return
    setDepSaving(true)
    try {
      await notion.addDepense({...depForm, saisi_par:'Tony', photoUrl:photoUrl||null})
      showToast('✓ Dépense enregistrée')
      setDepForm({montant:'',fournisseur:'',categorie:'🖊️ Matériel tatouage',date:todayStr(),notes:'',iva_recuperable:true})
      setPhoto(null); setPhotoUrl(null)
      setTab('home'); load()
    } catch(e) { showToast('Erreur — réessaie') }
    setDepSaving(false)
  }

  // Photo / upload
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setAnalyzing(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setPhoto(ev.target.result)
      setUploading(true)
      fetch('/api/upload', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({image:ev.target.result, filename:file.name||'ticket.jpg'})
      }).then(r=>r.json()).then(d=>{ if(d.url){setPhotoUrl(d.url); showToast('✓ Photo sauvegardée')} }).catch(()=>{}).finally(()=>setUploading(false))
      try {
        const res = await fetch('/api/analyze-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:ev.target.result.split(',')[1],mediaType:file.type})})
        const data = await res.json()
        if (!data.manual && data.montant) {
          setDepForm(f=>({...f, montant:data.montant?.toString()||f.montant, fournisseur:data.fournisseur||f.fournisseur, date:data.date||f.date, notes:data.description||f.notes}))
          showToast('✓ Ticket analysé')
        }
      } catch(e) {}
      setAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // Edit / Delete
  const submitEdit = async () => {
    if (!editing?.ca) return
    setEditSaving(true)
    try {
      await notion.updateSession(editing.id, {prix:parseFloat(editing.ca),paiement:editing.paiement||'cash',date:editing.date,notes:editing.notes,type:'🖤 Tattoo Tony',natio:'Autre'})
      showToast('✓ Modifié'); setEditing(null); setTab('histo'); load()
    } catch(e) { showToast('Erreur') }
    setEditSaving(false)
  }
  const doDelete = async (id) => {
    try { await notion.deleteSession(id); showToast('Supprimé'); load() } catch(e) { showToast('Erreur') }
  }

  // ── PAGES ──────────────────────────────────────────

  if (tab==='ca') return (
    <div style={{padding:'28px 20px', minHeight:'100vh', background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'28px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Mon CA du jour</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div style={{textAlign:'center',marginBottom:'24px'}}>
        <div style={{fontSize:'11px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Montant encaissé (€ HT)</div>
        <input type="number" inputMode="decimal" placeholder="0"
          value={caForm.ca} onChange={e=>setCaForm({...caForm,ca:e.target.value})}
          style={{fontSize:'52px',fontFamily:'var(--font-mono)',fontWeight:500,textAlign:'center',background:'transparent',border:'none',borderBottom:'2px solid var(--pierre)',borderRadius:0,color:'var(--txt)',width:'220px',padding:'8px 0'}} />
        {caForm.ca>0 && (
          <div style={{marginTop:'10px',fontSize:'13px',color:parseFloat(caForm.ca)>=156?'#1A8C5A':'var(--txt3)'}}>
            {parseFloat(caForm.ca)>=156?'✅ Objectif journalier atteint !':
             `${(156-parseFloat(caForm.ca)).toFixed(0)}€ pour l'objectif jour`}
          </div>
        )}
      </div>
      <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
        {['cash','carte'].map(p=>(
          <button key={p} onClick={()=>setCaForm({...caForm,paiement:p})} style={{
            flex:1,padding:'14px',borderRadius:'var(--r)',fontFamily:'var(--font-head)',fontWeight:700,fontSize:'15px',cursor:'pointer',transition:'all .2s',
            background:caForm.paiement===p?(p==='cash'?'#1A8C5A':'#2980B9'):'var(--card)',
            color:caForm.paiement===p?'#fff':'var(--txt2)',
            border:caForm.paiement===p?'none':'1.5px solid var(--border2)',
            boxShadow:'var(--shadow)'
          }}>{p==='cash'?'💵 Cash':'💳 Carte'}</button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>Sessions</label>
          <input type="number" inputMode="numeric" placeholder="1" value={caForm.sessions} onChange={e=>setCaForm({...caForm,sessions:e.target.value})} style={{textAlign:'center',fontSize:'20px'}} />
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Date</label>
          <input type="date" min="2026-06-01" value={caForm.date} onChange={e=>setCaForm({...caForm,date:e.target.value})} />
        </div>
      </div>
      <div className="form-group" style={{marginBottom:'24px'}}>
        <label>Notes (style, nationalité...)</label>
        <textarea rows="2" placeholder="Ex: botanical avant-bras, client DE..." value={caForm.notes} onChange={e=>setCaForm({...caForm,notes:e.target.value})} style={{resize:'none'}} />
      </div>
      <button className="btn btn-primary" onClick={submitCA} disabled={caSaving||!caForm.ca} style={{width:'100%',padding:'16px',fontSize:'15px'}}>
        {caSaving?'Enregistrement...':'✓ Valider'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  if (tab==='depense') return (
    <div style={{padding:'28px 20px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Dépense / Facture</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('home');setPhoto(null);setPhotoUrl(null)}} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{display:'none'}} />
      {!photo ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <button onClick={()=>cameraRef.current?.click()} className="btn btn-ghost" style={{padding:'16px',flexDirection:'column',gap:'4px',fontSize:'12px'}}>
            <span style={{fontSize:'24px'}}>📷</span>Photo
          </button>
          <button onClick={()=>fileRef.current?.click()} className="btn btn-ghost" style={{padding:'16px',flexDirection:'column',gap:'4px',fontSize:'12px'}}>
            <span style={{fontSize:'24px'}}>📁</span>Fichier
          </button>
        </div>
      ) : (
        <div style={{marginBottom:'14px',position:'relative'}}>
          <img src={photo} style={{width:'100%',borderRadius:'var(--r)',maxHeight:'140px',objectFit:'cover'}} />
          {(analyzing||uploading) && (
            <div style={{position:'absolute',inset:0,background:'rgba(255,255,255,.85)',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',color:'var(--txt2)'}}>
              {analyzing?'🔍 Analyse...':'☁️ Upload...'}
            </div>
          )}
          <button onClick={()=>{setPhoto(null);setPhotoUrl(null)}} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,.5)',border:'none',color:'#fff',borderRadius:'50%',width:24,height:24,cursor:'pointer',fontSize:'14px'}}>×</button>
          {photoUrl && <div style={{position:'absolute',bottom:6,right:6,background:'#1A8C5A',borderRadius:'4px',padding:'2px 6px',fontSize:'10px',color:'#fff',fontWeight:600}}>✓ OK</div>}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>Montant TTC (€) *</label>
          <input type="number" inputMode="decimal" placeholder="0.00" value={depForm.montant} onChange={e=>setDepForm({...depForm,montant:e.target.value})} style={{fontSize:'22px',textAlign:'center',fontFamily:'var(--font-mono)'}} />
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Date</label>
          <input type="date" min="2026-06-01" value={depForm.date} onChange={e=>setDepForm({...depForm,date:e.target.value})} />
        </div>
      </div>
      <div className="form-group" style={{marginBottom:'10px'}}>
        <label>Catégorie</label>
        <select value={depForm.categorie} onChange={e=>setDepForm({...depForm,categorie:e.target.value})}>
          {CATS.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group" style={{marginBottom:'10px'}}>
        <label>Fournisseur</label>
        <input placeholder="Kwadron, Mercadona..." value={depForm.fournisseur} onChange={e=>setDepForm({...depForm,fournisseur:e.target.value})} />
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Notes</label>
        <input placeholder="Description" value={depForm.notes} onChange={e=>setDepForm({...depForm,notes:e.target.value})} />
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
        <input type="checkbox" id="iva" checked={depForm.iva_recuperable} onChange={e=>setDepForm({...depForm,iva_recuperable:e.target.checked})} style={{width:18,height:18,accentColor:'var(--pierre)',cursor:'pointer'}} />
        <label htmlFor="iva" style={{fontSize:'13px',color:'var(--txt2)',cursor:'pointer'}}>IVA récupérable (21%)</label>
      </div>
      <button className="btn btn-primary" onClick={submitDep} disabled={depSaving||!depForm.montant} style={{width:'100%',padding:'16px'}}>
        {depSaving?'Enregistrement...':'✓ Enregistrer'}
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  if (tab==='edit' && editing) return (
    <div style={{padding:'28px 20px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Modifier</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('histo');setEditing(null)}} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div style={{textAlign:'center',marginBottom:'20px'}}>
        <input type="number" inputMode="decimal" value={editing.ca} onChange={e=>setEditing({...editing,ca:e.target.value})}
          style={{fontSize:'48px',fontFamily:'var(--font-mono)',fontWeight:500,textAlign:'center',background:'transparent',border:'none',borderBottom:'2px solid var(--pierre)',borderRadius:0,color:'var(--txt)',width:'200px',padding:'8px 0'}} />
      </div>
      <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
        {['cash','carte'].map(p=>(
          <button key={p} onClick={()=>setEditing({...editing,paiement:p})} style={{
            flex:1,padding:'12px',borderRadius:'var(--r)',fontFamily:'var(--font-head)',fontWeight:700,fontSize:'14px',cursor:'pointer',
            background:editing.paiement===p?(p==='cash'?'#1A8C5A':'#2980B9'):'var(--card)',
            color:editing.paiement===p?'#fff':'var(--txt2)',
            border:editing.paiement===p?'none':'1.5px solid var(--border2)'
          }}>{p==='cash'?'💵 Cash':'💳 Carte'}</button>
        ))}
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Date</label>
        <input type="date" min="2026-06-01" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})} />
      </div>
      <div className="form-group" style={{marginBottom:'20px'}}>
        <label>Notes</label>
        <input value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})} />
      </div>
      <button className="btn btn-primary" onClick={submitEdit} disabled={editSaving||!editing.ca} style={{width:'100%',padding:'14px',marginBottom:'10px'}}>
        {editSaving?'Sauvegarde...':'✓ Sauvegarder'}
      </button>
      <button onClick={()=>{if(confirm('Supprimer ?')){doDelete(editing.id);setEditing(null);setTab('histo')}}}
        style={{width:'100%',padding:'12px',background:'transparent',border:'1.5px solid #C0392B',color:'#C0392B',borderRadius:'var(--r)',cursor:'pointer',fontSize:'13px',fontFamily:'var(--font-head)',fontWeight:600}}>
        🗑 Supprimer
      </button>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  if (tab==='histo') return (
    <div style={{padding:'24px 16px 90px',background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Historique</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div className="section-title">CA récent</div>
      {sessT.slice(0,10).map(s=>{
        const ca=s.properties.Prix?.number||0
        const date=s.properties.Date?.date?.start||''
        const notes=s.properties.Notes?.rich_text?.[0]?.plain_text||''
        const title=s.properties.Session?.title?.[0]?.plain_text||''
        const isCash=!title.includes('[CARTE]')
        return (
          <div key={s.id} className="card" onClick={()=>{setEditing({id:s.id,ca:String(ca),paiement:isCash?'cash':'carte',date:date||todayStr(),notes});setTab('edit')}}
            style={{marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:500}}>{date}</div>
              {notes && <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'2px'}}>{notes}</div>}
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'16px',fontWeight:500,color:ca>=156?'#1A8C5A':'var(--txt)'}}>{ca}€</span>
              <span style={{fontSize:'9px',padding:'2px 6px',borderRadius:'6px',fontWeight:600,
                background:isCash?'rgba(26,140,90,.1)':'rgba(41,128,185,.1)',
                color:isCash?'#1A8C5A':'#2980B9'}}>
                {isCash?'CASH':'CARTE'}
              </span>
            </div>
          </div>
        )
      })}
      <div className="section-title" style={{marginTop:'16px'}}>Dépenses récentes</div>
      {depenses.slice(0,5).map(d=>{
        const m2=d.properties.Montant?.number||0
        const cat=d.properties.Catégorie?.select?.name||''
        const date=d.properties.Date?.date?.start||''
        const fourn=d.properties.Fournisseur?.rich_text?.[0]?.plain_text||''
        return (
          <div key={d.id} className="card" style={{marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:500}}>{cat}</div>
              <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'2px'}}>{fourn}{date&&' · '+date}</div>
            </div>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'14px',color:'#C0392B',fontWeight:500}}>-{m2}€</span>
          </div>
        )
      })}
    </div>
  )

  // ── HOME ───────────────────────────────────────────
  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',paddingBottom:'80px'}}>
      {/* Header avec logo */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 20px 16px',borderBottom:'1px solid var(--border)'}}>
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{height:'38px',filter:'brightness(0)',opacity:0.85}} />
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'12px',color:'var(--txt3)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span>
          <button onClick={load} style={{background:'none',border:'none',fontSize:'16px',color:'var(--txt3)',cursor:'pointer'}}>↻</button>
        </div>
      </div>

      <div style={{padding:'20px 20px'}}>

        {/* ── ARCS SEMAINE + MOIS ─────────────────── */}
        <div className="card" style={{marginBottom:'16px',padding:'20px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',justifyItems:'center',marginBottom:'16px'}}>
            <ArcProgress
              pct={pctSem} color={colSem} size={130} stroke={10}
              label="Semaine"
              value={caSem>0?fmt(caSem):'—'}
              sub={caSem>0?`obj ${fmt(OBJ_SEM)}`:null}
              sub2={caSem>=OBJ_SEM?`✓ Objectif atteint`:caSem>0?`encore ${fmt(OBJ_SEM-caSem)}`:null}
            />
            <ArcProgress
              pct={pctMois} color={colMois} size={130} stroke={10}
              label="Mois"
              value={caMois>0?fmt(caMois):'—'}
              sub={caMois>0?`${Math.round(pctMois)}%`:null}
              sub2={caMois>=OBJ_HIV?'✓ Hiver couvert':caMois>=OBJ_EQ?'⚖️ À l\'équilibre':caMois>0?`${fmt(OBJ_EQ-caMois)} manquant`:null}
            />
          </div>
          {/* Message statut */}
          <div style={{padding:'10px 14px',background:msgMois.c+'15',borderRadius:'var(--r)',borderLeft:`3px solid ${msgMois.c}`}}>
            <span style={{fontSize:'13px',fontWeight:600,color:msgMois.c}}>{msgMois.icon} {msgMois.text}</span>
          </div>
        </div>

        {/* ── PANIER MOYEN ─────────────────────────── */}
        <div className="card" style={{marginBottom:'16px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
            <div style={{textAlign:'center',padding:'10px 6px',background:'var(--bg)',borderRadius:'var(--r)'}}>
              <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',marginBottom:'4px'}}>Panier mois</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'22px',fontWeight:500,color:panier>=200?'#1A8C5A':panier>=156?'#D4820A':'var(--txt)'}}>{panier>0?panier+'€':'—'}</div>
              <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{nbMois>0?nbMois+' session'+(nbMois>1?'s':''):'—'}</div>
            </div>
            <div style={{textAlign:'center',padding:'10px 6px',background:'var(--bg)',borderRadius:'var(--r)'}}>
              <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',marginBottom:'4px'}}>Aujourd'hui</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'22px',fontWeight:500,color:caJour>=156?'#1A8C5A':caJour>0?'#D4820A':'var(--txt3)'}}>{caJour>0?caJour+'€':'—'}</div>
              <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{sessJ.length>0?sessJ.length+' sess.':'Pas encore'}</div>
            </div>
            <div style={{textAlign:'center',padding:'10px 6px',background:'var(--bg)',borderRadius:'var(--r)'}}>
              <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',marginBottom:'4px'}}>Net estimé</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'22px',fontWeight:500,color:r.net>=PERSO?'#1A8C5A':'#C0392B'}}>{fmt(r.net)}</div>
              <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>après impôts</div>
            </div>
          </div>
        </div>

        {/* ── MINI GRAPHE ANNUEL ───────────────────── */}
        <div className="card" style={{marginBottom:'20px'}}>
          <div style={{fontSize:'10px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Juin 2026 → Mai 2027</div>
          {(() => {
            const MOIS=['J','Jl','A','S','O','N','D','J','F','M','A','M']
            const MKEYS=['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']
            const JOURS=[25,25,25,25,22,15,0,0,5,12,18,20]
            const caByM={}
            sessT.forEach(s=>{const d=s.properties.Date?.date?.start;if(d){const mk=d.substring(0,7);caByM[mk]=(caByM[mk]||0)+(s.properties.Prix?.number||0)}})
            const vals=MKEYS.map(k=>Math.round(caByM[k]||0))
            const curIdx=MKEYS.indexOf(thisMonth())
            const MAX=Math.max(...vals,OBJ_HIV)
            return (
              <div>
                <div style={{display:'flex',alignItems:'flex-end',gap:'3px',height:'48px',marginBottom:'4px'}}>
                  {vals.map((v,i)=>{
                    const isFut=i>curIdx, isCur=i===curIdx
                    const h=isFut?(JOURS[i]>0?6:2):Math.max(2,Math.round((v/MAX)*48))
                    const col=isFut?'var(--border)':v>=OBJ_CONF?'#1A8C5A':v>=OBJ_HIV?'#BA7517':v>=OBJ_EQ?'#D4820A':v>0?'#C0392B':'var(--border)'
                    return (
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end'}}>
                        <div style={{width:'100%',height:h,background:col,borderRadius:'2px 2px 0 0',position:'relative'}}>
                          {isCur && <div style={{position:'absolute',top:'-6px',left:'50%',transform:'translateX(-50%)',width:'5px',height:'5px',borderRadius:'50%',background:'var(--pierre)'}} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{display:'flex',gap:'3px'}}>
                  {MOIS.map((m,i)=>(
                    <div key={i} style={{flex:1,textAlign:'center',fontSize:'8px',color:i===curIdx?'var(--pierre)':'var(--txt3)',fontWeight:i===curIdx?700:400}}>{m}</div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* ── ACTIONS ──────────────────────────────── */}
        <button className="btn btn-primary" onClick={()=>setTab('ca')} style={{width:'100%',padding:'16px',fontSize:'15px',marginBottom:'10px',letterSpacing:'0.5px'}}>
          + Saisir mon CA du jour
        </button>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px'}}>
          <button className="btn btn-ghost" onClick={()=>setTab('depense')} style={{padding:'13px',fontSize:'13px'}}>🧾 Dépense</button>
          <button className="btn btn-ghost" onClick={()=>setTab('histo')} style={{padding:'13px',fontSize:'13px'}}>📋 Historique</button>
        </div>

        {/* À mettre de côté */}
        {caMois > 0 && (
          <div className="card" style={{padding:'12px 16px'}}>
            <div style={{fontSize:'10px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>À mettre de côté ce mois</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {[{l:'IRPF',v:r.irpf},{l:'IVA nette',v:r.iva}].map(x=>(
                <div key={x.l} style={{textAlign:'center',padding:'8px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                  <div style={{fontSize:'10px',color:'var(--txt3)',marginBottom:'2px'}}>{x.l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'16px',fontWeight:500,color:'#D4820A'}}>{fmt(x.v)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{textAlign:'center',paddingBottom:'20px'}}>
        <button onClick={onLogout} style={{background:'none',border:'none',color:'var(--txt3)',fontSize:'11px',cursor:'pointer'}}>Déconnexion</button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
