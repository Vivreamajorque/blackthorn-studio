import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const fmt  = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }
const fmtN = (n) => { if(!n&&n!==0) return '—'; if(n>=1000000) return (n/1000000).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'k'; return String(Math.round(n)) }
const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => new Date().toISOString().substring(0,7)
const getNbSess = (s) => { const t=s.properties.Notes?.rich_text?.[0]?.plain_text||''; const m=t.match(/^(\d+)/); return m?parseInt(m[1]):1 }
const isConfirme = (s) => { const st=s.properties.Statut?.select?.name||''; return st===''||st==='✅ Confirmé' }

export default function Metriques() {
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [metriquesRS, setMetriquesRS] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('ca')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d, m] = await Promise.all([
        notion.getSessions(),
        notion.getDepenses(),
        notion.getMetriquesRS().catch(()=>({results:[]}))
      ])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
      if (m.results) setMetriquesRS(m.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const m  = thisMonth()
  const ws = (() => { const d=new Date(); d.setDate(d.getDate()+(d.getDay()===0?-6:1-d.getDay())); return d.toISOString().split('T')[0] })()

  const sessConf = sessions.filter(s=>!(s.properties.Type?.select?.name||'').includes('Amely')).filter(isConfirme)
  const sessM    = sessConf.filter(s=>(s.properties.Date?.date?.start||'').startsWith(m))
  const sessW    = sessConf.filter(s=>(s.properties.Date?.date?.start||'')>=ws)

  // CA
  const caMois   = sessM.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caSem    = sessW.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const totalSessM = sessM.reduce((a,s)=>a+getNbSess(s),0)
  const panier   = totalSessM>0 ? Math.round(caMois/totalSessM) : 0

  // Répartition cash/carte
  const caCash   = sessM.filter(s=>!(s.properties.Session?.title?.[0]?.plain_text||'').startsWith('[CARTE]')).reduce((a,s)=>a+(s.properties.Prix?.number||0),0)
  const caCarte  = caMois - caCash

  // Répartition nationalité
  const natCount = {}
  sessConf.forEach(s => {
    const n = s.properties.Nationalité?.select?.name||'Autre'
    natCount[n] = (natCount[n]||0) + (s.properties.Prix?.number||0)
  })

  // Répartition source
  const srcCount = {}
  sessConf.forEach(s => {
    const src = s.properties.Source?.select?.name||'—'
    if(src!=='—') srcCount[src] = (srcCount[src]||0) + 1
  })

  // Dépenses mois
  const depMois = depenses.filter(d=>(d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d)=>a+(d.properties.Montant?.number||0),0)

  // Nb sessions par jour de la semaine
  const byDay = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
  sessConf.forEach(s=>{
    const d=s.properties.Date?.date?.start||''
    if(d) byDay[new Date(d).getDay()]=(byDay[new Date(d).getDay()]||0)+1
  })
  const DAY_LABELS=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
  const maxDay=Math.max(...Object.values(byDay),1)

  // Métriques RS — dernière entrée par plateforme
  const lastRS = (plat) => metriquesRS.find(m=>m.properties.Plateforme?.select?.name===plat)

  const TABS = [
    {id:'ca',l:'CA & Sessions'},
    {id:'clients',l:'Clients'},
    {id:'rs',l:'Réseaux sociaux'},
  ]

  return (
    <div style={{padding:'0 0 96px',background:'var(--bg)',minHeight:'100dvh'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 16px 14px',background:'var(--surface)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 8px rgba(26,18,9,.04)'}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:800,letterSpacing:'-.3px'}}>Métriques</div>
        <button onClick={load} style={{width:32,height:32,borderRadius:'50%',background:'var(--bg)',border:'1px solid var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',color:'var(--txt3)',cursor:'pointer'}}>↻</button>
      </div>

      <div style={{padding:'16px'}}>
        {/* Tabs */}
        <div style={{display:'flex',gap:'6px',marginBottom:'18px',overflowX:'auto',paddingBottom:'2px'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flexShrink:0,padding:'8px 16px',borderRadius:'20px',fontSize:'12px',cursor:'pointer',
              background:tab===t.id?'var(--txt)':'var(--surface)',
              color:tab===t.id?'var(--bg)':'var(--txt2)',
              border:tab===t.id?'none':'1px solid var(--border2)',
              fontFamily:'var(--font-head)',fontWeight:700,transition:'all .2s',
              boxShadow:tab===t.id?'var(--shadow-sm)':'none'
            }}>{t.l}</button>
          ))}
        </div>

        {loading&&<div style={{textAlign:'center',padding:'40px',color:'var(--txt3)',fontSize:'13px'}}>Chargement...</div>}

        {/* ── CA & SESSIONS ─────────────────────────── */}
        {!loading&&tab==='ca'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'14px'}}>
              {[
                {l:'CA semaine',v:fmt(caSem)},{l:'CA mois',v:fmt(caMois)},
                {l:'Sessions mois',v:totalSessM},{l:'Panier moyen',v:panier>0?panier+'€':'—'},
              ].map(x=>(
                <div key={x.l} className="card" style={{textAlign:'center',padding:'12px'}}>
                  <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>{x.l}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'20px',fontWeight:500}}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* Cash vs Carte */}
            <div className="card" style={{marginBottom:'12px',padding:'14px'}}>
              <div className="section-title" style={{marginBottom:'10px'}}>Répartition paiements — mois</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                {[{l:'💵 Cash',v:caCash,c:'var(--green)'},{l:'💳 Carte',v:caCarte,c:'var(--blue)'}].map(x=>(
                  <div key={x.l} style={{textAlign:'center',padding:'10px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                    <div style={{fontSize:'11px',fontWeight:600,color:x.c,marginBottom:'4px'}}>{x.l}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'18px',fontWeight:500}}>{fmt(x.v)}</div>
                    <div style={{fontSize:'10px',color:'var(--txt3)',marginTop:'2px'}}>{caMois>0?Math.round(x.v/caMois*100)+'%':'—'}</div>
                    <div style={{height:'3px',background:'var(--border)',borderRadius:'2px',marginTop:'6px'}}>
                      <div style={{height:'100%',width:caMois>0?(x.v/caMois*100)+'%':'0',background:x.c,borderRadius:'2px'}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jours actifs */}
            <div className="card" style={{marginBottom:'12px',padding:'14px'}}>
              <div className="section-title" style={{marginBottom:'10px'}}>Sessions par jour de semaine — tout temps</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:'6px',height:'60px'}}>
                {[1,2,3,4,5,6,0].map(d=>(
                  <div key={d} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                    <div style={{width:'100%',background:byDay[d]===Math.max(...Object.values(byDay))?'var(--gold-dk)':'var(--bg2)',borderRadius:'4px 4px 0 0',height:Math.max(4,Math.round((byDay[d]/maxDay)*60))+'px'}}/>
                    <span style={{fontSize:'8px',color:'var(--txt3)'}}>{DAY_LABELS[d]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CLIENTS ───────────────────────────────── */}
        {!loading&&tab==='clients'&&(
          <div>
            {/* Nationalités */}
            <div className="card" style={{marginBottom:'12px',padding:'14px'}}>
              <div className="section-title" style={{marginBottom:'10px'}}>Nationalités — CA total</div>
              {Object.entries(natCount).sort(([,a],[,b])=>b-a).map(([nat,ca])=>(
                <div key={nat} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:'13px'}}>{nat}</span>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <div style={{height:'4px',width:Math.round((ca/Object.values(natCount).reduce((a,v)=>a+v,0))*80)+'px',background:'var(--gold)',borderRadius:'2px'}}/>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{fmt(ca)}</span>
                    <span style={{fontSize:'10px',color:'var(--txt3)'}}>{Math.round(ca/Object.values(natCount).reduce((a,v)=>a+v,0)*100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sources */}
            <div className="card" style={{padding:'14px'}}>
              <div className="section-title" style={{marginBottom:'10px'}}>Origine des clients — nombre de sessions</div>
              {Object.keys(srcCount).length === 0
                ? <div style={{fontSize:'12px',color:'var(--txt3)',textAlign:'center',padding:'16px 0'}}>Pas encore de données<br/>Commence à renseigner la source lors de la saisie CA</div>
                : Object.entries(srcCount).sort(([,a],[,b])=>b-a).map(([src,nb])=>(
                  <div key={src} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:'13px'}}>{src}</span>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{height:'4px',width:Math.round((nb/Object.values(srcCount).reduce((a,v)=>a+v,0))*80)+'px',background:'var(--gold)',borderRadius:'2px'}}/>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'13px',fontWeight:500}}>{nb} sess.</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── RÉSEAUX SOCIAUX ────────────────────────── */}
        {!loading&&tab==='rs'&&(
          <div>
            {['🖤 Blackthorn IG','📸 Instagram','👥 Facebook'].map(plat=>{
              const last=lastRS(plat)
              return (
                <div key={plat} className="card" style={{marginBottom:'10px',padding:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                    <span style={{fontFamily:'var(--font-head)',fontSize:'13px',fontWeight:700}}>{plat}</span>
                    {last&&<span style={{fontSize:'10px',color:'var(--txt3)'}}>
                      {new Date(last.properties.Date?.date?.start).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                    </span>}
                  </div>
                  {!last
                    ? <div style={{fontSize:'12px',color:'var(--txt3)',textAlign:'center',padding:'8px 0'}}>Aucune donnée — saisis dans Communication → Saisir</div>
                    : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px'}}>
                      {[
                        {l:'Abonnés',v:fmtN(last.properties['Abonnés']?.number)},
                        {l:'Reach',v:fmtN(last.properties.Reach?.number)},
                        {l:'Engagement',v:last.properties['Taux engagement']?.number!=null?(last.properties['Taux engagement'].number*100).toFixed(1)+'%':'—'},
                        {l:'RDV via RS',v:fmtN(last.properties['RDV pris via RS']?.number),bold:true},
                        {l:'Avis Google',v:fmtN(last.properties['Avis Google']?.number)},
                        {l:'DMs',v:fmtN(last.properties['DMs reçus']?.number)},
                      ].map(x=>(
                        <div key={x.l} style={{textAlign:'center',padding:'6px',background:'var(--bg)',borderRadius:'var(--r)'}}>
                          <div style={{fontSize:'9px',color:'var(--txt3)',textTransform:'uppercase',marginBottom:'2px'}}>{x.l}</div>
                          <div style={{fontFamily:'var(--font-mono)',fontSize:'14px',fontWeight:x.bold?700:400}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              )
            })}
            <div style={{textAlign:'center',padding:'12px 0',fontSize:'11px',color:'var(--txt3)'}}>
              Pour saisir de nouvelles métriques → onglet Communication
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
