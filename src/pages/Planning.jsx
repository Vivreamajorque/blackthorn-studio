import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const todayStr = () => new Date().toISOString().split('T')[0]
const DAY_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const DAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const MONTH_NAMES = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const MONTH_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const addDays = (dateStr, n) => {
  const d = new Date(dateStr); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const getHeure = (s) => {
  const dateRaw = s.properties.Date?.date?.start || ''
  if (dateRaw.includes('T')) return dateRaw.substring(11, 16)
  const notes = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
  return notes.match(/·\s*(\d{2}:\d{2})/)?.[1] || null
}

const getDateOnly = (s) => {
  const dateRaw = s.properties.Date?.date?.start || ''
  return dateRaw.split('T')[0]
}

const STATUT_PREVU    = '🗓 Prévu'
const STATUT_CONFIRM  = '✅ Confirmé'
const STATUT_NOSHOW   = '👻 No-show'

export default function Planning({ onBack, onEditRdv }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [selectedDay, setSelectedDay] = useState(todayStr())
  const [confirming, setConfirming]   = useState(null)
  const [confForm, setConfForm]       = useState({ prix:'', paiement:'cash', sessions:'1', acompte:'0' })
  const today = todayStr()

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getSessions()
      if (r.results) setSessions(r.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Tous les RDVs (prévus + confirmés + no-show) triés par date desc
  const allRdvs = sessions.filter(s => {
    const statut = s.properties.Statut?.select?.name || ''
    return [STATUT_PREVU, STATUT_CONFIRM, STATUT_NOSHOW].includes(statut)
  })

  // RDVs pour le jour sélectionné
  const rdvsDay = allRdvs
    .filter(s => getDateOnly(s) === selectedDay)
    .sort((a, b) => {
      const ha = getHeure(a) || '23:59'
      const hb = getHeure(b) || '23:59'
      return ha.localeCompare(hb)
    })

  // Prochains jours avec RDVs (à venir uniquement)
  const upcomingDays = [...new Set(
    allRdvs
      .filter(s => getDateOnly(s) >= today && s.properties.Statut?.select?.name === STATUT_PREVU)
      .map(s => getDateOnly(s))
  )].sort()

  // Jours passés avec RDVs
  const pastDays = [...new Set(
    allRdvs
      .filter(s => getDateOnly(s) < today)
      .map(s => getDateOnly(s))
  )].sort().reverse()

  // Navigation jour par jour (uniquement jours avec RDV ou aujourd'hui)
  const allDaysWithRdv = [...new Set([
    ...upcomingDays,
    today,
    ...pastDays
  ])].sort()

  const currentIdx = allDaysWithRdv.indexOf(selectedDay)
  const canPrev = currentIdx > 0
  const canNext = currentIdx < allDaysWithRdv.length - 1

  const prevDay = () => { if (canPrev) setSelectedDay(allDaysWithRdv[currentIdx - 1]) }
  const nextDay = () => { if (canNext) setSelectedDay(allDaysWithRdv[currentIdx + 1]) }

  const isToday   = selectedDay === today
  const isPast    = selectedDay < today
  const isFuture  = selectedDay > today

  const d = new Date(selectedDay)
  const dayOfWeek = DAY_FULL[d.getDay()]
  const dayLabel  = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`

  // --- Confirm modal ---
  const openConfirm = (s) => {
    setConfirming(s)
    setConfForm({
      prix: String(s.properties.Prix?.number || 0),
      paiement: 'cash',
      sessions: '1',
      acompte: String(s.properties['Acompte reçu']?.number || 0)
    })
  }
  const submitConfirm = async () => {
    if (!confirming) return
    try {
      await notion.confirmAppointment(confirming.id, {
        prix: parseFloat(confForm.prix),
        paiement: confForm.paiement,
        acompte: parseFloat(confForm.acompte) || 0,
        date: confirming.properties.Date?.date?.start?.split('T')[0] || today,
        sessions: confForm.sessions
      })
      showToast('✅ RDV confirmé')
      setConfirming(null); load()
    } catch(e) { showToast('Erreur') }
  }
  const doNoShow = async (s) => {
    try { await notion.noShowAppointment(s.id); showToast('👻 No-show enregistré'); load() } catch(e) {}
  }

  const gcalUrl = (s) => {
    const date  = getDateOnly(s)
    const heure = getHeure(s)
    const client = s.properties['Client prénom']?.rich_text?.[0]?.plain_text || 'Client'
    const style  = s.properties['Style / Type']?.rich_text?.[0]?.plain_text || ''
    const prix   = s.properties.Prix?.number || 0
    if (!date) return null
    const h  = heure || '10:00'
    const [hh, mm] = h.split(':').map(Number)
    const e  = hh * 60 + mm + 120
    const hF = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`
    const fmt = (d, t) => `${d.replace(/-/g, '')}T${t.replace(/:/g, '')}00`
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${client} — Blackthorn Tattoo`,
      dates: `${fmt(date, h)}/${fmt(date, hF)}`,
      details: `Style: ${style || '—'} | Prix: ${prix}€`,
      location: 'Blackthorn Tattoo, Campos, Mallorca'
    })
    return `https://calendar.google.com/calendar/render?${p}`
  }

  // Miniature semaine pour la navigation rapide (7 jours à partir de lundi)
  const mondayOfSelected = (() => {
    const dd = new Date(selectedDay)
    const day = dd.getDay()
    const diff = day === 0 ? -6 : 1 - day
    dd.setDate(dd.getDate() + diff)
    return dd.toISOString().split('T')[0]
  })()
  const weekDots = Array.from({ length: 7 }, (_, i) => addDays(mondayOfSelected, i))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', paddingBottom: '80px' }}>

      {/* Modal confirmation */}
      {confirming && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,18,9,.6)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setConfirming(null)}>
          <div style={{ background:'var(--surface)', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, padding:'8px 20px 40px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, background:'var(--border2)', borderRadius:2, margin:'0 auto 20px' }}/>
            <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, marginBottom:'4px' }}>✅ Confirmer le RDV</div>
            <div style={{ fontSize:'12px', color:'var(--txt3)', marginBottom:'18px' }}>
              {confirming.properties['Client prénom']?.rich_text?.[0]?.plain_text || 'Client'} · {getDateOnly(confirming)}
            </div>
            <label style={{ fontSize:'11px', fontWeight:600, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'6px' }}>CA final (€)</label>
            <input type="number" inputMode="decimal" value={confForm.prix}
              onChange={e => setConfForm({ ...confForm, prix: e.target.value })}
              style={{ fontSize:'40px', fontFamily:'var(--font-mono)', fontWeight:400, textAlign:'center', background:'transparent', border:'none', borderBottom:`2.5px solid ${confForm.prix > 0 ? 'var(--gold)' : 'var(--border2)'}`, borderRadius:0, color:'var(--txt)', width:'100%', padding:'6px 0', marginBottom:'14px' }}/>
            {parseFloat(confForm.acompte) > 0 && (
              <div style={{ fontSize:'12px', color:'var(--txt3)', textAlign:'center', marginBottom:'12px' }}>
                Acompte: {confForm.acompte}€ · Solde: {Math.max(0, parseFloat(confForm.prix || 0) - parseFloat(confForm.acompte))}€
              </div>
            )}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {['cash','carte'].map(p => (
                <button key={p} onClick={() => setConfForm({ ...confForm, paiement: p })} style={{
                  padding:'12px', borderRadius:'var(--r)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'14px', cursor:'pointer',
                  background: confForm.paiement === p ? (p === 'cash' ? 'var(--green)' : 'var(--blue)') : 'var(--surface)',
                  color: confForm.paiement === p ? '#fff' : 'var(--txt2)',
                  border: confForm.paiement === p ? 'none' : '1.5px solid var(--border2)'
                }}>{p === 'cash' ? '💵 Cash' : '💳 Carte'}</button>
              ))}
            </div>
            <button className="btn btn-gold" onClick={submitConfirm} disabled={!confForm.prix}
              style={{ width:'100%', padding:'14px', fontSize:'15px', marginBottom:'8px' }}>
              ✓ Valider → CA du jour
            </button>
            <button onClick={() => setConfirming(null)}
              style={{ width:'100%', padding:'10px', background:'transparent', border:'none', color:'var(--txt3)', fontSize:'13px', cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(26,18,9,.04)' }}>
        {/* Barre titre */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px 10px' }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--txt3)', fontSize:'13px', fontWeight:600, cursor:'pointer', padding:'4px 0' }}>← Retour</button>
          <div style={{ fontFamily:'var(--font-head)', fontSize:'15px', fontWeight:800 }}>Planning</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={() => setSelectedDay(today)} style={{ padding:'4px 10px', borderRadius:'20px', background: isToday ? 'var(--gold-lt)' : 'var(--bg)', border:`1px solid ${isToday ? 'var(--gold)' : 'var(--border2)'}`, color: isToday ? 'var(--gold-dk)' : 'var(--txt3)', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
              Aujourd'hui
            </button>
            <button onClick={load} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', fontSize:'13px', color:'var(--txt3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
          </div>
        </div>

        {/* Mini-semaine dots */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', padding:'0 12px 10px' }}>
          {weekDots.map((day, i) => {
            const nb       = allRdvs.filter(s => getDateOnly(s) === day).length
            const isSel    = day === selectedDay
            const isDayT   = day === today
            const isDayP   = day < today
            return (
              <div key={day} onClick={() => setSelectedDay(day)}
                style={{ textAlign:'center', padding:'5px 2px', borderRadius:'var(--r)', cursor:'pointer',
                  background: isSel ? 'var(--gold-lt)' : isDayT ? 'rgba(196,168,130,.08)' : 'transparent',
                  border: isSel ? '1.5px solid var(--gold)' : isDayT ? '1px solid var(--gold)' : '1px solid transparent'
                }}>
                <div style={{ fontSize:'9px', fontWeight:700, color: isSel ? 'var(--gold-dk)' : isDayP ? 'var(--txt3)' : 'var(--txt2)', textTransform:'uppercase', letterSpacing:'.5px' }}>
                  {DAY_SHORT[(i + 1) % 7]}
                </div>
                <div style={{ fontSize:'14px', fontWeight: isSel ? 700 : 400, color: isSel ? 'var(--gold-dk)' : isDayP ? 'var(--txt3)' : 'var(--txt)', lineHeight: 1.2 }}>
                  {new Date(day).getDate()}
                </div>
                <div style={{ height: 5, display:'flex', alignItems:'center', justifyContent:'center', marginTop:'2px' }}>
                  {nb > 0 && <div style={{ width: nb > 1 ? 10 : 5, height: 5, borderRadius:3, background: isSel ? 'var(--gold-dk)' : isDayP ? 'var(--txt3)' : 'var(--pierre)' }}/>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Navigation jour avec flèches */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 12px 12px', gap:'8px' }}>
          <button onClick={prevDay} disabled={!canPrev} style={{
            width:36, height:36, borderRadius:'50%', border:'1px solid var(--border2)',
            background: canPrev ? 'var(--bg)' : 'transparent',
            color: canPrev ? 'var(--txt)' : 'var(--border2)',
            fontSize:'18px', cursor: canPrev ? 'pointer' : 'default',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
          }}>‹</button>

          <div style={{ flex:1, textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, color: isPast ? 'var(--txt3)' : 'var(--txt)' }}>
                {dayOfWeek}
              </div>
              {isToday && (
                <span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--gold-lt)', color:'var(--gold-dk)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>AUJOURD'HUI</span>
              )}
              {isPast && (
                <span style={{ fontSize:'9px', padding:'2px 8px', background:'rgba(120,100,80,.1)', color:'var(--txt3)', borderRadius:'10px', fontWeight:700 }}>PASSÉ</span>
              )}
            </div>
            <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'1px' }}>{dayLabel}</div>
          </div>

          <button onClick={nextDay} disabled={!canNext} style={{
            width:36, height:36, borderRadius:'50%', border:'1px solid var(--border2)',
            background: canNext ? 'var(--bg)' : 'transparent',
            color: canNext ? 'var(--txt)' : 'var(--border2)',
            fontSize:'18px', cursor: canNext ? 'pointer' : 'default',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
          }}>›</button>
        </div>
      </div>

      {/* ── CORPS ── */}
      <div style={{ padding:'16px' }}>

        {loading && (
          <div style={{ textAlign:'center', padding:'40px', color:'var(--txt3)', fontSize:'13px' }}>Chargement…</div>
        )}

        {!loading && rdvsDay.length === 0 && (
          <div style={{ textAlign:'center', padding:'48px 20px' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>📅</div>
            <div style={{ fontSize:'14px', fontWeight:600, color:'var(--txt2)', marginBottom:'6px' }}>
              {isFuture ? 'Aucun RDV prévu ce jour' : isToday ? "Pas de RDV aujourd'hui" : 'Aucun RDV ce jour'}
            </div>
            <div style={{ fontSize:'11px', color:'var(--txt3)' }}>
              Navigue avec les flèches pour voir les autres jours
            </div>
          </div>
        )}

        {/* Timeline RDVs */}
        {rdvsDay.map((s, idx) => {
          const client   = s.properties['Client prénom']?.rich_text?.[0]?.plain_text || 'Client'
          const style    = s.properties['Style / Type']?.rich_text?.[0]?.plain_text || ''
          const prix     = s.properties.Prix?.number || 0
          const acompte  = s.properties['Acompte reçu']?.number || 0
          const source   = s.properties.Source?.select?.name || ''
          const statut   = s.properties.Statut?.select?.name || ''
          const heure    = getHeure(s)
          const url      = gcalUrl(s)
          const isPrevu  = statut === STATUT_PREVU
          const isConf   = statut === STATUT_CONFIRM
          const isNS     = statut === STATUT_NOSHOW

          const accentColor = isConf ? 'var(--green)' : isNS ? 'var(--txt3)' : isPast ? 'var(--red)' : isToday ? 'var(--gold)' : 'var(--pierre)'
          const cardOpacity = isNS ? 0.5 : 1

          return (
            <div key={s.id} style={{ display:'flex', gap:'12px', marginBottom:'0', opacity: cardOpacity }}>
              {/* Colonne heure + trait */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:52, flexShrink:0 }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize: heure ? '18px' : '11px', fontWeight:700, color: heure ? 'var(--txt)' : 'var(--amber)', lineHeight:1, paddingTop:'14px', textAlign:'center', whiteSpace:'nowrap' }}>
                  {heure || '⏰?'}
                </div>
                {idx < rdvsDay.length - 1 && (
                  <div style={{ flex:1, width:1, background:'var(--border)', marginTop:'6px', marginBottom:'0', minHeight:'20px' }}/>
                )}
              </div>

              {/* Carte RDV */}
              <div style={{ flex:1, paddingBottom:'12px' }}>
                <div className="card" style={{
                  padding:'12px 14px',
                  borderLeft:`3px solid ${accentColor}`,
                  boxShadow: isToday && isPrevu ? 'var(--shadow)' : 'var(--shadow-sm)'
                }}>
                  {/* Badges statut */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', flexWrap:'wrap' }}>
                    {isConf && <span style={{ fontSize:'9px', padding:'2px 8px', background:'rgba(80,160,80,.12)', color:'var(--green)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>✅ CONFIRMÉ</span>}
                    {isNS   && <span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--bg)', color:'var(--txt3)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>👻 NO-SHOW</span>}
                    {isPrevu && isPast && <span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--red-bg)', color:'var(--red)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>⚠️ À VALIDER</span>}
                    {isPrevu && isToday && <span style={{ fontSize:'9px', padding:'2px 8px', background:'var(--gold-lt)', color:'var(--gold-dk)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>AUJOURD'HUI</span>}
                    {isPrevu && isFuture && <span style={{ fontSize:'9px', padding:'2px 8px', background:'rgba(196,168,130,.1)', color:'var(--pierre)', borderRadius:'10px', fontWeight:700, letterSpacing:'.5px' }}>🗓 PRÉVU</span>}
                  </div>

                  {/* Client + prix */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:style||source ? '6px' : '10px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'16px', fontWeight:700 }}>{client}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:600 }}>{prix}€</div>
                      {acompte > 0 && <div style={{ fontSize:'10px', color:'var(--green)', marginTop:'1px' }}>Acompte {acompte}€</div>}
                    </div>
                  </div>

                  {(style || source) && (
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
                      {style && <span style={{ fontSize:'11px', color:'var(--txt2)', background:'var(--bg)', padding:'2px 8px', borderRadius:'6px' }}>{style}</span>}
                      {source && <span style={{ fontSize:'11px', color:'var(--txt3)', background:'var(--bg)', padding:'2px 8px', borderRadius:'6px' }}>{source}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  {!isNS && !isConf && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
                      <button onClick={() => openConfirm(s)} style={{
                        padding:'9px 4px', borderRadius:'var(--r)',
                        background: isPast ? 'var(--green)' : 'var(--amber)',
                        border:'none', color:'#fff',
                        fontFamily:'var(--font-head)', fontWeight:700, fontSize:'11px', cursor:'pointer'
                      }}>✅ {isPast ? 'Valider' : 'Client venu'}</button>
                      <button onClick={() => doNoShow(s)} style={{
                        padding:'9px 4px', borderRadius:'var(--r)',
                        background:'var(--surface)', border:'1.5px solid var(--border2)',
                        color:'var(--txt3)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'11px', cursor:'pointer'
                      }}>👻 No-show</button>
                      {onEditRdv && (
                        <button onClick={() => {
                          const dr = s.properties.Date?.date?.start || ''
                          const h  = dr.includes('T') ? dr.substring(11, 16) : ''
                          onEditRdv({
                            id: s.id,
                            client: s.properties['Client prénom']?.rich_text?.[0]?.plain_text || '',
                            style: s.properties['Style / Type']?.rich_text?.[0]?.plain_text || '',
                            prixEstime: String(s.properties.Prix?.number || 0),
                            sessions: '1',
                            acompte: String(s.properties['Acompte reçu']?.number || 0),
                            date: dr.split('T')[0] || '',
                            heure: h,
                            natio: s.properties.Nationalité?.select?.name || '🇫🇷 FR',
                            source: s.properties.Source?.select?.name || '📸 Instagram',
                          })
                        }} style={{
                          padding:'9px 4px', borderRadius:'var(--r)',
                          background:'var(--surface)', border:'1.5px solid var(--gold)',
                          color:'var(--gold-dk)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'11px', cursor:'pointer'
                        }}>✏️ Modifier</button>
                      )}
                    </div>
                  )}

                  {isConf && onEditRdv && (
                    <button onClick={() => {
                      const dr = s.properties.Date?.date?.start || ''
                      const h  = dr.includes('T') ? dr.substring(11, 16) : ''
                      onEditRdv({
                        id: s.id,
                        client: s.properties['Client prénom']?.rich_text?.[0]?.plain_text || '',
                        style: s.properties['Style / Type']?.rich_text?.[0]?.plain_text || '',
                        prixEstime: String(s.properties.Prix?.number || 0),
                        sessions: '1',
                        acompte: String(s.properties['Acompte reçu']?.number || 0),
                        date: dr.split('T')[0] || '',
                        heure: h,
                        natio: s.properties.Nationalité?.select?.name || '🇫🇷 FR',
                        source: s.properties.Source?.select?.name || '📸 Instagram',
                      })
                    }} style={{
                      width:'100%', padding:'8px', borderRadius:'var(--r)',
                      background:'var(--surface)', border:'1px solid var(--border2)',
                      color:'var(--txt3)', fontFamily:'var(--font-head)', fontWeight:600, fontSize:'11px', cursor:'pointer', marginTop:'4px'
                    }}>✏️ Modifier</button>
                  )}

                  {url && isPrevu && (
                    <a href={url} target="_blank" rel="noopener noreferrer" style={{
                      display:'block', marginTop:'8px', padding:'6px',
                      borderRadius:'var(--r)', background:'rgba(30,95,160,.06)',
                      border:'1px solid rgba(30,95,160,.12)', color:'var(--blue)',
                      fontSize:'11px', fontWeight:600, textAlign:'center', textDecoration:'none'
                    }}>📅 Ajouter à Google Calendar</a>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Raccourcis jours à venir */}
        {!loading && upcomingDays.filter(d => d !== selectedDay).length > 0 && (
          <div style={{ marginTop:'24px' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
              Prochains RDVs
            </div>
            {upcomingDays.filter(d => d !== selectedDay).slice(0, 5).map(day => {
              const nb   = allRdvs.filter(s => getDateOnly(s) === day && s.properties.Statut?.select?.name === STATUT_PREVU).length
              const dd   = new Date(day)
              const isT  = day === today
              return (
                <div key={day} onClick={() => setSelectedDay(day)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 14px', borderRadius:'var(--r)', marginBottom:'6px',
                    background:'var(--surface)', border:'1px solid var(--border)',
                    cursor:'pointer'
                  }}>
                  <div>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'var(--txt)' }}>
                      {DAY_FULL[dd.getDay()]} {dd.getDate()} {MONTH_SHORT[dd.getMonth()]}
                    </span>
                    {isT && <span style={{ marginLeft:'6px', fontSize:'9px', padding:'2px 6px', background:'var(--gold-lt)', color:'var(--gold-dk)', borderRadius:'10px', fontWeight:700 }}>AUJ.</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{nb} RDV</span>
                    <span style={{ color:'var(--txt3)', fontSize:'16px' }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Historique jours passés avec RDVs */}
        {!loading && pastDays.filter(d => allRdvs.some(s => getDateOnly(s) === d)).length > 0 && (
          <div style={{ marginTop:'24px' }}>
            <div style={{ fontSize:'10px', fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
              Historique
            </div>
            {pastDays.slice(0, 8).map(day => {
              const rdvsDayH = allRdvs.filter(s => getDateOnly(s) === day)
              const ca = rdvsDayH.filter(s => s.properties.Statut?.select?.name === STATUT_CONFIRM).reduce((a, s) => a + (s.properties.Prix?.number || 0), 0)
              const nb = rdvsDayH.length
              const dd = new Date(day)
              return (
                <div key={day} onClick={() => setSelectedDay(day)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 14px', borderRadius:'var(--r)', marginBottom:'6px',
                    background:'var(--surface)', border:'1px solid var(--border)',
                    cursor:'pointer', opacity:0.8
                  }}>
                  <div>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'var(--txt2)' }}>
                      {DAY_FULL[dd.getDay()]} {dd.getDate()} {MONTH_SHORT[dd.getMonth()]}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    {ca > 0 && <span style={{ fontSize:'11px', fontFamily:'var(--font-mono)', color:'var(--green)', fontWeight:600 }}>{ca}€</span>}
                    <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{nb} RDV</span>
                    <span style={{ color:'var(--txt3)', fontSize:'16px' }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
