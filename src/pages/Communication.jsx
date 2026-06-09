import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const todayStr   = () => new Date().toISOString().split('T')[0]
const fmtDate    = (d) => d ? new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—'
const daysUntil  = (d) => Math.round((new Date(d) - new Date()) / 86400000)
const DAY_NAMES  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const DAY_SHORT  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

const STATUS_C = {
  '💡 Idée':'var(--txt3)', '✍️ À créer':'var(--amber)', '🎬 Tourné':'var(--blue)',
  '✅ Publié':'var(--green)', '❌ Annulé':'var(--red)',
  '📋 Planifiée':'var(--txt3)', '🚀 Active':'var(--green)', '⏸ En pause':'var(--amber)',
  '✅ Terminée':'var(--blue)', '📋 À préparer':'var(--txt3)', '🚀 En cours':'var(--green)',
  '✅ Passé':'var(--blue)', '💡 Opportunité':'var(--amber)',
}

// Planning hebdomadaire fixe
const WEEKLY_PLAN = {
  1: [ // Lundi
    {time:'10h',task:'📸 Filmer Tony qui dessine une esquisse',type:'film'},
    {time:'12h',task:'📸 Publier Instagram : photo healed tattoo',type:'publish'},
    {time:'19h',task:'🎵 Publier TikTok/Reel : time-lapse',type:'publish'},
    {time:'20h',task:'💬 Story : disponibilités de la semaine',type:'engage'},
  ],
  2: [ // Mardi
    {time:'Session',task:'🎬 Déclencher time-lapse pendant la session',type:'film'},
    {time:'12h30',task:'📸 Story Instagram : WIP (work in progress)',type:'publish'},
    {time:'19h',task:'🎵 TikTok : "Prix de ce tatouage ?"',type:'publish'},
  ],
  3: [ // Mercredi
    {time:'12h',task:'📸 Reel éducatif (aftercare, FAQ, style)',type:'publish'},
    {time:'13h',task:'🎵 TikTok : même contenu recyclé',type:'publish'},
    {time:'14h',task:'⭐ Post Google Business : photo + offre',type:'publish'},
    {time:'Libre',task:'🛒 Flyers au marché Santanyí si possible',type:'prospect'},
  ],
  4: [ // Jeudi
    {time:'12h',task:'📸 Instagram : healed photo ou coulisses',type:'publish'},
    {time:'14h',task:'💬 Répondre à TOUS les DMs et commentaires',type:'engage'},
    {time:'Soir',task:'📸 Partager tag client en Story',type:'engage'},
  ],
  5: [ // Vendredi
    {time:'11h',task:'🎵 TikTok/Reel : storytelling ou format perso',type:'publish'},
    {time:'17h',task:'📸 Story : "Dernières disponibilités semaine prochaine"',type:'publish'},
    {time:'19h',task:'👥 Facebook : partager le meilleur post de la semaine',type:'publish'},
    {time:'20h',task:'📩 3 DMs de prospection (hôtels, fincas, groupes)',type:'prospect'},
  ],
  6: [ // Samedi
    {time:'Session',task:'🎬 Filmer process pendant tatouage',type:'film'},
    {time:'14h',task:'📸 Carousel : "Cette semaine au studio"',type:'publish'},
    {time:'20h',task:'🎵 TikTok : best-of ou contenu fun/perso',type:'publish'},
  ],
  0: [ // Dimanche
    {time:'Soir',task:'🌿 1 Story légère (Campos, Es Trenc, vie locale)',type:'publish'},
    {time:'20h',task:'📋 Planifier le contenu de la semaine prochaine',type:'plan'},
    {time:'21h',task:'💬 Répondre aux DMs restants',type:'engage'},
  ],
}

const TASK_COLORS = {film:'rgba(41,128,185,.12)',publish:'rgba(26,121,74,.1)',engage:'rgba(196,168,130,.15)',prospect:'rgba(154,82,0,.1)',plan:'rgba(30,30,30,.05)'}
const TASK_BORDER = {film:'var(--blue)',publish:'var(--green)',engage:'var(--gold)',prospect:'var(--amber)',plan:'var(--border2)'}

// Toutes les promos
const PROMOS_STATIC = [
  {nom:'🏆 World Cup Ink — Rep ta nation',type:'🌍',quand:'11 juin - 19 juillet 2026',cible:'Toutes nationalités · 48 pays',offre:'Flash drapeaux + designs nations · Designs footballistiques · Post par match des équipes qualifiées',statut:'🚀 Active'},
  {nom:'🌑 Flash Éclipse Totale',type:'☀️',quand:'12 août 2026 (soir)',cible:'Eclipse-chasers + touristes août',offre:'10 designs célestes 80-100€ · Regarder l'éclipse Es Trenc + tatouage au soir · Commemoratif unique',statut:'📋 Planifiée'},
  {nom:'Flash été "Souvenir de Majorque"',type:'🏖️',quand:'Juil-Août',cible:'Touristes Es Trenc',offre:'Prix fixe 80-120€ · Flash designs Majorque · Slot 1h',statut:'📋 Planifiée'},
  {nom:"Cyclist's Ink",type:'🚴',quand:'Avr-Oct',cible:'Cyclistes EU',offre:'-15% sur présentation dossard ou photo sur vélo',statut:'📋 Planifiée'},
  {nom:'Pack Expat',type:'🌍',quand:'Toute l\'année',cible:'Nouveaux résidents',offre:'2ème séance -20% sur présentation NIE',statut:'📋 Planifiée'},
  {nom:'Referral "Amène ton pote"',type:'🤝',quand:'Toujours actif',cible:'Clients existants',offre:'-10% sur prochain tatouage pour toi ET ton ami',statut:'📋 Planifiée'},
  {nom:'Flash Day mensuel',type:'⚡',quand:'1er samedi/mois',cible:'Tous',offre:'5 designs flash à 50-80€ · 5 places max · Annonce J-7',statut:'📋 Planifiée'},
  {nom:'Anniversaire 1 an studio',type:'🎂',quand:'Sept 2026',cible:'Tous',offre:'Journée flash prices spéciaux + champagne',statut:'📋 Planifiée'},
  {nom:'Gift Vouchers',type:'🎁',quand:'Noël + toute l\'année',cible:'Entourage clients',offre:'Bons cadeaux tout montant · Offrir un tatouage',statut:'💡 Idée'},
  {nom:'Fidélisation 3ème pièce',type:'⭐',quand:'Automatique',cible:'Clients récurrents',offre:'-15% sur 3ème tatouage dans l\'année',statut:'💡 Idée'},
  {nom:'Birthday flash',type:'🎈',quand:'Toujours actif',cible:'Fêtes d\'anniversaire',offre:'-10% le mois de ton anniversaire · Sur preuve',statut:'💡 Idée'},
  {nom:'Cover-up specialist',type:'🔄',quand:'Toujours actif',cible:'Regrets tatouage',offre:'Consultation gratuite cover-up · Cibler mauvais tatouages',statut:'💡 Idée'},
  {nom:'Nautique/Marina',type:'⚓',quand:'Avr-Oct',cible:'Communauté Sa Ràpita',offre:'Flash designs maritimes · Flyers Club Nàutic',statut:'💡 Idée'},
  {nom:'Flash Sant Joan 24h',type:'🔥',quand:'23-24 juin',cible:'Tous',offre:'Tatouage symbolique 70€ pendant 24h · Fête locale',statut:'🚀 Active'},
]

// Prospection physique
const PROSPECTION = [
  {lieu:'Hôtels Es Trenc (Bikini, fincas)',action:'20 flyers avec concierge',freq:'Mensuel',prio:'🔴'},
  {lieu:'Club Nàutic Sa Ràpita',action:'Flyers + parler au bar',freq:'Juin-Oct',prio:'🔴'},
  {lieu:'Marché Santanyí (mer+sam)',action:'Flyer aux artisans, touristes',freq:'Chaque semaine',prio:'🔴'},
  {lieu:'Barbershop Campos',action:'Échange flyers / cartes',freq:'Cette semaine',prio:'🔴'},
  {lieu:'Restaurants Carrer Santanyí',action:'Cartes de visite · demander affichage',freq:'Cette semaine',prio:'🔴'},
  {lieu:'Yoga studios (Ses Salines)',action:'Flyers',freq:'Juil-Août',prio:'🟠'},
  {lieu:'Boutiques surf/kite Es Trenc',action:'Échange flyers',freq:'Juil-Août',prio:'🟠'},
  {lieu:'Groupes Facebook FR Majorque',action:'Post de présentation (1x/groupe)',freq:'Cette semaine',prio:'🟠'},
  {lieu:'Agences immobilières expats',action:'Flyers nouveaux arrivants',freq:'Mensuel',prio:'🟡'},
  {lieu:'Hôtels boutique Santanyí',action:'Partenariat conciergerie',freq:'Mensuel',prio:'🟡'},
]

const TABS = [
  {id:'today',l:'Aujourd\'hui'},
  {id:'planning',l:'Planning sem.'},
  {id:'promos',l:'Promos'},
  {id:'events',l:'Événements'},
  {id:'prospection',l:'Prospection'},
]

export default function Communication() {
  const [tab,      setTab]    = useState('today')
  const [contenus, setCont]   = useState([])
  const [events,   setEvents] = useState([])
  const [loading,  setLoad]   = useState(true)
  const [toast,    setToast]  = useState('')
  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''),2500) }

  const load = useCallback(async () => {
    setLoad(true)
    try {
      const [c, e] = await Promise.all([
        notion.getCalendrierEditorial().catch(()=>({results:[]})),
        notion.getEvenements().catch(()=>({results:[]})),
      ])
      if(c.results) setCont(c.results)
      if(e.results) setEvents(e.results)
    } catch(err){}
    setLoad(false)
  }, [])
  useEffect(()=>{ load() },[load])

  const today = todayStr()
  const dayOfWeek = new Date().getDay()
  const todayPlan = WEEKLY_PLAN[dayOfWeek] || []
  const todayName = DAY_NAMES[dayOfWeek]

  const contToday  = contenus.filter(c=>c.properties.Date?.date?.start===today)
  const contWeek   = contenus.filter(c=>{
    const d=c.properties.Date?.date?.start||''
    const ws=new Date(); ws.setDate(ws.getDate()+(ws.getDay()===0?-6:1-ws.getDay()))
    const we=new Date(ws); we.setDate(we.getDate()+6)
    return d>=ws.toISOString().split('T')[0] && d<=we.toISOString().split('T')[0]
  })
  const evtsProchains = events
    .filter(e=>{const d=e.properties.Date?.date?.start||''; return d>=today})
    .sort((a,b)=>(a.properties.Date?.date?.start||'').localeCompare(b.properties.Date?.date?.start||''))
    .slice(0,5)
  const promosActives = PROMOS_STATIC.filter(p=>p.statut==='🚀 Active')

  return (
    <div style={{background:'var(--bg)',minHeight:'100dvh',paddingBottom:'90px'}}>
      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 16px 12px',background:'var(--surface)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 8px rgba(26,18,9,.04)'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'15px',fontWeight:800,letterSpacing:'-.3px'}}>Communication</div>
        <button onClick={load} style={{width:30,height:30,borderRadius:'50%',background:'var(--bg)',border:'1px solid var(--border2)',fontSize:'13px',color:'var(--txt3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>↻</button>
      </div>

      <div style={{padding:'12px 16px 0'}}>
        {/* TABS */}
        <div style={{display:'flex',gap:'5px',marginBottom:'14px',overflowX:'auto',paddingBottom:'2px'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flexShrink:0,padding:'6px 12px',borderRadius:'20px',fontSize:'11px',cursor:'pointer',
              background:tab===t.id?'var(--txt)':'var(--surface)',
              color:tab===t.id?'var(--bg)':'var(--txt2)',
              border:tab===t.id?'none':'1px solid var(--border2)',
              fontFamily:'var(--font-head)',fontWeight:700,
              boxShadow:tab===t.id?'var(--shadow-sm)':'none'
            }}>{t.l}</button>
          ))}
        </div>

        {/* ══ AUJOURD'HUI ══════════════════════════════ */}
        {tab==='today'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <div>
                <div style={{fontFamily:'var(--font-head)',fontSize:'18px',fontWeight:800,letterSpacing:'-.3px'}}>{todayName}</div>
                <div style={{fontSize:'11px',color:'var(--txt3)',marginTop:'1px'}}>{new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</div>
              </div>
              {promosActives.length>0&&(
                <div style={{padding:'4px 10px',background:'rgba(26,121,74,.1)',borderRadius:'20px',fontSize:'11px',color:'var(--green)',fontWeight:700}}>
                  🚀 {promosActives.length} promo active{promosActives.length>1?'s':''}
                </div>
              )}
            </div>

            {/* PROMO ACTIVE */}
            {promosActives.map(p=>(
              <div key={p.nom} style={{marginBottom:'10px',padding:'10px 14px',background:'rgba(26,121,74,.07)',borderRadius:'var(--r)',borderLeft:'3px solid var(--green)'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:'var(--green)'}}>{p.type} {p.nom} — ACTIVE</div>
                <div style={{fontSize:'11px',color:'var(--txt2)',marginTop:'2px'}}>{p.offre}</div>
              </div>
            ))}

            {/* PLAN DU JOUR */}
            <div className="section-title-gold" style={{marginBottom:'10px'}}>Plan d'action du jour</div>
            {todayPlan.map((task,i)=>(
              <div key={i} style={{
                display:'flex',gap:'12px',alignItems:'flex-start',
                padding:'10px 12px',borderRadius:'var(--r)',marginBottom:'6px',
                background:TASK_COLORS[task.type]||'var(--bg)',
                borderLeft:`3px solid ${TASK_BORDER[task.type]||'var(--border)'}`,
              }}>
                <div style={{fontSize:'11px',fontFamily:'var(--font-mono)',color:'var(--txt3)',flexShrink:0,minWidth:'40px',paddingTop:'1px'}}>{task.time}</div>
                <div style={{fontSize:'13px',fontWeight:500,color:'var(--txt)',flex:1}}>{task.task}</div>
              </div>
            ))}

            {/* CONTENUS PLANIFIÉS AUJOURD'HUI */}
            {contToday.length>0&&(
              <div style={{marginTop:'14px'}}>
                <div className="section-title" style={{marginBottom:'8px'}}>Contenus prévus aujourd'hui</div>
                {contToday.map(c=>(
                  <div key={c.id} className="card" style={{marginBottom:'6px',padding:'10px 14px',borderLeft:`3px solid ${STATUS_C[c.properties.Statut?.select?.name]||'var(--border)'}`}}>
                    <div style={{fontSize:'12px',fontWeight:600}}>{c.properties.Contenu?.title?.[0]?.plain_text||'—'}</div>
                    <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{c.properties.Format?.select?.name} · {c.properties.Statut?.select?.name}</div>
                  </div>
                ))}
              </div>
            )}

            {/* EVENTS IMMINENTS */}
            {evtsProchains.length>0&&(
              <div style={{marginTop:'14px'}}>
                <div className="section-title" style={{marginBottom:'8px'}}>Événements à venir</div>
                {evtsProchains.slice(0,3).map(e=>{
                  const d=e.properties.Date?.date?.start||''
                  const diff=daysUntil(d)
                  const nom=e.properties['Événement']?.title?.[0]?.plain_text||'—'
                  return (
                    <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'var(--surface)',borderRadius:'var(--r)',border:'1px solid var(--border)',marginBottom:'5px'}}>
                      <span style={{fontSize:'12px',fontWeight:500}}>{nom}</span>
                      <span style={{fontSize:'11px',fontWeight:700,color:diff<=7?'var(--red)':diff<=14?'var(--amber)':'var(--txt3)',fontFamily:'var(--font-mono)',flexShrink:0,marginLeft:'8px'}}>
                        {diff===0?'Auj.':diff===1?'Dem.':`J-${diff}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* RÈGLES D'OR */}
            <div style={{marginTop:'16px',padding:'12px 14px',background:'rgba(196,168,130,.08)',borderRadius:'var(--r)',border:'1px solid var(--gold-lt)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--gold-dk)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:'8px'}}>Règles d'or</div>
              {['Filmer AVANT de tatouer (demander accord client)','1 session = 1 contenu minimum','Recycler : TikTok + Reel + Story','Répondre aux commentaires dans les 2h','Légendes : ES / EN / FR'].map((r,i)=>(
                <div key={i} style={{fontSize:'11px',color:'var(--txt2)',marginBottom:'4px',display:'flex',gap:'6px'}}>
                  <span style={{color:'var(--gold)',flexShrink:0}}>→</span>{r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ PLANNING SEMAINE ═════════════════════════ */}
        {tab==='planning'&&(
          <div>
            <div style={{marginBottom:'14px',padding:'12px 14px',background:'rgba(196,168,130,.08)',borderRadius:'var(--r)',border:'1px solid var(--gold-lt)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--gold-dk)',textTransform:'uppercase',letterSpacing:'1.5px',marginBottom:'6px'}}>Horaires optimaux de publication</div>
              <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                {[{h:'12h00',why:'Pause déjeuner Europe'},{h:'17h30',why:'Fin de journée'},{h:'19h00',why:'Prime time RS'},{h:'7h30',why:'TikTok uniquement'}].map(x=>(
                  <div key={x.h} style={{padding:'4px 10px',background:'var(--surface)',borderRadius:'20px',border:'1px solid var(--border)'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',fontWeight:600}}>{x.h}</span>
                    <span style={{fontSize:'10px',color:'var(--txt3)',marginLeft:'5px'}}>{x.why}</span>
                  </div>
                ))}
              </div>
            </div>

            {[1,2,3,4,5,6,0].map(d=>{
              const isToday = d===dayOfWeek
              const tasks = WEEKLY_PLAN[d]||[]
              return (
                <div key={d} style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                    <div style={{
                      width:32,height:32,borderRadius:'50%',flexShrink:0,
                      background:isToday?'var(--txt)':'transparent',
                      border:isToday?'none':'1.5px solid var(--border2)',
                      display:'flex',alignItems:'center',justifyContent:'center'
                    }}>
                      <span style={{fontSize:'11px',fontWeight:700,color:isToday?'var(--bg)':'var(--txt3)'}}>{DAY_SHORT[d]}</span>
                    </div>
                    <span style={{fontSize:'13px',fontWeight:700,color:isToday?'var(--txt)':'var(--txt2)'}}>{DAY_NAMES[d]}{isToday&&' — Aujourd\'hui'}</span>
                    <span style={{fontSize:'10px',color:'var(--txt3)'}}>{tasks.length} actions</span>
                  </div>
                  {tasks.map((task,i)=>(
                    <div key={i} style={{
                      display:'flex',gap:'10px',alignItems:'flex-start',
                      padding:'8px 12px 8px 44px',borderRadius:'var(--r)',marginBottom:'4px',
                      background:TASK_COLORS[task.type],
                      borderLeft:`2px solid ${TASK_BORDER[task.type]}`,
                    }}>
                      <span style={{fontSize:'10px',fontFamily:'var(--font-mono)',color:'var(--txt3)',flexShrink:0,minWidth:'36px'}}>{task.time}</span>
                      <span style={{fontSize:'12px',color:'var(--txt)',flex:1}}>{task.task}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ PROMOS ═══════════════════════════════════ */}
        {tab==='promos'&&(
          <div>
            <div style={{marginBottom:'12px',padding:'10px 14px',background:'rgba(26,121,74,.08)',borderRadius:'var(--r)',borderLeft:'3px solid var(--green)'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:'var(--green)',marginBottom:'4px'}}>🚀 Promos actives MAINTENANT</div>
              <div style={{fontSize:'11px',color:'var(--txt2)',marginBottom:'3px'}}>🏆 World Cup Ink — 48 nations · jusqu'au 19 juillet</div>
              <div style={{fontSize:'11px',color:'var(--txt2)'}}>🔥 Flash Sant Joan 70€ — 23-24 juin · PROMO 24H</div>
            </div>
            {PROMOS_STATIC.map((p,i)=>(
              <div key={i} className="card" style={{marginBottom:'8px',padding:'12px 14px',borderLeft:`3px solid ${p.statut==='🚀 Active'?'var(--green)':p.statut==='📋 Planifiée'?'var(--gold)':'var(--border)'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:700}}>{p.type} {p.nom}</div>
                    <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px'}}>{p.quand} · {p.cible}</div>
                  </div>
                  <span style={{fontSize:'10px',fontWeight:700,color:STATUS_C[p.statut]||'var(--txt3)',padding:'2px 7px',background:(STATUS_C[p.statut]||'var(--txt3)')+'18',borderRadius:'8px',flexShrink:0,marginLeft:'8px'}}>{p.statut}</span>
                </div>
                <div style={{fontSize:'11px',color:'var(--txt2)',padding:'5px 8px',background:'var(--bg)',borderRadius:'var(--r)'}}>{p.offre}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ ÉVÉNEMENTS ═══════════════════════════════ */}
        {tab==='events'&&(
          <div>
            {loading&&<div style={{textAlign:'center',padding:'30px',color:'var(--txt3)',fontSize:'12px'}}>Chargement...</div>}
            {!loading&&events.length===0&&(
              <div className="card" style={{textAlign:'center',padding:'32px',border:'1.5px dashed var(--border2)'}}>
                <div style={{fontSize:'24px',marginBottom:'8px'}}>🗓️</div>
                <div style={{fontSize:'12px',color:'var(--txt3)'}}>Chargement des événements...</div>
              </div>
            )}
            {!loading&&events.map(e=>{
              const nom=e.properties['Événement']?.title?.[0]?.plain_text||'—'
              const d=e.properties.Date?.date?.start||''
              const type=e.properties.Type?.select?.name||''
              const st=e.properties.Statut?.select?.name||''
              const action=e.properties['Action Blackthorn']?.rich_text?.[0]?.plain_text||''
              const lieu=e.properties.Lieu?.rich_text?.[0]?.plain_text||''
              const diff=d?daysUntil(d):999
              const urgency=diff>=0&&diff<=7?'var(--red)':diff<=14?'var(--amber)':diff<=30?'var(--gold)':'var(--border)'
              return (
                <div key={e.id} className="card" style={{marginBottom:'8px',padding:'12px 14px',borderLeft:`3px solid ${urgency}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'12px',fontWeight:700}}>{nom}</div>
                      <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'1px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        <span>{type}</span>
                        {lieu&&<span>📍 {lieu}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:'10px'}}>
                      <div style={{fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:600,color:urgency==='var(--border)'?'var(--txt)':urgency}}>
                        {diff<0?'Passé':diff===0?'Auj.':diff===1?'Dem.':`J-${diff}`}
                      </div>
                      <div style={{fontSize:'9px',color:'var(--txt3)'}}>{fmtDate(d)}</div>
                      <div style={{fontSize:'9px',fontWeight:700,color:STATUS_C[st]||'var(--txt3)',marginTop:'2px'}}>{st}</div>
                    </div>
                  </div>
                  {action&&<div style={{fontSize:'11px',color:'var(--txt2)',padding:'5px 8px',background:'var(--bg)',borderRadius:'var(--r)',marginTop:'6px'}}>{action}</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ PROSPECTION ══════════════════════════════ */}
        {tab==='prospection'&&(
          <div>
            <div style={{marginBottom:'12px',padding:'10px 14px',background:'rgba(196,168,130,.08)',borderRadius:'var(--r)',border:'1px solid var(--gold-lt)'}}>
              <div style={{fontSize:'11px',color:'var(--gold-dk)',fontWeight:700,marginBottom:'4px'}}>💡 La règle</div>
              <div style={{fontSize:'11px',color:'var(--txt2)'}}>20 flyers + cartes de visite + un sourire = le ROI le plus élevé du marketing local. Aller physiquement, c'est irremplaçable.</div>
            </div>
            {PROSPECTION.map((p,i)=>(
              <div key={i} className="card" style={{marginBottom:'6px',padding:'10px 14px',display:'flex',gap:'10px',alignItems:'flex-start'}}>
                <span style={{fontSize:'16px',flexShrink:0}}>{p.prio}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:700,marginBottom:'2px'}}>{p.lieu}</div>
                  <div style={{fontSize:'11px',color:'var(--txt2)',marginBottom:'2px'}}>{p.action}</div>
                  <div style={{fontSize:'10px',color:'var(--txt3)'}}>{p.freq}</div>
                </div>
              </div>
            ))}

            {/* TikTok setup */}
            <div style={{marginTop:'16px'}}>
              <div className="section-title-gold" style={{marginBottom:'10px'}}>Setup TikTok minimal</div>
              {[
                {icon:'📱',txt:'Trépied flexible téléphone (15€ Amazon)'},
                {icon:'💡',txt:'Anneau lumineux ou lampe softbox (20-30€)'},
                {icon:'⏱',txt:'Mode time-lapse natif dans l\'app caméra'},
                {icon:'🎵',txt:'Sons tendance TikTok du moment'},
                {icon:'📐',txt:'Téléphone vertical = format TikTok/Reel natif'},
              ].map((x,i)=>(
                <div key={i} style={{display:'flex',gap:'10px',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                  <span>{x.icon}</span>
                  <span style={{fontSize:'12px',color:'var(--txt2)'}}>{x.txt}</span>
                </div>
              ))}
            </div>

            <div style={{marginTop:'14px',padding:'10px 14px',background:'var(--surface)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
              <div style={{fontSize:'10px',fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>KPIs à suivre chaque semaine</div>
              {[
                {m:'Abonnés Instagram',c:'+50/semaine'},{m:'Portée Reel',c:'>5 000'},
                {m:'DMs reçus',c:'>10/sem.'},{m:'RDV via RS',c:'>2/sem.'},
                {m:'Avis Google',c:'+1/sem.'},{m:'Vues TikTok',c:'>1 000/vidéo'},
              ].map((x,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:'11px',color:'var(--txt2)'}}>{x.m}</span>
                  <span style={{fontSize:'11px',fontWeight:700,color:'var(--gold-dk)',fontFamily:'var(--font-mono)'}}>{x.c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

            {/* VENTES ADDITIONNELLES */}
            <div style={{marginTop:'16px'}}>
              <div className="section-title-gold" style={{marginBottom:'10px'}}>Ventes additionnelles</div>
              {[
                {cat:'💊 Aftercare',items:['Crème aftercare (Hustle Butter 15-20€)','Sunscreen SPF50 tatouages (été++++)','Baume cicatrisant longue durée']},
                {cat:'🎨 Art & Merch',items:['Flash prints (designs Tony vendus 15-30€)','Stickers Blackthorn','T-shirt / tote bag studio']},
                {cat:'🎁 Services',items:['Gift Vouchers (anniversaires, Noël)','Retouche 6 mois (confiance)','Consultation cover-up payante']},
                {cat:'🤝 Commissions',items:['Aftercare : négocier % avec fournisseur','Référencement hôtels / agences immobilières','Bijoux piercing (quand Amely sera formée)']},
              ].map((cat,i)=>(
                <div key={i} className="card" style={{marginBottom:'8px',padding:'12px 14px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,marginBottom:'6px'}}>{cat.cat}</div>
                  {cat.items.map((item,j)=>(
                    <div key={j} style={{fontSize:'11px',color:'var(--txt2)',padding:'3px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:'6px'}}>
                      <span style={{color:'var(--gold)',flexShrink:0}}>→</span>{item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  )
}
