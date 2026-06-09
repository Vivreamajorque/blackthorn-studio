import React, { useState, useEffect, useRef, useCallback } from 'react'
import { notion, parsePaiement, getNbSess } from '../lib/notion'

const OBJ_EQ   = 3895
const OBJ_HIV  = 5850
const OBJ_CONF = 7500
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
  d.setDate(d.getDate()+(day===0?-6:1-day))
  return d.toISOString().split('T')[0]
}

const labelDate = (dateStr) => {
  const today = todayStr()
  const tom   = new Date(); tom.setDate(tom.getDate()+1)
  const tomStr = tom.toISOString().split('T')[0]
  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === tomStr) return 'Demain'
  const d = new Date(dateStr)
  const diff = Math.round((d - new Date(today)) / 86400000)
  if (diff > 0 && diff <= 6) return d.toLocaleDateString('fr-FR',{weekday:'long'})
  return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
}

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

const CATS=['🖊️ Matériel tatouage','🧴 Consommables','📱 Marketing','🔧 Équipement','🏠 Charges fixes','🚗 Déplacements','📦 Autre']
const NATS=['🇫🇷 FR','🇩🇪 DE','🇬🇧 EN','🇪🇸 ES','Autre']

export default function TonyDashboard({ onLogout }) {
  const [tab,       setTab]      = useState('home')
  const [sessions,  setSessions] = useState([])
  const [depenses,  setDepenses] = useState([])
  const [loading,   setLoading]  = useState(true)
  const [toast,     setToast]    = useState('')
  const fileRef   = useRef(null)
  const cameraRef = useRef(null)

  // Formulaires
  const [caForm,   setCaForm]   = useState({ ca:'', sessions:'1', paiement:'cash', natio:'🇫🇷 FR', notes:'', date:todayStr() })
  const [caSaving, setCaSaving] = useState(false)
  const [depForm,  setDepForm]  = useState({ montant:'', fournisseur:'', categorie:'🖊️ Matériel tatouage', date:todayStr(), notes:'', iva_recuperable:true })
  const [depSaving,setDepSaving]= useState(false)
  const [photo,    setPhoto]    = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [analyzing,setAnalyzing]= useState(false)
  const [uploading,setUploading]= useState(false)
  // RDV
  const [rdvForm,  setRdvForm]  = useState({ client:'', style:'', prixEstime:'', acompte:'0', natio:'🇫🇷 FR', date:'' })
  const [rdvSaving,setRdvSaving]= useState(false)
  const [confirming,setConfirming] = useState(null) // session à confirmer
  const [confForm, setConfForm] = useState({ prix:'', paiement:'cash', sessions:'1', acompte:'0' })
  // Edit
  const [editing,  setEditing]  = useState(null)
  const [editSaving,setEditSaving]=useState(false)

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const load = useCallback(async () => {
    try {
      const [s,d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isConfirme  = (s) => { const st=s.properties.Statut?.select?.name||''; return st===''||st==='✅ Confirmé' }
  const isPrevu     = (s) => s.properties.Statut?.select?.name==='🗓 Prévu'

  const m  = thisMonth()
  const td = todayStr()
  const ws = weekStart()

  const sessAll    = sessions.filter(s=>!(s.properties.Type?.select?.name||'').includes('Amely'))
  const sessConf   = sessAll.filter(isConfirme)
  const sessPrevu  = sessAll.filter(isPrevu).filter(s=>(s.properties.Date?.date?.start||'')>=td)

  const sessM = sessConf.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const sessW = sessConf.filter(s=>(s.properties.Date?.date?.start||'')>=ws)
  const sessJ = sessConf.filter(s=>s.properties.Date?.date?.start===td)

  const caMois   = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caSem    = sessW.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caJour   = sessJ.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const totalSessM = sessM.reduce((a,s)=>a+getNbSess(s),0)
  const panier   = totalSessM>0 ? Math.round(caMois/totalSessM) : 0

  const r = netReel(caMois)
  const OBJ_SEM = Math.round(OBJ_HIV/4.3)
  const colSem  = caSem>=OBJ_SEM?'#1A8C5A':caSem>=OBJ_SEM*0.6?'#D4820A':'#C0392B'
  const colMois = caMois>=OBJ_CONF?'#1A8C5A':caMois>=OBJ_HIV?'#BA7517':caMois>=OBJ_EQ?'#D4820A':'#C0392B'
  const msgMois = caMois>=OBJ_CONF
    ? {icon:'✅',text:'Confort atteint',c:'#1A8C5A'}
    : caMois>=OBJ_HIV
    ? {icon:'🌊',text:`Hiver couvert — encore ${fmt(OBJ_CONF-caMois)} pour le confort`,c:'#BA7517'}
    : caMois>=OBJ_EQ
    ? {icon:'⚖️',text:`Équilibre — encore ${fmt(OBJ_HIV-caMois)} pour tenir l'hiver`,c:'#D4820A'}
    : {icon:'📍',text:`Encore ${fmt(OBJ_EQ-caMois)} pour l'équilibre`,c:'#C0392B'}

  // CA prévisionnel (RDV planifiés)
  const caPrevMois = sessPrevu.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m)).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caPrevSem  = sessPrevu.filter(s=>(s.properties.Date?.date?.start||'')>=ws).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)

  // Prochains RDV (7 jours)
  const rdvsProchains = sessPrevu.filter(s=>{
    const d=s.properties.Date?.date?.start||''
    const limit=new Date(); limit.setDate(limit.getDate()+30)
    return d<=limit.toISOString().split('T')[0]
  }).sort((a,b)=>(a.properties.Date?.date?.start||'').localeCompare(b.properties.Date?.date?.start||''))

  // Submit CA
  const submitCA = async () => {
    if (!caForm.ca) return
    setCaSaving(true)
    try {
      await notion.addSession({
        paiement:caForm.paiement, prix:parseFloat(caForm.ca)||0,
        acompte:0, solde:parseFloat(caForm.ca)||0,
        natio:caForm.natio, date:caForm.date,
        notes:`${caForm.sessions||1} session(s)${caForm.notes?' · '+caForm.notes:''}`,
        style:caForm.notes, client:'', avis:false
      })
      showToast(parseFloat(caForm.ca)>=156?'🔥 Belle session !':'✓ CA enregistré')
      setCaForm({ca:'',sessions:'1',paiement:'cash',natio:'🇫🇷 FR',notes:'',date:todayStr()})
      setTab('home'); load()
    } catch(e) { showToast('Erreur — réessaie') }
    setCaSaving(false)
  }

  // Submit RDV prévisionnel
  const submitRDV = async () => {
    if (!rdvForm.date || !rdvForm.client) return
    setRdvSaving(true)
    try {
      await notion.addAppointment(rdvForm)
      showToast('📅 RDV enregistré')
      setRdvForm({client:'',style:'',prixEstime:'',acompte:'0',natio:'🇫🇷 FR',date:''})
      setTab('home'); load()
    } catch(e) { showToast('Erreur — réessaie') }
    setRdvSaving(false)
  }

  // Confirmer un RDV → CA
  const openConfirm = (s) => {
    const prix = s.properties.Prix?.number||0
    const acompte = s.properties['Acompte reçu']?.number||0
    setConfirming(s)
    setConfForm({prix:String(prix),paiement:'cash',sessions:'1',acompte:String(acompte)})
  }

  const submitConfirm = async () => {
    if (!confirming || !confForm.prix) return
    try {
      await notion.confirmAppointment(confirming.id, {
        prix:parseFloat(confForm.prix), paiement:confForm.paiement,
        acompte:parseFloat(confForm.acompte)||0,
        date:confirming.properties.Date?.date?.start||td,
        sessions:confForm.sessions
      })
      showToast('✅ RDV confirmé → CA du jour')
      setConfirming(null); load()
    } catch(e) { showToast('Erreur — réessaie') }
  }

  const doNoShow = async (s) => {
    try {
      await notion.noShowAppointment(s.id)
      showToast('👻 No-show enregistré')
      load()
    } catch(e) { showToast('Erreur') }
  }

  // Submit dépense
  const submitDep = async () => {
    if (!depForm.montant) return
    setDepSaving(true)
    try {
      await notion.addDepense({...depForm,saisi_par:'Tony',photoUrl:photoUrl||null})
      showToast('✓ Dépense enregistrée')
      setDepForm({montant:'',fournisseur:'',categorie:'🖊️ Matériel tatouage',date:todayStr(),notes:'',iva_recuperable:true})
      setPhoto(null); setPhotoUrl(null); setTab('home'); load()
    } catch(e) { showToast('Erreur') }
    setDepSaving(false)
  }

  // Photo
  const handlePhoto = async (e) => {
    const file=e.target.files?.[0]; if(!file) return
    setAnalyzing(true)
    const reader=new FileReader()
    reader.onload=async(ev)=>{
      setPhoto(ev.target.result)
      setUploading(true)
      fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:ev.target.result,filename:file.name||'ticket.jpg'})})
        .then(r=>r.json()).then(d=>{if(d.url){setPhotoUrl(d.url);showToast('✓ Photo OK')}}).catch(()=>{}).finally(()=>setUploading(false))
      try {
        const res=await fetch('/api/analyze-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:ev.target.result.split(',')[1],mediaType:file.type})})
        const data=await res.json()
        if(!data.manual&&data.montant){ setDepForm(f=>({...f,montant:data.montant?.toString()||f.montant,fournisseur:data.fournisseur||f.fournisseur,date:data.date||f.date})); showToast('✓ Ticket analysé') }
      }catch(e){}
      setAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // Edit
  const openEdit = (s) => {
    const fullNotes = s.properties.Notes?.rich_text?.[0]?.plain_text||''
    const sessMatch = fullNotes.match(/^(\d+)\s*session/)
    const sessions  = sessMatch?.[1]||'1'
    const notes     = fullNotes.replace(/^\d+\s*session\(s?\)\s*·?\s*/,'').trim()
    const ca        = s.properties.Prix?.number||0
    const title     = s.properties.Session?.title?.[0]?.plain_text||''
    const isCash    = !title.startsWith('[CARTE]')
    const natio     = s.properties.Nationalité?.select?.name||'Autre'
    const date      = s.properties.Date?.date?.start||todayStr()
    setEditing({id:s.id,ca:String(ca),sessions,paiement:isCash?'cash':'carte',natio,date,notes})
    setTab('edit')
  }

  const submitEdit = async () => {
    if (!editing?.ca) return
    setEditSaving(true)
    try {
      await notion.updateSession(editing.id,{
        prix:parseFloat(editing.ca), paiement:editing.paiement||'cash',
        sessions:parseInt(editing.sessions)||1,
        date:editing.date, notes:editing.notes,
        type:'🖤 Tattoo Tony', natio:editing.natio||'Autre'
      })
      showToast('✓ Modifié'); setEditing(null); setTab('histo'); load()
    }catch(e){ showToast('Erreur') }
    setEditSaving(false)
  }

  const doDelete = async (id) => {
    try { await notion.deleteSession(id); showToast('Supprimé'); load() }catch(e){ showToast('Erreur') }
  }

  // ── PAGES ─────────────────────────────────────────

  const NatBtns = ({val,onChange}) => (
    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'4px'}}>
      {NATS.map(n=>(
        <button key={n} type="button" onClick={()=>onChange(n)} style={{
          padding:'7px 10px',borderRadius:'var(--r)',fontSize:'12px',fontWeight:600,cursor:'pointer',transition:'all .15s',
          background:val===n?'var(--txt)':'var(--card)',color:val===n?'var(--bg)':'var(--txt2)',
          border:val===n?'none':'1.5px solid var(--border2)'
        }}>{n}</button>
      ))}
    </div>
  )

  const PayBtns = ({val,onChange}) => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
      {['cash','carte'].map(p=>(
        <button key={p} type="button" onClick={()=>onChange(p)} style={{
          padding:'12px',borderRadius:'var(--r)',fontFamily:'var(--font-head)',fontWeight:700,fontSize:'14px',cursor:'pointer',transition:'all .15s',
          background:val===p?(p==='cash'?'#1A8C5A':'#2980B9'):'var(--card)',
          color:val===p?'#fff':'var(--txt2)',border:val===p?'none':'1.5px solid var(--border2)'
        }}>{p==='cash'?'💵 Cash':'💳 Carte'}</button>
      ))}
    </div>
  )

  if (tab==='ca') return (
    <div style={{padding:'24px 20px 40px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Mon CA du jour</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div style={{textAlign:'center',marginBottom:'20px'}}>
        <input type="number" inputMode="decimal" placeholder="0"
          value={caForm.ca} onChange={e=>setCaForm({...caForm,ca:e.target.value})}
          style={{fontSize:'52px',fontFamily:'var(--font-mono)',fontWeight:500,textAlign:'center',background:'transparent',border:'none',borderBottom:'2px solid var(--pierre)',borderRadius:0,color:'var(--txt)',width:'220px',padding:'8px 0'}}/>
        {caForm.ca>0&&(
          <div style={{marginTop:'8px',fontSize:'12px',color:parseFloat(caForm.ca)>=156?'#1A8C5A':'var(--txt3)'}}>
            {parseFloat(caForm.ca)>=156?'✅ Objectif jour atteint':`${Math.round(156-parseFloat(caForm.ca))}€ manquant`}
            {parseInt(caForm.sessions)>1&&caForm.ca>0&&(<span> · ≈ {Math.round(parseFloat(caForm.ca)/(parseInt(caForm.sessions)||1))}€/session</span>)}
          </div>
        )}
      </div>
      <div style={{marginBottom:'16px'}}><PayBtns val={caForm.paiement} onChange={p=>setCaForm({...caForm,paiement:p})}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>Nb sessions</label>
          <input type="number" inputMode="numeric" value={caForm.sessions} onChange={e=>setCaForm({...caForm,sessions:e.target.value})} style={{textAlign:'center',fontSize:'20px'}}/>
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Date</label>
          <input type="date" min="2026-06-01" value={caForm.date} onChange={e=>setCaForm({...caForm,date:e.target.value})}/>
        </div>
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Nationalité client</label>
        <NatBtns val={caForm.natio} onChange={n=>setCaForm({...caForm,natio:n})}/>
      </div>
      <div className="form-group" style={{marginBottom:'20px'}}>
        <label>Notes (style, infos...)</label>
        <textarea rows="2" value={caForm.notes} onChange={e=>setCaForm({...caForm,notes:e.target.value})} style={{resize:'none'}} placeholder="Ex: botanical avant-bras..."/>
      </div>
      <button className="btn btn-primary" onClick={submitCA} disabled={caSaving||!caForm.ca} style={{width:'100%',padding:'16px',fontSize:'15px'}}>
        {caSaving?'Enregistrement...':'✓ Valider'}
      </button>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )

  if (tab==='rdv') return (
    <div style={{padding:'24px 20px 40px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Nouveau RDV prévu</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Client (prénom ou identifiant) *</label>
        <input placeholder="Ex: Marie, Tattoo bras..." value={rdvForm.client} onChange={e=>setRdvForm({...rdvForm,client:e.target.value})}/>
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Style / Projet</label>
        <input placeholder="Ex: Botanique full sleeve, Portrait..." value={rdvForm.style} onChange={e=>setRdvForm({...rdvForm,style:e.target.value})}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>Prix estimé (€)</label>
          <input type="number" inputMode="decimal" placeholder="0" value={rdvForm.prixEstime} onChange={e=>setRdvForm({...rdvForm,prixEstime:e.target.value})} style={{textAlign:'center',fontSize:'18px',fontFamily:'var(--font-mono)'}}/>
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Acompte reçu (€)</label>
          <input type="number" inputMode="decimal" placeholder="0" value={rdvForm.acompte} onChange={e=>setRdvForm({...rdvForm,acompte:e.target.value})} style={{textAlign:'center',fontSize:'18px',fontFamily:'var(--font-mono)'}}/>
        </div>
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Date du RDV *</label>
        <input type="date" min={todayStr()} value={rdvForm.date} onChange={e=>setRdvForm({...rdvForm,date:e.target.value})}/>
      </div>
      <div className="form-group" style={{marginBottom:'20px'}}>
        <label>Nationalité</label>
        <NatBtns val={rdvForm.natio} onChange={n=>setRdvForm({...rdvForm,natio:n})}/>
      </div>
      <button className="btn btn-primary" onClick={submitRDV} disabled={rdvSaving||!rdvForm.client||!rdvForm.date} style={{width:'100%',padding:'16px',fontSize:'15px'}}>
        {rdvSaving?'Enregistrement...':'📅 Enregistrer le RDV'}
      </button>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )

  if (tab==='edit'&&editing) return (
    <div style={{padding:'24px 20px 40px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Modifier l'entrée</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('histo');setEditing(null)}} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'8px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>CA total (€)</label>
          <input type="number" inputMode="decimal" value={editing.ca} onChange={e=>setEditing({...editing,ca:e.target.value})} style={{fontSize:'22px',textAlign:'center',fontFamily:'var(--font-mono)'}}/>
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Nb sessions</label>
          <input type="number" inputMode="numeric" value={editing.sessions} onChange={e=>setEditing({...editing,sessions:e.target.value})} style={{textAlign:'center',fontSize:'22px'}}/>
        </div>
      </div>
      {parseInt(editing.sessions)>1&&editing.ca>0&&(
        <div style={{textAlign:'center',fontSize:'12px',color:'var(--txt3)',marginBottom:'10px'}}>
          ≈ {Math.round(parseFloat(editing.ca)/(parseInt(editing.sessions)||1))}€ par session
        </div>
      )}
      <div style={{marginBottom:'14px'}}><PayBtns val={editing.paiement} onChange={p=>setEditing({...editing,paiement:p})}/></div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Nationalité</label>
        <NatBtns val={editing.natio} onChange={n=>setEditing({...editing,natio:n})}/>
      </div>
      <div className="form-group" style={{marginBottom:'12px'}}>
        <label>Date</label>
        <input type="date" min="2026-06-01" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/>
      </div>
      <div className="form-group" style={{marginBottom:'20px'}}>
        <label>Notes</label>
        <input value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})} placeholder="Style, infos..."/>
      </div>
      <button className="btn btn-primary" onClick={submitEdit} disabled={editSaving||!editing.ca} style={{width:'100%',padding:'14px',marginBottom:'10px'}}>
        {editSaving?'Sauvegarde...':'✓ Sauvegarder'}
      </button>
      <button onClick={()=>{if(confirm('Supprimer ?')){doDelete(editing.id);setEditing(null);setTab('histo')}}}
        style={{width:'100%',padding:'12px',background:'transparent',border:'1.5px solid #C0392B',color:'#C0392B',borderRadius:'var(--r)',cursor:'pointer',fontSize:'13px',fontFamily:'var(--font-head)',fontWeight:600}}>
        🗑 Supprimer
      </button>
    </div>
  )

  if (tab==='depense') return (
    <div style={{padding:'24px 20px 40px',minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Dépense / Facture</div>
        <button className="btn btn-ghost" onClick={()=>{setTab('home');setPhoto(null);setPhotoUrl(null)}} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}}/>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{display:'none'}}/>
      {!photo?(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'14px'}}>
          <button onClick={()=>cameraRef.current?.click()} className="btn btn-ghost" style={{padding:'16px',flexDirection:'column',gap:'4px',fontSize:'12px'}}>
            <span style={{fontSize:'22px'}}>📷</span>Photo
          </button>
          <button onClick={()=>fileRef.current?.click()} className="btn btn-ghost" style={{padding:'16px',flexDirection:'column',gap:'4px',fontSize:'12px'}}>
            <span style={{fontSize:'22px'}}>📁</span>Fichier
          </button>
        </div>
      ):(
        <div style={{marginBottom:'14px',position:'relative'}}>
          <img src={photo} style={{width:'100%',borderRadius:'var(--r)',maxHeight:'130px',objectFit:'cover'}}/>
          {(analyzing||uploading)&&<div style={{position:'absolute',inset:0,background:'rgba(255,255,255,.85)',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px'}}>{analyzing?'🔍 Analyse...':'☁️ Upload...'}</div>}
          <button onClick={()=>{setPhoto(null);setPhotoUrl(null)}} style={{position:'absolute',top:6,right:6,background:'rgba(0,0,0,.5)',border:'none',color:'#fff',borderRadius:'50%',width:24,height:24,cursor:'pointer'}}>×</button>
          {photoUrl&&<div style={{position:'absolute',bottom:6,right:6,background:'#1A8C5A',borderRadius:'4px',padding:'2px 6px',fontSize:'10px',color:'#fff',fontWeight:600}}>✓ OK</div>}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
        <div className="form-group" style={{margin:0}}>
          <label>Montant TTC (€) *</label>
          <input type="number" inputMode="decimal" placeholder="0.00" value={depForm.montant} onChange={e=>setDepForm({...depForm,montant:e.target.value})} style={{fontSize:'22px',textAlign:'center',fontFamily:'var(--font-mono)'}}/>
        </div>
        <div className="form-group" style={{margin:0}}>
          <label>Date</label>
          <input type="date" value={depForm.date} onChange={e=>setDepForm({...depForm,date:e.target.value})}/>
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
        <input placeholder="Kwadron, Mercadona..." value={depForm.fournisseur} onChange={e=>setDepForm({...depForm,fournisseur:e.target.value})}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
        <input type="checkbox" id="iva" checked={depForm.iva_recuperable} onChange={e=>setDepForm({...depForm,iva_recuperable:e.target.checked})} style={{width:18,height:18,accentColor:'var(--pierre)',cursor:'pointer'}}/>
        <label htmlFor="iva" style={{fontSize:'13px',color:'var(--txt2)',cursor:'pointer'}}>IVA récupérable (21%)</label>
      </div>
      <button className="btn btn-primary" onClick={submitDep} disabled={depSaving||!depForm.montant} style={{width:'100%',padding:'16px'}}>
        {depSaving?'Enregistrement...':'✓ Enregistrer'}
      </button>
    </div>
  )

  if (tab==='histo') return (
    <div style={{padding:'20px 16px 90px',background:'var(--bg)',minHeight:'100vh'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800}}>Historique</div>
        <button className="btn btn-ghost" onClick={()=>setTab('home')} style={{padding:'6px 14px',fontSize:'12px'}}>← Retour</button>
      </div>
      <div className="section-title">CA réalisé</div>
      {sessConf.slice(0,15).map(s=>{
        const ca=s.properties.Prix?.number||0
        const date=s.properties.Date?.date?.start||''
        const notes=s.properties.Notes?.rich_text?.[0]?.plain_text||''
        const nb=getNbSess(s)
        const notesTxt=notes.replace(/^\d+\s*session\(s?\)\s*·?\s*/,'')
        const isCash=parsePaiement(s)==='cash'
        return (
          <div key={s.id} className="card" onClick={()=>openEdit(s)}
            style={{marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer'}}>
            <div>
              <div style={{fontSize:'12px',fontWeight:500,color:'var(--txt2)'}}>{date}</div>
              {notesTxt&&<div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'2px'}}>{notesTxt}</div>}
              <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{nb} session{nb>1?'s':''}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'3px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'16px',fontWeight:600,color:ca>=156?'#1A8C5A':'var(--txt)'}}>{ca}€</span>
              <span style={{fontSize:'9px',padding:'2px 6px',borderRadius:'6px',fontWeight:700,background:isCash?'rgba(26,140,90,.1)':'rgba(41,128,185,.1)',color:isCash?'#1A8C5A':'#2980B9'}}>{isCash?'CASH':'CARTE'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── HOME ──────────────────────────────────────────
  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',paddingBottom:'80px'}}>

      {/* Confirmation RDV — bottom sheet */}
      {confirming&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setConfirming(null)}>
          <div style={{background:'var(--bg)',borderRadius:'16px 16px 0 0',width:'100%',maxWidth:480,padding:'24px 20px 40px'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,marginBottom:'4px'}}>✅ RDV confirmé</div>
            <div style={{fontSize:'12px',color:'var(--txt3)',marginBottom:'16px'}}>
              {confirming.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'} · {confirming.properties.Date?.date?.start||''}
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{fontSize:'11px',fontWeight:600,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'.8px',display:'block',marginBottom:'6px'}}>CA total (€)</label>
              <input type="number" inputMode="decimal" value={confForm.prix} onChange={e=>setConfForm({...confForm,prix:e.target.value})}
                style={{fontSize:'36px',fontFamily:'var(--font-mono)',fontWeight:500,textAlign:'center',background:'transparent',border:'none',borderBottom:'2px solid var(--pierre)',borderRadius:0,color:'var(--txt)',width:'100%',padding:'6px 0'}}/>
            </div>
            {parseFloat(confForm.acompte)>0&&(
              <div style={{fontSize:'12px',color:'var(--txt3)',textAlign:'center',marginBottom:'10px'}}>
                Acompte déjà reçu : {confForm.acompte}€ → solde : {Math.max(0,parseFloat(confForm.prix||0)-parseFloat(confForm.acompte))}€
              </div>
            )}
            <div style={{marginBottom:'16px'}}><PayBtns val={confForm.paiement} onChange={p=>setConfForm({...confForm,paiement:p})}/></div>
            <button className="btn btn-primary" onClick={submitConfirm} disabled={!confForm.prix} style={{width:'100%',padding:'14px',fontSize:'15px',marginBottom:'8px'}}>
              ✓ Valider → CA du jour
            </button>
            <button onClick={()=>setConfirming(null)} style={{width:'100%',padding:'10px',background:'transparent',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:'13px'}}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 20px 16px',borderBottom:'1px solid var(--border)'}}>
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{height:'38px',filter:'brightness(0)',opacity:0.85}}/>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'11px',color:'var(--txt3)'}}>{new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</span>
          <button onClick={load} style={{background:'none',border:'none',fontSize:'16px',color:'var(--txt3)',cursor:'pointer'}}>↻</button>
        </div>
      </div>

      <div style={{padding:'20px'}}>

        {/* ARCS */}
        <div className="card" style={{marginBottom:'14px',padding:'20px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',justifyItems:'center',marginBottom:'14px'}}>
            <Arc pct={Math.min(100,Math.round(caSem/OBJ_SEM*100))} color={colSem} label="Semaine"
              value={caSem>0?fmt(caSem):'—'} sub={caSem>0?`/ ${fmt(OBJ_SEM)}`:null}
              sub2={caSem>=OBJ_SEM?'✓ Objectif':caSem>0?`−${fmt(OBJ_SEM-caSem)}`:null}/>
            <Arc pct={Math.min(100,Math.round(caMois/OBJ_HIV*100))} color={colMois} label="Mois"
              value={caMois>0?fmt(caMois):'—'} sub={caMois>0?`${Math.round(caMois/OBJ_HIV*100)}%`:null}
              sub2={caMois>=OBJ_EQ?(caMois>=OBJ_HIV?'✓ Hiver couvert':'⚖️ Équilibre'):caMois>0?`−${fmt(OBJ_EQ-caMois)}`:null}/>
          </div>
          <div style={{padding:'10px 14px',background:msgMois.c+'15',borderRadius:'var(--r)',borderLeft:`3px solid ${msgMois.c}`}}>
            <span style={{fontSize:'12px',fontWeight:600,color:msgMois.c}}>{msgMois.icon} {msgMois.text}</span>
          </div>
          {/* Prévisionnel affiché si RDV planifiés */}
          {(caPrevSem>0||caPrevMois>0)&&(
            <div style={{marginTop:'8px',padding:'8px 12px',background:'rgba(41,128,185,.08)',borderRadius:'var(--r)',fontSize:'11px',color:'#2980B9'}}>
              📅 Prévisionnel : +{fmt(caPrevSem)} cette semaine · +{fmt(caPrevMois)} ce mois
            </div>
          )}
        </div>

        {/* CARTE PRÉVISIONNEL — jauge CA restant */}
        {(()=>{
          const totalPrevu   = caMois + caPrevMois
          const restant      = Math.max(0, OBJ_HIV - totalPrevu)
          const pctConf      = Math.min(100, (caMois   / OBJ_HIV) * 100)
          const pctPrev      = Math.min(100 - pctConf, (caPrevMois / OBJ_HIV) * 100)
          const pctTotal     = Math.min(100, pctConf + pctPrev)
          const depasse      = totalPrevu >= OBJ_HIV

          return (
            <div className="card" style={{marginBottom:'14px',padding:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <div style={{fontSize:'10px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1.5px',fontWeight:600}}>Prévisionnel mois</div>
                <div style={{fontSize:'11px',color:depasse?'#1A8C5A':'var(--txt3)'}}>
                  obj. {fmt(OBJ_HIV)}
                </div>
              </div>

              {/* BARRE DE PROGRESSION double couche */}
              <div style={{position:'relative',height:'14px',background:'var(--bg2)',borderRadius:'7px',overflow:'hidden',marginBottom:'8px'}}>
                {/* Fond prévu (bleu clair) */}
                {pctPrev > 0 && (
                  <div style={{
                    position:'absolute',left:pctConf+'%',top:0,bottom:0,
                    width:pctPrev+'%',
                    background:'rgba(41,128,185,.35)',
                    backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.3) 4px,rgba(255,255,255,.3) 8px)',
                    transition:'width .5s'
                  }}/>
                )}
                {/* Confirmé (couleur selon seuil) */}
                <div style={{
                  position:'absolute',left:0,top:0,bottom:0,
                  width:pctConf+'%',
                  background:caMois>=OBJ_HIV?'#1A8C5A':caMois>=3895?'#D4820A':'#C0392B',
                  borderRadius:'7px',
                  transition:'width .5s'
                }}/>
                {/* Trait objectif */}
                <div style={{position:'absolute',top:0,bottom:0,left:'100%',width:'2px',background:'rgba(0,0,0,.15)'}}/>
              </div>

              {/* Légende chiffres */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px',marginBottom:'10px'}}>
                {[
                  {l:'Réalisé',v:fmt(caMois),c:caMois>=3895?'#D4820A':'#C0392B',dot:caMois>=3895?'#D4820A':'#C0392B'},
                  {l:'Planifié',v:caPrevMois>0?'+'+fmt(caPrevMois):'—',c:'#2980B9',dot:'rgba(41,128,185,.5)'},
                  {l:'Total estimé',v:fmt(totalPrevu),c:depasse?'#1A8C5A':totalPrevu>=3895?'#D4820A':'#C0392B',dot:null},
                ].map(x=>(
                  <div key={x.l} style={{textAlign:'center',padding:'6px 4px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'4px',marginBottom:'2px'}}>
                      {x.dot&&<span style={{width:6,height:6,borderRadius:'50%',background:x.dot,display:'inline-block',flexShrink:0}}/>}
                      <span style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px'}}>{x.l}</span>
                    </div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'14px',fontWeight:600,color:x.c}}>{x.v}</div>
                  </div>
                ))}
              </div>

              {/* Message restant */}
              <div style={{padding:'8px 12px',borderRadius:'var(--r)',
                background:depasse?'rgba(26,140,90,.08)':restant<1000?'rgba(212,130,10,.08)':'rgba(192,57,43,.06)',
                borderLeft:`3px solid ${depasse?'#1A8C5A':restant<1000?'#D4820A':'#C0392B'}`}}>
                {depasse ? (
                  <span style={{fontSize:'12px',fontWeight:600,color:'#1A8C5A'}}>
                    ✅ Objectif hiver couvert avec {fmt(totalPrevu - OBJ_HIV)} de marge
                  </span>
                ) : (
                  <div>
                    <span style={{fontSize:'12px',fontWeight:600,color:restant<1000?'#D4820A':'#C0392B'}}>
                      📍 Encore {fmt(restant)} à réaliser
                    </span>
                    {caPrevMois > 0 && (
                      <span style={{fontSize:'11px',color:'var(--txt3)',display:'block',marginTop:'2px'}}>
                        RDV planifiés : +{fmt(caPrevMois)} → reste {fmt(Math.max(0,OBJ_HIV-totalPrevu))} à trouver
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* PANIER + AUJOURD'HUI + NET */}
        <div className="card" style={{marginBottom:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
            {[
              {l:'Panier moyen',v:panier>0?panier+'€':'—',u:`${totalSessM} sess.`,c:panier>=200?'#1A8C5A':panier>=156?'#D4820A':'var(--txt)'},
              {l:"Aujourd'hui",v:caJour>0?caJour+'€':'—',u:sessJ.length>0?sessJ.length+' sess.':'—',c:caJour>=156?'#1A8C5A':caJour>0?'#D4820A':'var(--txt3)'},
              {l:'Net estimé',v:fmt(r.net),u:'après impôts',c:r.net>=PERSO?'#1A8C5A':'#C0392B'},
            ].map(x=>(
              <div key={x.l} style={{textAlign:'center',padding:'10px 4px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'3px',lineHeight:1.3}}>{x.l}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'19px',fontWeight:500,color:x.c}}>{x.v}</div>
                <div style={{fontSize:'9px',color:'var(--txt3)',marginTop:'2px'}}>{x.u}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PROCHAINS RDV */}
        {rdvsProchains.length>0&&(
          <div style={{marginBottom:'14px'}}>
            <div className="section-title">Prochains rendez-vous</div>
            {rdvsProchains.slice(0,5).map(s=>{
              const client=s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'
              const style=s.properties['Style / Type']?.rich_text?.[0]?.plain_text||''
              const prix=s.properties.Prix?.number||0
              const acompte=s.properties['Acompte reçu']?.number||0
              const date=s.properties.Date?.date?.start||''
              const isToday=date===td
              return (
                <div key={s.id} className="card" style={{marginBottom:'8px',padding:'12px 14px',borderLeft:`3px solid ${isToday?'#D4820A':'var(--pierre)'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'13px',fontWeight:700,color:isToday?'#D4820A':'var(--txt)'}}>{labelDate(date)}</span>
                        {isToday&&<span style={{fontSize:'10px',padding:'2px 6px',background:'rgba(212,130,10,.1)',color:'#D4820A',borderRadius:'4px',fontWeight:600}}>AUJOURD'HUI</span>}
                      </div>
                      <div style={{fontSize:'12px',fontWeight:500,marginTop:'2px'}}>{client}</div>
                      {style&&<div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'1px'}}>{style}</div>}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:'16px',fontWeight:600}}>{prix}€</div>
                      {acompte>0&&<div style={{fontSize:'10px',color:'#1A8C5A'}}>Acompte: {acompte}€</div>}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                    <button onClick={()=>openConfirm(s)} style={{padding:'9px',borderRadius:'var(--r)',background:'rgba(26,140,90,.1)',border:'1.5px solid rgba(26,140,90,.3)',color:'#1A8C5A',fontFamily:'var(--font-head)',fontWeight:700,fontSize:'12px',cursor:'pointer'}}>
                      ✅ Client venu
                    </button>
                    <button onClick={()=>doNoShow(s)} style={{padding:'9px',borderRadius:'var(--r)',background:'rgba(150,150,150,.08)',border:'1.5px solid var(--border2)',color:'var(--txt3)',fontFamily:'var(--font-head)',fontWeight:700,fontSize:'12px',cursor:'pointer'}}>
                      👻 No-show
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* GRAPHE ANNUEL DÉTAILLÉ */}
        {(()=>{
          const MOIS_L=['Juin','Juil','Août','Sep','Oct','Nov','Déc','Jan','Fév','Mar','Avr','Mai']
          const MOIS_S=['J','Jl','A','S','O','N','D','J','F','M','A','M']
          const MKEYS=['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05']
          const caByM={}
          sessConf.forEach(s=>{const d=s.properties.Date?.date?.start||'';if(d){const mk=d.substring(0,7);caByM[mk]=(caByM[mk]||0)+(s.properties.Prix?.number||0)}})
          // Aussi ajouter le prévisionnel
          sessPrevu.forEach(s=>{const d=s.properties.Date?.date?.start||'';if(d){const mk=d.substring(0,7);if(!caByM[mk+'_prev']) caByM[mk+'_prev']=0; caByM[mk+'_prev']+=(s.properties.Prix?.number||0)}})
          const vals=MKEYS.map(k=>Math.round(caByM[k]||0))
          const valsP=MKEYS.map(k=>Math.round(caByM[k+'_prev']||0))
          const curIdx=MKEYS.indexOf(thisMonth())
          const MAX=Math.max(...vals,...valsP.map((v,i)=>v+vals[i]),OBJ_CONF,100)
          const CHART_H=100

          return (
            <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div style={{fontSize:'10px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:600}}>Avancée mensuelle</div>
                <div style={{display:'flex',gap:'10px',fontSize:'9px',color:'var(--txt3)'}}>
                  {[{c:'#1A8C5A',l:'>5850€'},{c:'#D4820A',l:'3895-5850'},{c:'#C0392B',l:'<3895'},{c:'rgba(41,128,185,.25)',l:'Prévu'}].map(x=>(
                    <span key={x.l} style={{display:'flex',alignItems:'center',gap:'3px'}}>
                      <span style={{width:7,height:7,borderRadius:1,background:x.c,display:'inline-block',flexShrink:0}}/>
                      {x.l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ligne cible */}
              <div style={{position:'relative'}}>
                <div style={{position:'relative',height:CHART_H,marginBottom:'2px'}}>
                  {/* Ligne cible OBJ_HIV */}
                  <div style={{position:'absolute',top:(1-(OBJ_HIV/MAX))*CHART_H+'px',left:0,right:0,height:'1px',background:'rgba(186,117,23,.4)',zIndex:2}}>
                    <span style={{position:'absolute',right:0,top:'-10px',fontSize:'8px',color:'#BA7517',fontWeight:600}}>234€/j</span>
                  </div>
                  {/* Ligne cible OBJ_EQ */}
                  <div style={{position:'absolute',top:(1-(OBJ_EQ/MAX))*CHART_H+'px',left:0,right:0,height:'1px',background:'rgba(212,130,10,.3)',zIndex:2}}>
                    <span style={{position:'absolute',right:0,top:'-10px',fontSize:'8px',color:'#D4820A',fontWeight:600}}>156€/j</span>
                  </div>
                  
                  {/* Barres */}
                  <div style={{display:'flex',alignItems:'flex-end',gap:'3px',height:'100%',position:'relative',zIndex:1}}>
                    {vals.map((v,i)=>{
                      const isFut=i>curIdx, isCur=i===curIdx
                      const hConf=isFut?0:Math.round((v/MAX)*CHART_H)
                      const hPrev=Math.round((valsP[i]/MAX)*CHART_H)
                      const col=isFut?'var(--border)':v>=OBJ_CONF?'#1A8C5A':v>=OBJ_HIV?'#BA7517':v>=OBJ_EQ?'#D4820A':v>0?'#C0392B':'var(--border)'
                      return (
                        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%',position:'relative'}}>
                          {/* Valeur au dessus */}
                          {(v>0||valsP[i]>0)&&!isFut&&(
                            <div style={{position:'absolute',top:Math.max(0,CHART_H-hConf-hPrev-16)+'px',fontSize:'8px',fontFamily:'var(--font-mono)',color:col,fontWeight:600,whiteSpace:'nowrap',textAlign:'center',zIndex:3}}>
                              {v>=1000?(v/1000).toFixed(1)+'k':v>0?v:''}
                              {valsP[i]>0&&<span style={{color:'#2980B9'}}>{v>0?'+':''}{valsP[i]>=1000?(valsP[i]/1000).toFixed(1)+'k':valsP[i]}</span>}
                            </div>
                          )}
                          <div style={{width:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:'100%'}}>
                            {/* Barre prévisionnelle */}
                            {hPrev>0&&(
                              <div style={{width:'100%',height:hPrev+'px',background:'rgba(41,128,185,.25)',borderRadius:hConf>0?0:'2px 2px 0 0',border:'1px dashed rgba(41,128,185,.5)',borderBottom:'none'}}/>
                            )}
                            {/* Barre réelle */}
                            {hConf>0&&(
                              <div style={{width:'100%',height:hConf+'px',background:col,borderRadius:hPrev>0?0:'2px 2px 0 0',position:'relative'}}>
                                {isCur&&<div style={{position:'absolute',top:'-5px',left:'50%',transform:'translateX(-50%)',width:5,height:5,borderRadius:'50%',background:'var(--pierre)'}}/>}
                              </div>
                            )}
                            {hConf===0&&!isFut&&(
                              <div style={{width:'100%',height:'3px',background:'var(--border)',borderRadius:'2px 2px 0 0'}}/>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* Labels mois */}
                <div style={{display:'flex',gap:'3px',borderTop:'1px solid var(--border)',paddingTop:'4px'}}>
                  {MOIS_S.map((mo,i)=>(
                    <div key={i} style={{flex:1,textAlign:'center',fontSize:'8px',
                      color:i===curIdx?'var(--pierre)':'var(--txt3)',
                      fontWeight:i===curIdx?700:400}}>{mo}</div>
                  ))}
                </div>
              </div>

              {/* Total mois en cours */}
              <div style={{marginTop:'10px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'11px',color:'var(--txt3)'}}>
                <span>{MOIS_L[curIdx>=0?curIdx:0]} : <span style={{fontFamily:'var(--font-mono)',color:'var(--txt)',fontWeight:600}}>{fmt(vals[curIdx>=0?curIdx:0])}</span>
                  {valsP[curIdx>=0?curIdx:0]>0&&<span style={{color:'#2980B9'}}> + {fmt(valsP[curIdx>=0?curIdx:0])} prévu</span>}
                </span>
                <span>Annuel : <span style={{fontFamily:'var(--font-mono)',color:'var(--txt)',fontWeight:600}}>{fmt(vals.reduce((a,v)=>a+v,0))}</span></span>
              </div>
            </div>
          )
        })()}

        {/* ACTIONS */}
        <button className="btn btn-primary" onClick={()=>setTab('ca')} style={{width:'100%',padding:'16px',fontSize:'15px',marginBottom:'10px'}}>
          + Saisir mon CA du jour
        </button>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'14px'}}>
          <button className="btn btn-ghost" onClick={()=>setTab('rdv')} style={{padding:'11px',fontSize:'12px',flexDirection:'column',gap:'2px'}}>
            <span>📅</span>RDV prévu
          </button>
          <button className="btn btn-ghost" onClick={()=>setTab('depense')} style={{padding:'11px',fontSize:'12px',flexDirection:'column',gap:'2px'}}>
            <span>🧾</span>Dépense
          </button>
          <button className="btn btn-ghost" onClick={()=>setTab('histo')} style={{padding:'11px',fontSize:'12px',flexDirection:'column',gap:'2px'}}>
            <span>📋</span>Historique
          </button>
        </div>

        {/* IRPF / IVA */}
        {caMois>0&&(
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
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )
}
