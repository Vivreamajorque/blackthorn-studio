import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const todayStr = () => new Date().toISOString().split('T')[0]
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—'
const daysUntil = (d) => Math.round((new Date(d) - new Date()) / 86400000)

const STATUS_COLORS = {
  '💡 Idée':       'var(--txt3)',
  '✍️ À créer':    'var(--amber)',
  '🎬 Tourné':     'var(--blue)',
  '✅ Publié':     'var(--green)',
  '❌ Annulé':     'var(--red)',
  '📋 Planifiée':  'var(--txt3)',
  '🚀 Active':     'var(--green)',
  '⏸ En pause':   'var(--amber)',
  '✅ Terminée':   'var(--blue)',
  '❌ Annulée':    'var(--red)',
  '📋 À préparer':'var(--txt3)',
  '🚀 En cours':  'var(--green)',
  '✅ Passé':      'var(--blue)',
  '💡 Opportunité':'var(--amber)',
}

const PILIERS = ["🎨 L'Art", "🌴 Le Lieu", "👥 L'Équipe", "🤝 La Communauté", "🎉 Événement"]
const FORMATS = ['Post photo', 'Reel/Vidéo', 'Story', 'Carousel', 'Flash promo', 'Événement']
const PLATS   = ['📸 Instagram', '👥 Facebook', '🎵 TikTok', '⭐ Google Business']
const TYPES_PROMO = ["🏖️ Flash été", "🚴 Cyclist's Ink", "🌍 Pack Expat", "🎉 Événement local", "🎁 Fidélisation", "📢 Autre"]
const TYPES_EVT   = ['🎉 Fête locale', '🎪 Foire/Marché', '🚴 Cyclisme', '🌴 Touristique', '🎨 Art/Culture', '⚓ Nautique', '🏟️ Studio']

export default function Communication() {
  const [tab,      setTab]      = useState('dashboard')
  const [contenus, setContenus] = useState([])
  const [promos,   setPromos]   = useState([])
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState('')
  const [modal,    setModal]    = useState(null) // 'contenu' | 'promo' | 'event'
  const [saving,   setSaving]   = useState(false)

  const [cForm, setCForm] = useState({ contenu:'', pilier:"🎨 L'Art", format:'Post photo', statut:'💡 Idée', date:todayStr(), plateformes:['📸 Instagram'], caption:'', hashtags:'', notes:'' })
  const [pForm, setPForm] = useState({ nom:'', type:"🏖️ Flash été", statut:'📋 Planifiée', offre:'', cible:'', dateDebut:'', dateFin:'', notes:'' })
  const [eForm, setEForm] = useState({ nom:'', type:'🎉 Fête locale', statut:'📋 À préparer', lieu:'', date:'', action:'', notes:'' })

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, p, e] = await Promise.all([
        notion.getCalendrierEditorial().catch(()=>({results:[]})),
        notion.getPromos().catch(()=>({results:[]})),
        notion.getEvenements().catch(()=>({results:[]})),
      ])
      if (c.results) setContenus(c.results)
      if (p.results) setPromos(p.results)
      if (e.results) setEvents(e.results)
    } catch(err) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Données dashboard
  const today = todayStr()
  const promosActives  = promos.filter(p=>p.properties.Statut?.select?.name==='🚀 Active')
  const evtsProchains  = events.filter(e=>{
    const d = e.properties.Date?.date?.start
    return d && daysUntil(d) >= -1 && daysUntil(d) <= 30
  }).sort((a,b)=>a.properties.Date?.date?.start?.localeCompare(b.properties.Date?.date?.start||'')||0)
  const contenusThisWeek = contenus.filter(c=>{
    const d = c.properties.Date?.date?.start||''
    const ws = new Date(); ws.setDate(ws.getDate()+(ws.getDay()===0?-6:1-ws.getDay()))
    const we = new Date(ws); we.setDate(we.getDate()+6)
    return d >= ws.toISOString().split('T')[0] && d <= we.toISOString().split('T')[0]
  })
  const contenusAPub = contenus.filter(c=>['💡 Idée','✍️ À créer','🎬 Tourné'].includes(c.properties.Statut?.select?.name||''))
  const contenusPublies = contenus.filter(c=>c.properties.Statut?.select?.name==='✅ Publié').length

  const saveContenu = async () => {
    if(!cForm.contenu) return
    setSaving(true)
    try {
      await notion.addContenu(cForm)
      showToast('✓ Contenu ajouté')
      setCForm({contenu:'',pilier:"🎨 L'Art",format:'Post photo',statut:'💡 Idée',date:todayStr(),plateformes:['📸 Instagram'],caption:'',hashtags:'',notes:''})
      setModal(null); load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const savePromo = async () => {
    if(!pForm.nom) return
    setSaving(true)
    try {
      await notion.addPromo(pForm)
      showToast('✓ Promo ajoutée')
      setPForm({nom:'',type:"🏖️ Flash été",statut:'📋 Planifiée',offre:'',cible:'',dateDebut:'',dateFin:'',notes:''})
      setModal(null); load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const saveEvent = async () => {
    if(!eForm.nom) return
    setSaving(true)
    try {
      await notion.addEvenement(eForm)
      showToast('✓ Événement ajouté')
      setEForm({nom:'',type:'🎉 Fête locale',statut:'📋 À préparer',lieu:'',date:'',action:'',notes:''})
      setModal(null); load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const togglePlat = (p) => {
    setCForm(f=>({ ...f, plateformes: f.plateformes.includes(p) ? f.plateformes.filter(x=>x!==p) : [...f.plateformes,p] }))
  }

  const TABS = [
    {id:'dashboard',l:'Vue d\'ensemble'},
    {id:'calendrier',l:'Calendrier'},
    {id:'promos',l:'Promos'},
    {id:'evenements',l:'Événements'},
  ]

  return (
    <div style={{background:'var(--bg)',minHeight:'100dvh',paddingBottom:'90px'}}>

      {/* MODALES */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(26,18,9,.55)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setModal(null)}>
          <div style={{background:'var(--surface)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,padding:'8px 20px 40px',maxHeight:'90dvh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{width:36,height:4,background:'var(--border2)',borderRadius:2,margin:'0 auto 16px'}}/>

            {/* MODAL CONTENU */}
            {modal==='contenu'&&<>
              <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,marginBottom:'16px'}}>+ Nouveau contenu</div>
              <div className="form-group"><label>Titre / description</label>
                <input value={cForm.contenu} onChange={e=>setCForm({...cForm,contenu:e.target.value})} placeholder="Ex: Time-lapse rose botanique..."/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div className="form-group" style={{margin:0}}><label>Date</label>
                  <input type="date" value={cForm.date} onChange={e=>setCForm({...cForm,date:e.target.value})}/>
                </div>
                <div className="form-group" style={{margin:0}}><label>Statut</label>
                  <select value={cForm.statut} onChange={e=>setCForm({...cForm,statut:e.target.value})}>
                    {['💡 Idée','✍️ À créer','🎬 Tourné','✅ Publié'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div className="form-group" style={{margin:0}}><label>Pilier</label>
                  <select value={cForm.pilier} onChange={e=>setCForm({...cForm,pilier:e.target.value})}>
                    {PILIERS.map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}><label>Format</label>
                  <select value={cForm.format} onChange={e=>setCForm({...cForm,format:e.target.value})}>
                    {FORMATS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}><label>Plateformes</label>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'4px'}}>
                  {PLATS.map(p=>(
                    <button key={p} onClick={()=>togglePlat(p)} style={{padding:'5px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,cursor:'pointer',background:cForm.plateformes.includes(p)?'var(--txt)':'var(--surface)',color:cForm.plateformes.includes(p)?'var(--bg)':'var(--txt2)',border:cForm.plateformes.includes(p)?'none':'1.5px solid var(--border2)'}}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}><label>Caption (optionnel)</label>
                <textarea rows={2} value={cForm.caption} onChange={e=>setCForm({...cForm,caption:e.target.value})} style={{resize:'none'}} placeholder="Texte du post..."/>
              </div>
              <div className="form-group" style={{marginBottom:'16px'}}><label>Hashtags</label>
                <input value={cForm.hashtags} onChange={e=>setCForm({...cForm,hashtags:e.target.value})} placeholder="#mallorcatattoo #finelinetattoo..."/>
              </div>
              <button className="btn btn-gold" onClick={saveContenu} disabled={saving||!cForm.contenu} style={{width:'100%',padding:'14px',fontSize:'14px'}}>
                {saving?'Enregistrement...':'✓ Ajouter au calendrier'}
              </button>
            </>}

            {/* MODAL PROMO */}
            {modal==='promo'&&<>
              <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,marginBottom:'16px'}}>+ Nouvelle promotion</div>
              <div className="form-group"><label>Nom de la promo</label>
                <input value={pForm.nom} onChange={e=>setPForm({...pForm,nom:e.target.value})} placeholder="Ex: Flash été Majorque"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div className="form-group" style={{margin:0}}><label>Type</label>
                  <select value={pForm.type} onChange={e=>setPForm({...pForm,type:e.target.value})}>
                    {TYPES_PROMO.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}><label>Statut</label>
                  <select value={pForm.statut} onChange={e=>setPForm({...pForm,statut:e.target.value})}>
                    {['📋 Planifiée','🚀 Active','⏸ En pause','✅ Terminée'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div className="form-group" style={{margin:0}}><label>Début</label>
                  <input type="date" value={pForm.dateDebut} onChange={e=>setPForm({...pForm,dateDebut:e.target.value})}/>
                </div>
                <div className="form-group" style={{margin:0}}><label>Fin</label>
                  <input type="date" value={pForm.dateFin} onChange={e=>setPForm({...pForm,dateFin:e.target.value})}/>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}><label>Offre / Réduction</label>
                <input value={pForm.offre} onChange={e=>setPForm({...pForm,offre:e.target.value})} placeholder="Ex: Prix fixe 100€ · Slot 1h"/>
              </div>
              <div className="form-group" style={{marginBottom:'16px'}}><label>Cible</label>
                <input value={pForm.cible} onChange={e=>setPForm({...pForm,cible:e.target.value})} placeholder="Ex: Touristes juillet-août"/>
              </div>
              <button className="btn btn-gold" onClick={savePromo} disabled={saving||!pForm.nom} style={{width:'100%',padding:'14px',fontSize:'14px'}}>
                {saving?'Enregistrement...':'✓ Créer la promotion'}
              </button>
            </>}

            {/* MODAL ÉVÉNEMENT */}
            {modal==='event'&&<>
              <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,marginBottom:'16px'}}>+ Nouvel événement</div>
              <div className="form-group"><label>Nom de l'événement</label>
                <input value={eForm.nom} onChange={e=>setEForm({...eForm,nom:e.target.value})} placeholder="Ex: Fira de Campos"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                <div className="form-group" style={{margin:0}}><label>Type</label>
                  <select value={eForm.type} onChange={e=>setEForm({...eForm,type:e.target.value})}>
                    {TYPES_EVT.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0}}><label>Date</label>
                  <input type="date" value={eForm.date} onChange={e=>setEForm({...eForm,date:e.target.value})}/>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:'10px'}}><label>Lieu</label>
                <input value={eForm.lieu} onChange={e=>setEForm({...eForm,lieu:e.target.value})} placeholder="Ex: Campos centre"/>
              </div>
              <div className="form-group" style={{marginBottom:'16px'}}><label>Action Blackthorn prévue</label>
                <textarea rows={2} value={eForm.action} onChange={e=>setEForm({...eForm,action:e.target.value})} style={{resize:'none'}} placeholder="Ex: Stand · Flyers · Promo flash 3 jours"/>
              </div>
              <button className="btn btn-gold" onClick={saveEvent} disabled={saving||!eForm.nom} style={{width:'100%',padding:'14px',fontSize:'14px'}}>
                {saving?'Enregistrement...':'✓ Ajouter l\'événement'}
              </button>
            </>}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 16px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 8px rgba(26,18,9,.04)'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,letterSpacing:'-.3px'}}>Communication</div>
        <div style={{display:'flex',gap:'6px'}}>
          <button onClick={()=>setModal('contenu')} style={{padding:'6px 12px',borderRadius:'20px',background:'var(--txt)',color:'var(--bg)',border:'none',fontSize:'11px',fontFamily:'var(--font-head)',fontWeight:700,cursor:'pointer'}}>+ Contenu</button>
          <button onClick={load} style={{width:32,height:32,borderRadius:'50%',background:'var(--bg)',border:'1px solid var(--border2)',fontSize:'14px',color:'var(--txt3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>↻</button>
        </div>
      </div>

      <div style={{padding:'14px 16px 0'}}>
        {/* TABS */}
        <div style={{display:'flex',gap:'6px',marginBottom:'16px',overflowX:'auto',paddingBottom:'2px'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flexShrink:0,padding:'7px 14px',borderRadius:'20px',fontSize:'11px',cursor:'pointer',
              background:tab===t.id?'var(--txt)':'var(--surface)',
              color:tab===t.id?'var(--bg)':'var(--txt2)',
              border:tab===t.id?'none':'1px solid var(--border2)',
              fontFamily:'var(--font-head)',fontWeight:700,boxShadow:tab===t.id?'var(--shadow-sm)':'none'
            }}>{t.l}</button>
          ))}
        </div>

        {loading&&<div style={{textAlign:'center',padding:'40px',color:'var(--txt3)',fontSize:'12px'}}>Chargement...</div>}

        {/* ══ DASHBOARD ════════════════════════════════ */}
        {!loading&&tab==='dashboard'&&(
          <div>
            {/* Stats rapides */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'6px',marginBottom:'14px'}}>
              {[
                {l:'Contenus à créer',v:contenusAPub.length,c:contenusAPub.length>5?'var(--amber)':'var(--txt)'},
                {l:'Publiés',v:contenusPublies,c:'var(--green)'},
                {l:'Promos actives',v:promosActives.length,c:promosActives.length>0?'var(--green)':'var(--txt3)'},
                {l:'Événements 30j',v:evtsProchains.length,c:evtsProchains.length>0?'var(--blue)':'var(--txt3)'},
              ].map(x=>(
                <div key={x.l} className="card" style={{textAlign:'center',padding:'10px 6px'}}>
                  <div style={{fontSize:'8px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'3px',lineHeight:1.2}}>{x.l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'22px',fontWeight:500,color:x.c}}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* Contenus cette semaine */}
            {contenusThisWeek.length>0&&(
              <div style={{marginBottom:'14px'}}>
                <div className="section-title-gold" style={{marginBottom:'8px'}}>Cette semaine</div>
                {contenusThisWeek.map(c=>{
                  const st=c.properties.Statut?.select?.name||'💡 Idée'
                  const col=STATUS_COLORS[st]||'var(--txt3)'
                  const d=c.properties.Date?.date?.start||''
                  return (
                    <div key={c.id} className="card" style={{marginBottom:'6px',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:'12px',fontWeight:600}}>{c.properties.Contenu?.title?.[0]?.plain_text||'—'}</div>
                        <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{fmtDate(d)} · {c.properties.Format?.select?.name}</div>
                      </div>
                      <span style={{fontSize:'11px',fontWeight:700,color:col,flexShrink:0,marginLeft:'10px'}}>{st}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Promos actives */}
            {promosActives.length>0&&(
              <div style={{marginBottom:'14px'}}>
                <div className="section-title-gold" style={{marginBottom:'8px'}}>Promos actives 🚀</div>
                {promosActives.map(p=>(
                  <div key={p.id} className="card" style={{marginBottom:'6px',padding:'12px 14px',borderLeft:'3px solid var(--green)'}}>
                    <div style={{fontSize:'13px',fontWeight:700,marginBottom:'2px'}}>{p.properties.Promotion?.title?.[0]?.plain_text||'—'}</div>
                    <div style={{fontSize:'11px',color:'var(--txt3)'}}>{p.properties['Réduction / Offre']?.rich_text?.[0]?.plain_text||''}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Événements imminents */}
            {evtsProchains.length>0&&(
              <div style={{marginBottom:'14px'}}>
                <div className="section-title-gold" style={{marginBottom:'8px'}}>Événements dans 30 jours</div>
                {evtsProchains.slice(0,5).map(e=>{
                  const d=e.properties.Date?.date?.start||''
                  const diff=daysUntil(d)
                  const nom=e.properties['Événement']?.title?.[0]?.plain_text||'—'
                  const action=e.properties['Action Blackthorn']?.rich_text?.[0]?.plain_text||''
                  return (
                    <div key={e.id} className="card" style={{marginBottom:'6px',padding:'10px 14px',borderLeft:`3px solid ${diff<=7?'var(--red)':diff<=14?'var(--amber)':'var(--gold)'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <div>
                          <div style={{fontSize:'12px',fontWeight:700}}>{nom}</div>
                          {action&&<div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{action}</div>}
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,marginLeft:'10px'}}>
                          <div style={{fontFamily:'var(--font-mono)',fontSize:'14px',fontWeight:600,color:diff<=7?'var(--red)':diff<=14?'var(--amber)':'var(--txt)'}}>{diff===0?'Auj.':diff===1?'Dem.':`J-${diff}`}</div>
                          <div style={{fontSize:'9px',color:'var(--txt3)'}}>{fmtDate(d)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Stratégie */}
            <div className="card" style={{padding:'14px',background:'rgba(196,168,130,.06)',border:'1px solid var(--gold-lt)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--gold-dk)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:'8px'}}>Positionnement studio</div>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--txt)',marginBottom:'4px',fontStyle:'italic'}}>"L'atelier parisien qui a posé ses machines à Majorque"</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'6px'}}>
                {['Précision','Authenticité','Intimité'].map(w=>(
                  <span key={w} style={{fontSize:'11px',padding:'3px 10px',background:'var(--gold-lt)',borderRadius:'20px',color:'var(--gold-dk)',fontWeight:600}}>{w}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ CALENDRIER ÉDITORIAL ═════════════════════ */}
        {!loading&&tab==='calendrier'&&(
          <div>
            <button onClick={()=>setModal('contenu')} className="btn btn-gold" style={{width:'100%',padding:'12px',marginBottom:'14px',fontSize:'13px'}}>
              + Ajouter un contenu
            </button>
            {contenus.length===0
              ? <div className="card" style={{textAlign:'center',padding:'32px',border:'1.5px dashed var(--border2)'}}><div style={{fontSize:'24px',marginBottom:'8px'}}>📅</div><div style={{fontSize:'12px',color:'var(--txt3)'}}>Aucun contenu planifié<br/>Commence à organiser ton calendrier éditorial</div></div>
              : contenus.map(c=>{
                const nom=c.properties.Contenu?.title?.[0]?.plain_text||'—'
                const d=c.properties.Date?.date?.start||''
                const st=c.properties.Statut?.select?.name||'💡 Idée'
                const pilier=c.properties.Pilier?.select?.name||''
                const format=c.properties.Format?.select?.name||''
                const col=STATUS_COLORS[st]||'var(--txt3)'
                return (
                  <div key={c.id} className="card" style={{marginBottom:'8px',padding:'12px 14px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'13px',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nom}</div>
                        <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'3px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
                          <span>{fmtDate(d)}</span>
                          {pilier&&<span>{pilier}</span>}
                          {format&&<span>{format}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:'11px',fontWeight:700,color:col,flexShrink:0,marginLeft:'10px',padding:'2px 6px',background:col+'18',borderRadius:'8px'}}>{st}</span>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ══ PROMOS ═══════════════════════════════════ */}
        {!loading&&tab==='promos'&&(
          <div>
            <button onClick={()=>setModal('promo')} className="btn btn-gold" style={{width:'100%',padding:'12px',marginBottom:'14px',fontSize:'13px'}}>
              + Nouvelle promotion
            </button>
            {promos.length===0
              ? <div className="card" style={{textAlign:'center',padding:'32px',border:'1.5px dashed var(--border2)'}}><div style={{fontSize:'24px',marginBottom:'8px'}}>🎯</div><div style={{fontSize:'12px',color:'var(--txt3)'}}>Aucune promo créée</div></div>
              : promos.map(p=>{
                const nom=p.properties.Promotion?.title?.[0]?.plain_text||'—'
                const st=p.properties.Statut?.select?.name||'📋 Planifiée'
                const type=p.properties.Type?.select?.name||''
                const offre=p.properties['Réduction / Offre']?.rich_text?.[0]?.plain_text||''
                const cible=p.properties.Cible?.rich_text?.[0]?.plain_text||''
                const deb=p.properties['Date début']?.date?.start||''
                const fin=p.properties['Date fin']?.date?.start||''
                const col=STATUS_COLORS[st]||'var(--txt3)'
                const rdv=p.properties['RDV générés']?.number||0
                const ca=p.properties['CA généré']?.number||0
                return (
                  <div key={p.id} className="card" style={{marginBottom:'10px',padding:'14px',borderLeft:`3px solid ${st==='🚀 Active'?'var(--green)':st==='📋 Planifiée'?'var(--gold)':'var(--border)'}` }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:700}}>{nom}</div>
                        <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px'}}>{type}</div>
                      </div>
                      <span style={{fontSize:'11px',fontWeight:700,color:col,padding:'2px 7px',background:col+'18',borderRadius:'8px',flexShrink:0,marginLeft:'8px'}}>{st}</span>
                    </div>
                    {offre&&<div style={{fontSize:'11px',color:'var(--txt2)',marginBottom:'4px',padding:'5px 8px',background:'var(--bg)',borderRadius:'var(--r)'}}>{offre}</div>}
                    {cible&&<div style={{fontSize:'10px',color:'var(--txt3)',marginBottom:'4px'}}>🎯 {cible}</div>}
                    <div style={{display:'flex',gap:'8px',fontSize:'10px',color:'var(--txt3)',flexWrap:'wrap'}}>
                      {deb&&<span>Du {fmtDate(deb)}</span>}
                      {fin&&<span>au {fmtDate(fin)}</span>}
                      {rdv>0&&<span style={{color:'var(--green)',fontWeight:700}}>{rdv} RDV générés</span>}
                      {ca>0&&<span style={{color:'var(--green)',fontWeight:700,fontFamily:'var(--font-mono)'}}>{ca}€ CA</span>}
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ══ ÉVÉNEMENTS ═══════════════════════════════ */}
        {!loading&&tab==='evenements'&&(
          <div>
            <button onClick={()=>setModal('event')} className="btn btn-gold" style={{width:'100%',padding:'12px',marginBottom:'14px',fontSize:'13px'}}>
              + Nouvel événement
            </button>
            {events.length===0
              ? <div className="card" style={{textAlign:'center',padding:'32px',border:'1.5px dashed var(--border2)'}}><div style={{fontSize:'24px',marginBottom:'8px'}}>🗓️</div><div style={{fontSize:'12px',color:'var(--txt3)'}}>Aucun événement</div></div>
              : events.map(e=>{
                const nom=e.properties['Événement']?.title?.[0]?.plain_text||'—'
                const d=e.properties.Date?.date?.start||''
                const type=e.properties.Type?.select?.name||''
                const st=e.properties.Statut?.select?.name||''
                const action=e.properties['Action Blackthorn']?.rich_text?.[0]?.plain_text||''
                const lieu=e.properties.Lieu?.rich_text?.[0]?.plain_text||''
                const diff=d?daysUntil(d):999
                const col=STATUS_COLORS[st]||'var(--txt3)'
                const urgency=diff>=0&&diff<=7?'var(--red)':diff<=14?'var(--amber)':diff<=30?'var(--gold)':'var(--border)'
                return (
                  <div key={e.id} className="card" style={{marginBottom:'10px',padding:'14px',borderLeft:`3px solid ${urgency}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:700}}>{nom}</div>
                        <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
                          <span>{type}</span>
                          {lieu&&<span>📍 {lieu}</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0,marginLeft:'10px'}}>
                        {d&&<div style={{fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:600,color:urgency==='var(--border)'?'var(--txt)':urgency}}>{diff<0?'Passé':diff===0?'Auj.':diff===1?'Dem.':`J-${diff}`}</div>}
                        <div style={{fontSize:'9px',color:'var(--txt3)'}}>{fmtDate(d)}</div>
                        <span style={{fontSize:'9px',fontWeight:700,color:col,display:'block',marginTop:'2px'}}>{st}</span>
                      </div>
                    </div>
                    {action&&<div style={{fontSize:'11px',color:'var(--txt2)',padding:'6px 8px',background:'var(--bg)',borderRadius:'var(--r)',marginTop:'6px'}}>{action}</div>}
                  </div>
                )
              })
            }
          </div>
        )}
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )
}
