import React, { useState, useEffect, useCallback } from 'react'
import { notion, parsePaiement, getNbSess } from '../lib/notion'

const todayStr  = () => new Date().toISOString().split('T')[0]
const DAY_NAMES = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const DAY_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// Lundi de la semaine contenant la date donnée
const weekOf = (dateStr) => {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

// 7 jours à partir du lundi
const weekDays = (monday) => {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const labelDate = (dateStr) => {
  const today = todayStr()
  const tom   = new Date(); tom.setDate(tom.getDate()+1)
  const tomStr = tom.toISOString().split('T')[0]
  if (dateStr === today) return "Aujourd'hui"
  if (dateStr === tomStr) return 'Demain'
  return ''
}

const fmt = (n) => { const a=Math.abs(Math.round(n)); return (n<0?'-':'')+(a>=1000?(a/1000).toFixed(1)+'k€':a+'€') }

export default function Planning({ onBack, onEditRdv }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [confirming, setConfirming] = useState(null)
  const [confForm, setConfForm] = useState({ prix:'', paiement:'cash', sessions:'1', acompte:'0' })
  const [weekStart, setWeekStart] = useState(() => weekOf(todayStr()))
  const today = todayStr()

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getSessions()
      if (r.results) setSessions(r.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const isPrevu = (s) => s.properties.Statut?.select?.name === '🗓 Prévu'
  const rdvs = sessions.filter(isPrevu)
  const days = weekDays(weekStart)

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate()-7)
    setWeekStart(d.toISOString().split('T')[0])
  }
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate()+7)
    setWeekStart(d.toISOString().split('T')[0])
  }
  const goToday = () => setWeekStart(weekOf(today))

  const rdvsForDay = (day) => rdvs.filter(s => s.properties.Date?.date?.start?.startsWith(day)).sort((a,b)=>{
    const na = a.properties.Notes?.rich_text?.[0]?.plain_text||''
    const nb = b.properties.Notes?.rich_text?.[0]?.plain_text||''
    const ta = na.match(/·\s*(\d{2}:\d{2})/)?.[1]||'23:59'
    const tb = nb.match(/·\s*(\d{2}:\d{2})/)?.[1]||'23:59'
    return ta.localeCompare(tb)
  })

  const doNoShow = async (s) => {
    try { await notion.noShowAppointment(s.id); showToast('👻 No-show'); load() } catch(e) {}
  }

  const openConfirm = (s) => {
    setConfirming(s)
    setConfForm({ prix:String(s.properties.Prix?.number||0), paiement:'cash', sessions:'1', acompte:String(s.properties['Acompte reçu']?.number||0) })
  }

  const submitConfirm = async () => {
    if (!confirming) return
    try {
      await notion.confirmAppointment(confirming.id, {
        prix:parseFloat(confForm.prix), paiement:confForm.paiement,
        acompte:parseFloat(confForm.acompte)||0,
        date:confirming.properties.Date?.date?.start?.split('T')[0]||today,
        sessions:confForm.sessions
      })
      showToast('✅ RDV confirmé → CA du jour')
      setConfirming(null); load()
    } catch(e) { showToast('Erreur') }
  }

  const gcalUrl = (s) => {
    const date = s.properties.Date?.date?.start?.split('T')[0]||''
    const notes = s.properties.Notes?.rich_text?.[0]?.plain_text||''
    const tm = notes.match(/·\s*(\d{2}:\d{2})/)
    const client = s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'
    const style = s.properties['Style / Type']?.rich_text?.[0]?.plain_text||''
    const prix = s.properties.Prix?.number||0
    if (!date) return null
    const h = tm?.[1]||'10:00', hF = (() => { const [hh,mm]=h.split(':').map(Number); const e=hh*60+mm+120; return `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}` })()
    const fmt2 = (d,t) => `${d.replace(/-/g,'')}T${(t||'100000').replace(/:/g,'')}00`
    const p = new URLSearchParams({ action:'TEMPLATE', text:`${client} — Blackthorn Tattoo`, dates:`${fmt2(date,h)}/${fmt2(date,hF)}`, details:`Style: ${style||'—'} | Prix: ${prix}€`, location:'Blackthorn Tattoo, Campos, Mallorca' })
    return `https://calendar.google.com/calendar/render?${p}`
  }

  // Label semaine
  const d1 = new Date(days[0]), d7 = new Date(days[6])
  const weekLabel = `${d1.getDate()} ${MONTH_NAMES[d1.getMonth()]} → ${d7.getDate()} ${MONTH_NAMES[d7.getMonth()]} ${d7.getFullYear()}`
  const isCurrentWeek = weekStart === weekOf(today)

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:'80px' }}>
      {/* Confirmation modal */}
      {confirming && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,18,9,.55)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={()=>setConfirming(null)}>
          <div style={{ background:'var(--surface)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'8px 20px 40px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:36, height:4, background:'var(--border2)', borderRadius:2, margin:'0 auto 20px' }}/>
            <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, marginBottom:'4px' }}>✅ Confirmer le RDV</div>
            <div style={{ fontSize:'12px', color:'var(--txt3)', marginBottom:'18px' }}>
              {confirming.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'} · {confirming.properties.Date?.date?.start?.split('T')[0]||''}
            </div>
            <label style={{ fontSize:'11px', fontWeight:600, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>CA final (€)</label>
            <input type="number" inputMode="decimal" value={confForm.prix} onChange={e=>setConfForm({...confForm,prix:e.target.value})}
              style={{ fontSize:'40px', fontFamily:'var(--font-mono)', fontWeight:400, textAlign:'center', background:'transparent', border:'none', borderBottom:`2.5px solid ${confForm.prix>0?'var(--gold)':'var(--border2)'}`, borderRadius:0, color:'var(--txt)', width:'100%', padding:'6px 0', marginBottom:'14px' }}/>
            {parseFloat(confForm.acompte)>0 && (
              <div style={{ fontSize:'12px', color:'var(--txt3)', textAlign:'center', marginBottom:'12px' }}>
                Acompte: {confForm.acompte}€ · Solde: {Math.max(0,parseFloat(confForm.prix||0)-parseFloat(confForm.acompte))}€
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {['cash','carte'].map(p=>(
                <button key={p} onClick={()=>setConfForm({...confForm,paiement:p})} style={{
                  padding:'12px', borderRadius:'var(--r)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'14px', cursor:'pointer',
                  background:confForm.paiement===p?(p==='cash'?'var(--green)':'var(--blue)'):'var(--surface)',
                  color:confForm.paiement===p?'#fff':'var(--txt2)',
                  border:confForm.paiement===p?'none':'1.5px solid var(--border2)'
                }}>{p==='cash'?'💵 Cash':'💳 Carte'}</button>
              ))}
            </div>
            <button className="btn btn-gold" onClick={submitConfirm} disabled={!confForm.prix} style={{ width:'100%', padding:'14px', fontSize:'15px', marginBottom:'8px' }}>
              ✓ Valider → CA du jour
            </button>
            <button onClick={()=>setConfirming(null)} style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'var(--txt3)', fontSize:'13px', cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(26,18,9,.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 16px 12px' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--txt3)', fontSize:'13px', fontWeight:600, cursor:'pointer', padding:'4px 0' }}>← Retour</button>
          <div style={{ fontFamily:'var(--font-head)', fontSize:'15px', fontWeight:800 }}>Planning</div>
          <div style={{display:'flex',gap:'6px'}}>
          <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ width:30, height:30, borderRadius:'50%', background:'var(--gold-lt)', border:'1px solid var(--gold)', fontSize:'13px', color:'var(--gold-dk)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }} title="Ouvrir Google Calendar">📅</a>
          <button onClick={load} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', fontSize:'13px', color:'var(--txt3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
        </div>
        </div>
        {/* Navigation semaine */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'0 16px 12px' }}>
          <button onClick={prevWeek} style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt2)' }}>‹</button>
          <div style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'var(--txt)', fontFamily:'var(--font-head)' }}>{weekLabel}</div>
          </div>
          <button onClick={nextWeek} style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt2)' }}>›</button>
        </div>
        {/* Jours de la semaine */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', padding:'0 12px 12px' }}>
          {days.map((day, i) => {
            const nb = rdvsForDay(day).length
            const isToday = day === today
            const isPast  = day < today
            return (
              <div key={day} style={{ textAlign:'center', padding:'4px 2px', borderRadius:'var(--r)', background:isToday?'var(--gold-lt)':'transparent' }}>
                <div style={{ fontSize:'9px', fontWeight:700, color:isToday?'var(--gold-dk)':isPast?'var(--txt3)':'var(--txt2)', textTransform:'uppercase', letterSpacing:'.5px' }}>
                  {DAY_NAMES[(i+1)%7]}
                </div>
                <div style={{ fontSize:'14px', fontWeight:isToday?700:400, color:isToday?'var(--gold-dk)':isPast?'var(--txt3)':'var(--txt)' }}>
                  {new Date(day).getDate()}
                </div>
                {nb>0 && <div style={{ width:5, height:5, borderRadius:'50%', background:isToday?'var(--gold-dk)':'var(--txt)', margin:'2px auto 0' }}/>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Corps — jours */}
      <div style={{ padding:'12px 16px' }}>
        {!isCurrentWeek && (
          <button onClick={goToday} style={{ width:'100%', padding:'8px', borderRadius:'var(--r)', background:'var(--gold-lt)', border:'none', color:'var(--gold-dk)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer', marginBottom:'12px' }}>
            ← Cette semaine
          </button>
        )}

        {days.map((day, i) => {
          const rdvDay  = rdvsForDay(day)
          const isToday = day === today
          const isPast  = day < today
          const dayNum  = new Date(day).getDate()
          const dayLabel = labelDate(day)
          if (rdvDay.length === 0 && isPast) return null // cacher les jours passés sans RDV

          return (
            <div key={day} style={{ marginBottom:'16px' }}>
              {/* Header du jour */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background:isToday?'var(--txt)':'transparent',
                  border:isToday?'none':`1.5px solid ${isPast?'var(--border)':'var(--border2)'}`,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'
                }}>
                  <span style={{ fontSize:'11px', fontWeight:700, color:isToday?'var(--bg)':isPast?'var(--txt3)':'var(--txt3)', letterSpacing:'.3px' }}>
                    {DAY_NAMES[(i+1)%7]}
                  </span>
                  <span style={{ fontSize:'14px', fontWeight:700, color:isToday?'var(--bg)':isPast?'var(--txt3)':'var(--txt)', lineHeight:1 }}>
                    {dayNum}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize:'12px', fontWeight:isToday?700:500, color:isToday?'var(--txt)':'var(--txt2)' }}>
                    {DAY_FULL[(i+1)%7]}
                    {dayLabel && <span style={{ marginLeft:'6px', fontSize:'10px', padding:'2px 6px', background:'rgba(196,168,130,.15)', color:'var(--gold-dk)', borderRadius:'10px', fontWeight:700 }}>{dayLabel}</span>}
                  </span>
                  {rdvDay.length > 0 && (
                    <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'1px' }}>{rdvDay.length} RDV · {rdvDay.reduce((a,s)=>a+(s.properties.Prix?.number||0),0)}€</div>
                  )}
                </div>
              </div>

              {/* RDVs du jour */}
              {rdvDay.length === 0 ? (
                !isPast && (
                  <div style={{ marginLeft:'46px', padding:'10px 14px', borderRadius:'var(--r)', border:'1.5px dashed var(--border)', color:'var(--txt3)', fontSize:'12px' }}>
                    Aucun RDV
                  </div>
                )
              ) : (
                rdvDay.map(s => {
                  const client  = s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'
                  const style   = s.properties['Style / Type']?.rich_text?.[0]?.plain_text||''
                  const prix    = s.properties.Prix?.number||0
                  const acompte = s.properties['Acompte reçu']?.number||0
                  const notes   = s.properties.Notes?.rich_text?.[0]?.plain_text||''
                  const dateRaw = s.properties.Date?.date?.start||''
                  const heure   = dateRaw.includes('T') ? dateRaw.substring(11,16) : (notes.match(/·\s*(\d{2}:\d{2})/)?.[1]||null)
                  const source  = s.properties.Source?.select?.name||''
                  const url     = gcalUrl(s)
                  return (
                    <div key={s.id} style={{ marginLeft:'46px', marginBottom:'8px' }}>
                      <div className="card" style={{ padding:'12px 14px', borderLeft:`3px solid ${isPast?'var(--red)':isToday?'var(--gold)':'var(--pierre)'}`, boxShadow:isToday?'var(--shadow)':'var(--shadow-sm)' }}>
                        {/* Heure — grand et visible */}
                        {heure && (
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:'22px', fontWeight:600, color:'var(--txt)', letterSpacing:'-0.5px' }}>{heure}</span>
                            {isPast && <span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--red-bg)', color:'var(--red)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>À VALIDER</span>}
                          </div>
                        )}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                          <div style={{ flex:1 }}>
                            {!heure && isPast && <div style={{ marginBottom:'4px' }}><span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--red-bg)', color:'var(--red)', borderRadius:'10px', fontWeight:700 }}>À VALIDER</span></div>}
                            <div style={{ fontSize:'15px', fontWeight:700 }}>{client}</div>
                            {style && <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'2px' }}>{style}</div>}
                            {source && <div style={{ fontSize:'10px', color:'var(--txt3)', marginTop:'2px' }}>{source}</div>}
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                            <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:600 }}>{prix}€</div>
                            {acompte>0 && <div style={{ fontSize:'10px', color:'var(--green)', marginTop:'1px' }}>Acompte: {acompte}€</div>}
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:(isPast||isToday)?'1fr 1fr 1fr':'1fr', gap:'6px' }}>
                          {(isPast||isToday) && <button onClick={()=>openConfirm(s)} style={{
                            padding:'9px', borderRadius:'var(--r)',
                            background:isPast?'var(--green)':'var(--amber)',
                            border:'none',
                            color:'#fff',
                            fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer'
                          }}>✅ {isPast?'Valider':'Client venu'}</button>}
                          {(isPast||isToday) && <button onClick={()=>doNoShow(s)} style={{
                            padding:'9px', borderRadius:'var(--r)',
                            background:'var(--surface)', border:'1.5px solid var(--border2)',
                            color:'var(--txt3)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer'
                          }}>👻 No-show</button>}
                          {onEditRdv && <button onClick={()=>{
                            const dr=s.properties.Date?.date?.start||''
                            const h=dr.includes('T')?dr.substring(11,16):''
                            onEditRdv({
                              id:s.id,
                              client:s.properties['Client prénom']?.rich_text?.[0]?.plain_text||'',
                              style:s.properties['Style / Type']?.rich_text?.[0]?.plain_text||'',
                              prixEstime:String(s.properties.Prix?.number||0),
                              sessions:'1',
                              acompte:String(s.properties['Acompte reçu']?.number||0),
                              date:dr.split('T')[0]||'',
                              heure:h,
                              natio:s.properties.Nationalité?.select?.name||'🇫🇷 FR',
                              source:s.properties.Source?.select?.name||'📸 Instagram',
                            })
                          }} style={{
                            padding:'9px', borderRadius:'var(--r)',
                            background:'var(--surface)', border:'1.5px solid var(--gold)',
                            color:'var(--gold-dk)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer'
                          }}>✏️ Modifier</button>}
                        </div>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:'block', marginTop:'6px', padding:'6px', borderRadius:'var(--r)', background:'rgba(30,95,160,.06)', border:'1px solid rgba(30,95,160,.12)', color:'var(--blue)', fontSize:'11px', fontWeight:600, textAlign:'center', textDecoration:'none' }}>
                            📅 Ajouter à Google Calendar
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}

        {rdvs.length === 0 && !loading && (
          <div className="card" style={{ textAlign:'center', padding:'32px 20px', border:'1.5px dashed var(--border2)', marginTop:'12px' }}>
            <div style={{ fontSize:'28px', marginBottom:'10px' }}>📅</div>
            <div style={{ fontSize:'13px', fontWeight:600, color:'var(--txt2)', marginBottom:'4px' }}>Aucun RDV cette semaine</div>
            <div style={{ fontSize:'11px', color:'var(--txt3)' }}>Navigue vers une autre semaine ou ajoute un RDV</div>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
