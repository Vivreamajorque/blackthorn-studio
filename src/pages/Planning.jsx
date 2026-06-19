import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const todayStr = () => new Date().toISOString().split('T')[0]
const DAY_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const DAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const MONTH_NAMES = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

const addDays = (dateStr, n) => {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}
const mondayOf = (dateStr) => {
  const d = new Date(dateStr), day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}
const getHeure = (s) => {
  const raw = s.properties.Date?.date?.start || ''
  if (raw.includes('T')) return raw.substring(11, 16)
  return s.properties.Notes?.rich_text?.[0]?.plain_text?.match(/·\s*(\d{2}:\d{2})/)?.[1] || null
}
const getDateOnly = (s) => (s.properties.Date?.date?.start || '').split('T')[0]

const SLOTS_DEFAULT = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00']
const SLOTS_ALL = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']

// Convertit HH:MM en minutes
const toMin = (h) => { if (!h) return null; const [hh,mm] = h.split(':').map(Number); return hh*60+mm }

// Vérifie si une plage [heure, heure+duree] chevauche les RDVs existants du jour
const hasOverlap = (rdvs, heure, dureeMin) => {
  const start = toMin(heure)
  if (start === null) return false
  const end = start + parseInt(dureeMin || 120)
  return rdvs.some(s => {
    const st = s.properties.Statut?.select?.name || ''
    if (st === '👻 No-show' || st === '❌ Annulé') return false
    const h = getHeure(s)
    if (!h) return false
    const sStart = toMin(h)
    const notes  = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
    const durMatch = notes.match(/(\d+)\s*min/)
    const sDur = durMatch ? parseInt(durMatch[1]) : 120
    const sEnd = sStart + sDur
    return start < sEnd && end > sStart
  })
}
const STATUT_PREVU   = '🗓 Prévu'
const STATUT_CONFIRM = '✅ Confirmé'
const STATUT_NOSHOW  = '👻 No-show'

export default function Planning({ onBack, onEditRdv }) {
  const [sessions,   setSessions]  = useState([])
  const [creneaux,   setCreneaux]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [toast,      setToast]     = useState('')
  const [weekStart,  setWeekStart] = useState(mondayOf(todayStr()))
  const [selectedDay,setSelDay]    = useState(todayStr())
  const [panel,      setPanel]     = useState(null) // null | 'addRdv' | 'addCreneau' | 'confirmRdv' | 'editCreneau'
  const [panelData,  setPanelData] = useState(null)
  const today = todayStr()

  // Formulaires
  const [rdvForm,  setRdvForm]  = useState({ client:'', style:'', prixEstime:'', heure:'10:00', duree:'120', natio:'🇫🇷 FR', source:'📸 Instagram', acompte:'0' })
  const [confForm, setConfForm] = useState({ prix:'', paiement:'cash', acompte:'0' })
  const [saving,   setSaving]   = useState(false)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const weekEnd = addDays(weekStart, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const wEnd2   = addDays(weekStart, 13)
      const wStart2 = addDays(weekStart, -7)
      const [s, c] = await Promise.all([
        notion.getSessions(),
        notion.getCreneauxRange(wStart2, wEnd2)
      ])
      const sess = s.results || []
      const cren = c.results || []
      setSessions(sess)
      setCreneaux(cren)

      // Auto-ouvrir tous les créneaux libres 9h-22h pour les 7 jours de la semaine
      const monday = mondayOf(todayStr())
      const days7  = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
      const toCreate = []
      for (const day of days7) {
        const rdvsD  = sess.filter(s => getDateOnly(s) === day && ['🗓 Prévu','✅ Confirmé'].includes(s.properties.Statut?.select?.name||''))
        const crensD = cren.filter(cr => (cr.properties.Date?.date?.start||'').split('T')[0] === day)
        for (const h of SLOTS_ALL) {
          const dejaOuvert = crensD.some(cr => cr.properties.Heure?.rich_text?.[0]?.plain_text === h)
          if (dejaOuvert) continue
          if (hasOverlap(rdvsD, h, '60')) continue
          toCreate.push({ date: day, heure: h, statut: '🟢 Ouvert' })
        }
      }
      // Créer les créneaux manquants (en parallèle par batch de 5)
      for (let i = 0; i < toCreate.length; i += 5) {
        await Promise.all(toCreate.slice(i, i+5).map(d => notion.addCreneau(d)))
      }
      if (toCreate.length > 0) {
        // Recharger les créneaux après création
        const c2 = await notion.getCreneauxRange(wStart2, wEnd2)
        if (c2.results) setCreneaux(c2.results)
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [weekStart])

  useEffect(() => { load() }, [load])

  // Helpers
  const rdvsForDay = (day) => sessions.filter(s => {
    const st = s.properties.Statut?.select?.name || ''
    return getDateOnly(s) === day && [STATUT_PREVU, STATUT_CONFIRM, STATUT_NOSHOW].includes(st)
  }).sort((a,b) => (getHeure(a)||'23:59').localeCompare(getHeure(b)||'23:59'))

  const creneauxForDay = (day) => creneaux.filter(c => {
    const d = c.properties.Date?.date?.start || ''
    return d.split('T')[0] === day
  }).sort((a,b) => (a.properties.Heure?.rich_text?.[0]?.plain_text||'').localeCompare(b.properties.Heure?.rich_text?.[0]?.plain_text||''))

  const hasActivity = (day) => rdvsForDay(day).length > 0 || creneauxForDay(day).length > 0
  const isBloqueDay = (day) => creneauxForDay(day).some(c => c.properties.Statut?.select?.name === '🔒 Bloqué' && !c.properties.Heure?.rich_text?.[0]?.plain_text)

  // Ajouter créneau
  const addCreneau = async (heure, statut = '🟢 Ouvert', notes = '') => {
    setSaving(true)
    try {
      await notion.addCreneau({ date: selectedDay, heure, statut, notes })
      showToast(statut === '🔒 Bloqué' ? '🔒 Bloqué' : '✓ Créneau ouvert')
      load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const bloquerJour = async () => {
    setSaving(true)
    try {
      await notion.addCreneau({ date: selectedDay, heure: '', statut: '🔒 Bloqué', notes: panelData?.notes || 'Journée bloquée' })
      showToast('🔒 Journée bloquée')
      setPanel(null); load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  const deleteCreneau = async (id) => {
    try { await notion.deleteCreneau(id); showToast('Supprimé'); load() } catch(e) { showToast('Erreur') }
  }

  // Ajouter RDV direct
  const submitRdv = async () => {
    if (!rdvForm.client || !rdvForm.heure) return
    // Vérifier chevauchement avec RDVs existants
    if (hasOverlap(selRdvs, rdvForm.heure, rdvForm.duree)) {
      showToast('⚠️ Créneau déjà occupé — choisis une autre heure')
      return
    }
    setSaving(true)
    try {
      const heureFin = (() => {
        const [h,m] = rdvForm.heure.split(':').map(Number)
        const total = h*60+m+parseInt(rdvForm.duree||120)
        return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
      })()
      await notion.addAppointment({
        client: rdvForm.client, style: rdvForm.style,
        prixEstime: rdvForm.prixEstime, acompte: rdvForm.acompte,
        date: selectedDay, heure: rdvForm.heure, duree: rdvForm.duree,
        natio: rdvForm.natio, source: rdvForm.source, sessions: 1,
        heureFin
      })
      // Si le créneau était ouvert, le passer en Réservé
      const cr = creneauxForDay(selectedDay).find(c => c.properties.Heure?.rich_text?.[0]?.plain_text === rdvForm.heure && c.properties.Statut?.select?.name === '🟢 Ouvert')
      if (cr) await notion.updateCreneauStatut(cr.id, '📅 Réservé')
      showToast('📅 RDV ajouté')
      setPanel(null)
      setRdvForm({ client:'', style:'', prixEstime:'', heure:'10:00', duree:'120', natio:'🇫🇷 FR', source:'📸 Instagram', acompte:'0' })
      load()
    } catch(e) { showToast('Erreur: ' + e.message) }
    setSaving(false)
  }

  // Confirmer RDV prévu
  const submitConfirm = async () => {
    if (!panelData) return
    setSaving(true)
    try {
      await notion.confirmAppointment(panelData.id, {
        prix: parseFloat(confForm.prix), paiement: confForm.paiement,
        acompte: parseFloat(confForm.acompte)||0,
        date: getDateOnly(panelData), sessions: 1
      })
      showToast('✅ RDV confirmé')
      setPanel(null); load()
    } catch(e) { showToast('Erreur') }
    setSaving(false)
  }

  // Ouvrir tous les créneaux libres de la semaine (9h-22h)
  const [openingWeek, setOpeningWeek] = useState(false)
  const openAllWeek = async () => {
    setOpeningWeek(true)
    let count = 0
    try {
      for (const day of weekDays) {
        const rdvsD   = rdvsForDay(day)
        const crensD  = creneauxForDay(day)
        for (const h of SLOTS_ALL) {
          // Déjà un créneau existant (ouvert ou bloqué) → skip
          const dejaOuvert = crensD.some(c => c.properties.Heure?.rich_text?.[0]?.plain_text === h)
          if (dejaOuvert) continue
          // Chevauche un RDV → skip
          if (hasOverlap(rdvsD, h, '60')) continue
          await notion.addCreneau({ date: day, heure: h, statut: '🟢 Ouvert' })
          count++
        }
      }
      showToast(`✓ ${count} créneau${count>1?'x':''} ouverts`)
      load()
    } catch(e) { showToast('Erreur: ' + e.message) }
    setOpeningWeek(false)
  }

  const doNoShow = async (s) => {
    try { await notion.noShowAppointment(s.id); showToast('👻 No-show'); load() } catch(e) {}
  }

  // ── RENDER ────────────────────────────────────────────────
  const selRdvs = rdvsForDay(selectedDay)
  const selCreneaux = creneauxForDay(selectedDay)
  const isBloque = isBloqueDay(selectedDay)
  const d = new Date(selectedDay)
  const dayLabel = `${DAY_FULL[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', paddingBottom:'80px' }}>

      {/* ── BOTTOM SHEET PANEL ── */}
      {panel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'flex-end' }}
          onClick={() => setPanel(null)}>
          <div style={{ background:'var(--surface)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:480, margin:'0 auto', padding:'20px 20px 40px', maxHeight:'85dvh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* Ajouter RDV direct */}
            {panel === 'addRdv' && (<>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, marginBottom:'16px' }}>
                📅 Nouveau RDV — {dayLabel}
              </div>
              <div className="form-group" style={{ marginBottom:'10px' }}>
                <label>Client *</label>
                <input value={rdvForm.client} onChange={e=>setRdvForm({...rdvForm,client:e.target.value})} placeholder="Prénom / identifiant"/>
              </div>
              <div className="form-group" style={{ marginBottom:'10px' }}>
                <label>Style / Projet</label>
                <input value={rdvForm.style} onChange={e=>setRdvForm({...rdvForm,style:e.target.value})} placeholder="Botanical, portrait..."/>
              </div>
              {/* Sélecteur horaire avec détection chevauchement */}
              <div style={{ marginBottom:'12px' }}>
                <label style={{ fontSize:'11px', fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'8px' }}>Heure</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'5px', marginBottom:'8px' }}>
                  {SLOTS_DEFAULT.map(h => {
                    const busy = hasOverlap(selRdvs, h, rdvForm.duree)
                    const sel  = rdvForm.heure === h
                    return (
                      <button key={h} type="button" disabled={busy} onClick={()=>!busy&&setRdvForm({...rdvForm,heure:h})} style={{
                        padding:'8px 2px', borderRadius:'8px', textAlign:'center',
                        fontFamily:'var(--font-mono)', fontSize:'11px', fontWeight:700, cursor:busy?'not-allowed':'pointer',
                        background: sel ? 'var(--txt)' : busy ? 'rgba(192,57,43,.08)' : 'var(--bg)',
                        color:      sel ? 'var(--bg)' : busy ? '#C0392B' : 'var(--txt2)',
                        border:     `1px solid ${sel ? 'var(--txt)' : busy ? 'rgba(192,57,43,.2)' : 'var(--border2)'}`,
                        opacity:    busy ? .6 : 1,
                        textDecoration: busy ? 'line-through' : 'none'
                      }}>{h}</button>
                    )
                  })}
                </div>
                <input type="time" value={rdvForm.heure} onChange={e=>setRdvForm({...rdvForm,heure:e.target.value})}
                  style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--txt)' }}/>
                {hasOverlap(selRdvs, rdvForm.heure, rdvForm.duree) && (
                  <div style={{ marginTop:'6px', fontSize:'12px', color:'#C0392B', fontWeight:600 }}>⚠️ Ce créneau chevauche un RDV existant</div>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Prix €</label>
                  <input type="number" inputMode="decimal" value={rdvForm.prixEstime} onChange={e=>setRdvForm({...rdvForm,prixEstime:e.target.value})} style={{textAlign:'center',fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Prix €</label>
                  <input type="number" inputMode="decimal" value={rdvForm.prixEstime} onChange={e=>setRdvForm({...rdvForm,prixEstime:e.target.value})} style={{textAlign:'center',fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{ margin:0 }}>
                  <label>Acompte €</label>
                  <input type="number" inputMode="decimal" value={rdvForm.acompte} onChange={e=>setRdvForm({...rdvForm,acompte:e.target.value})} style={{textAlign:'center',fontFamily:'var(--font-mono)'}}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
                {[['60','1h'],['90','1h30'],['120','2h'],['150','2h30'],['180','3h'],['240','4h'],['480','Journée']].map(([v,l])=>(
                  <button key={v} onClick={()=>setRdvForm({...rdvForm,duree:v})} style={{
                    padding:'5px 11px', borderRadius:'20px', fontSize:'12px', fontWeight:600, cursor:'pointer', border:'none',
                    background: rdvForm.duree===v ? 'var(--txt)' : 'var(--bg)',
                    color: rdvForm.duree===v ? 'var(--bg)' : 'var(--txt2)'
                  }}>{l}</button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={submitRdv}
                disabled={saving||!rdvForm.client||hasOverlap(selRdvs,rdvForm.heure,rdvForm.duree)}
                style={{width:'100%',padding:'14px'}}>
                {saving ? '…' : hasOverlap(selRdvs,rdvForm.heure,rdvForm.duree) ? '⚠️ Heure occupée' : '✓ Ajouter le RDV'}
              </button>
            </>)}

            {/* Ouvrir / bloquer créneaux */}
            {panel === 'addCreneau' && (<>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, marginBottom:'16px' }}>
                🗓 Gérer — {dayLabel}
              </div>

              {/* Créneaux existants */}
              {selCreneaux.length > 0 && (
                <div style={{ marginBottom:'16px' }}>
                  <div style={{ fontSize:'10px', fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Créneaux actifs</div>
                  {selCreneaux.map(c => {
                    const h = c.properties.Heure?.rich_text?.[0]?.plain_text || 'Journée'
                    const st = c.properties.Statut?.select?.name || ''
                    const stColor = st==='🟢 Ouvert'?'#1A8C5A': st==='🔒 Bloqué'?'#C0392B':'#2980B9'
                    return (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--r)', marginBottom:'6px', border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'15px' }}>{h || 'Journée'}</span>
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:stColor+'22', color:stColor }}>{st}</span>
                        </div>
                        <button onClick={()=>deleteCreneau(c.id)} style={{ background:'none', border:'none', color:'var(--txt3)', cursor:'pointer', fontSize:'16px', padding:'4px 8px' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Ouvrir créneaux */}
              <div style={{ fontSize:'10px', fontWeight:700, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>Ouvrir un créneau</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'6px', marginBottom:'16px' }}>
                {SLOTS_DEFAULT.map(h => {
                  const deja = selCreneaux.find(c => c.properties.Heure?.rich_text?.[0]?.plain_text === h)
                  return (
                    <button key={h} onClick={()=>{ if(!deja) addCreneau(h,'🟢 Ouvert') }} disabled={!!deja||saving} style={{
                      padding:'10px 4px', borderRadius:'10px', textAlign:'center',
                      fontFamily:'var(--font-mono)', fontSize:'12px', fontWeight:700, cursor: deja?'default':'pointer',
                      background: deja ? 'var(--bg)' : 'rgba(26,140,90,.1)',
                      color: deja ? 'var(--txt3)' : '#1A8C5A',
                      border: `1px solid ${deja ? 'var(--border)' : 'rgba(26,140,90,.3)'}`,
                      opacity: deja ? .5 : 1
                    }}>{h}</button>
                  )
                })}
              </div>

              {/* Heure personnalisée */}
              <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
                <input type="time" id="custom-h" style={{ flex:1, background:'var(--bg)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--txt)' }} defaultValue="13:00"/>
                <button onClick={()=>{ const h=document.getElementById('custom-h').value; if(h) addCreneau(h,'🟢 Ouvert') }} disabled={saving} style={{ padding:'10px 16px', background:'rgba(26,140,90,.12)', border:'1px solid rgba(26,140,90,.3)', borderRadius:'var(--r)', color:'#1A8C5A', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer' }}>
                  + Ouvrir
                </button>
              </div>

              {/* Bloquer la journée */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
                <div className="form-group" style={{ marginBottom:'10px' }}>
                  <label>Note (optionnel)</label>
                  <input placeholder="Congé, convention, perso..." onChange={e=>setPanelData({...(panelData||{}),notes:e.target.value})}/>
                </div>
                <button onClick={bloquerJour} disabled={saving} style={{ width:'100%', padding:'12px', background:'rgba(192,57,43,.08)', border:'1.5px solid rgba(192,57,43,.3)', borderRadius:'var(--r)', color:'#C0392B', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                  🔒 Bloquer toute la journée
                </button>
              </div>
            </>)}

            {/* Confirmer RDV */}
            {panel === 'confirmRdv' && panelData && (()=>{
              const acompteRecu   = parseFloat(confForm.acompte) || 0
              const prixTotal     = parseFloat(confForm.prix) || 0
              const solde         = Math.max(0, prixTotal - acompteRecu)
              const hasAcompte    = acompteRecu > 0

              return (<>
                {/* En-tête client */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-head)', fontSize:'17px', fontWeight:800 }}>
                      {panelData.properties['Client prénom']?.rich_text?.[0]?.plain_text||'Client'}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--txt3)', marginTop:'2px' }}>
                      {getHeure(panelData)||''} · {panelData.properties['Style / Type']?.rich_text?.[0]?.plain_text||''}
                    </div>
                  </div>
                  <div style={{ fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'20px', background:'var(--gold-lt)', color:'var(--gold-dk)' }}>
                    Client venu ✓
                  </div>
                </div>

                {/* Bloc acompte — mis en avant si acompte reçu */}
                {hasAcompte && (
                  <div style={{ background:'rgba(26,140,90,.06)', border:'1.5px solid rgba(26,140,90,.25)', borderRadius:'var(--r)', padding:'14px 16px', marginBottom:'14px' }}>
                    <div style={{ fontSize:'10px', fontWeight:700, color:'#1A8C5A', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'10px' }}>
                      💳 Acompte déjà encaissé
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', textAlign:'center' }}>
                      <div style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'10px 6px' }}>
                        <div style={{ fontSize:'10px', color:'var(--txt3)', marginBottom:'3px' }}>Acompte reçu</div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:700, color:'#1A8C5A' }}>{acompteRecu}€</div>
                      </div>
                      <div style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'10px 6px' }}>
                        <div style={{ fontSize:'10px', color:'var(--txt3)', marginBottom:'3px' }}>Prix total</div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:700, color:'var(--txt)' }}>{prixTotal||'?'}€</div>
                      </div>
                      <div style={{ background: solde===0 ? 'rgba(26,140,90,.1)' : 'rgba(212,130,10,.08)', borderRadius:'var(--r)', padding:'10px 6px', border: solde===0 ? '1px solid rgba(26,140,90,.3)' : '1px solid rgba(212,130,10,.2)' }}>
                        <div style={{ fontSize:'10px', color:'var(--txt3)', marginBottom:'3px' }}>Solde à encaisser</div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:700, color: solde===0 ? '#1A8C5A' : '#D4820A' }}>
                          {prixTotal ? solde+'€' : '—'}
                        </div>
                      </div>
                    </div>
                    {solde === 0 && prixTotal > 0 && (
                      <div style={{ fontSize:'11px', color:'#1A8C5A', fontWeight:600, textAlign:'center', marginTop:'10px' }}>
                        ✅ Entièrement payé — rien à encaisser
                      </div>
                    )}
                  </div>
                )}

                {/* Prix total (éditable) */}
                <div className="form-group" style={{ marginBottom:'12px' }}>
                  <label>Prix total de la séance (€)</label>
                  <input type="number" inputMode="decimal" value={confForm.prix}
                    onChange={e=>setConfForm({...confForm,prix:e.target.value})}
                    style={{fontSize:'32px',fontFamily:'var(--font-mono)',fontWeight:500,textAlign:'center',background:'transparent',border:'none',borderBottom:'2px solid var(--pierre)',borderRadius:0,color:'var(--txt)',width:'100%',padding:'6px 0'}}/>
                </div>

                {/* Mode paiement du solde */}
                {(!hasAcompte || solde > 0) && (
                  <div style={{ marginBottom:'16px' }}>
                    <div style={{ fontSize:'11px', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'8px' }}>
                      {hasAcompte ? `Mode paiement solde (${solde}€)` : 'Mode de paiement'}
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      {['cash','carte'].map(p=>(
                        <button key={p} onClick={()=>setConfForm({...confForm,paiement:p})} style={{
                          flex:1, padding:'10px', borderRadius:'var(--r)', border:'none', cursor:'pointer',
                          fontFamily:'var(--font-head)', fontWeight:700, fontSize:'13px',
                          background: confForm.paiement===p ? 'var(--txt)' : 'var(--bg)',
                          color: confForm.paiement===p ? 'var(--bg)' : 'var(--txt2)'
                        }}>{p==='cash'?'💵 Cash':'💳 Carte'}</button>
                      ))}
                    </div>
                  </div>
                )}

                <button className="btn btn-primary" onClick={submitConfirm} disabled={saving||!confForm.prix}
                  style={{width:'100%',padding:'14px',marginBottom:'8px'}}>
                  {saving ? '…' : hasAcompte && solde===0 ? '✓ Valider — tout encaissé' : '✓ Valider → CA du jour'}
                </button>
                <button onClick={()=>{ doNoShow(panelData); setPanel(null) }}
                  style={{width:'100%',padding:'10px',background:'transparent',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:'13px'}}>
                  👻 No-show
                </button>
              </>)
            })()}

          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 16px 10px', background:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'var(--txt3)', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>← Hub</button>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800 }}>Planning</div>
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          <button onClick={openAllWeek} disabled={openingWeek} style={{
            padding:'5px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, cursor:'pointer',
            background:'rgba(26,140,90,.1)', border:'1px solid rgba(26,140,90,.3)', color:'#1A8C5A'
          }}>{openingWeek ? '…' : '🟢 Semaine'}</button>
          <button onClick={load} style={{ width:30, height:30, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', fontSize:'13px', color:'var(--txt3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↻</button>
        </div>
      </div>

      {/* ── VUE SEMAINE ── */}
      <div style={{ padding:'12px 16px 0' }}>

        {/* Navigation semaine */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{ background:'none', border:'none', color:'var(--txt2)', fontSize:'20px', cursor:'pointer', padding:'4px 8px' }}>‹</button>
          <div style={{ fontSize:'12px', fontWeight:700, color:'var(--txt2)', textAlign:'center' }}>
            {new Date(weekStart).getDate()} {['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][new Date(weekStart).getMonth()]} — {new Date(weekEnd).getDate()} {['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][new Date(weekEnd).getMonth()]}
            <button onClick={()=>{ setWeekStart(mondayOf(todayStr())); setSelDay(todayStr()) }} style={{ marginLeft:'8px', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', background:'var(--gold-lt)', color:'var(--gold-dk)', border:'none', cursor:'pointer', fontWeight:700 }}>Auj.</button>
          </div>
          <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{ background:'none', border:'none', color:'var(--txt2)', fontSize:'20px', cursor:'pointer', padding:'4px 8px' }}>›</button>
        </div>

        {/* Grille 7 jours */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'16px' }}>
          {weekDays.map(day => {
            const isToday  = day === today
            const isSel    = day === selectedDay
            const rdvsD    = rdvsForDay(day)
            const crensD   = creneauxForDay(day)
            const hasPrev  = rdvsD.some(s=>s.properties.Statut?.select?.name===STATUT_PREVU)
            const hasConf  = rdvsD.some(s=>s.properties.Statut?.select?.name===STATUT_CONFIRM)
            const hasCren  = crensD.some(c=>c.properties.Statut?.select?.name==='🟢 Ouvert')
            const isBlok   = crensD.some(c=>c.properties.Statut?.select?.name==='🔒 Bloqué')
            const dow      = new Date(day).getDay()
            const dayNum   = new Date(day).getDate()
            return (
              <button key={day} onClick={()=>setSelDay(day)} style={{
                padding:'8px 2px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:'none',
                background: isSel ? 'var(--txt)' : isToday ? 'var(--gold-lt)' : 'var(--bg)',
                outline: isSel ? 'none' : 'none'
              }}>
                <div style={{ fontSize:'9px', fontWeight:600, color: isSel?'rgba(255,255,255,.6)':isToday?'var(--gold-dk)':'var(--txt3)', marginBottom:'2px' }}>
                  {DAY_SHORT[dow]}
                </div>
                <div style={{ fontSize:'16px', fontWeight:700, color: isSel?'var(--bg)':isToday?'var(--gold-dk)':'var(--txt)', lineHeight:1 }}>
                  {dayNum}
                </div>
                {/* Indicateurs */}
                <div style={{ display:'flex', justifyContent:'center', gap:'2px', marginTop:'4px', minHeight:'6px' }}>
                  {hasPrev  && <div style={{ width:5, height:5, borderRadius:'50%', background: isSel?'rgba(255,255,255,.7)':'var(--amber)' }}/>}
                  {hasConf  && <div style={{ width:5, height:5, borderRadius:'50%', background: isSel?'rgba(255,255,255,.7)':'var(--green)' }}/>}
                  {hasCren  && <div style={{ width:5, height:5, borderRadius:'50%', background: isSel?'rgba(255,255,255,.7)':'#1A8C5A' }}/>}
                  {isBlok   && <div style={{ width:5, height:5, borderRadius:'50%', background: isSel?'rgba(255,255,255,.7)':'var(--red)' }}/>}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── DÉTAIL DU JOUR SÉLECTIONNÉ ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
          <div style={{ fontFamily:'var(--font-head)', fontSize:'15px', fontWeight:800 }}>{dayLabel}</div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={()=>{ setPanel('addCreneau'); setPanelData(null) }} style={{ padding:'7px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:700, cursor:'pointer', background:'rgba(26,140,90,.1)', border:'1px solid rgba(26,140,90,.3)', color:'#1A8C5A' }}>
              🗓 Créneaux
            </button>
            <button onClick={()=>{ setPanel('addRdv'); setRdvForm(f=>({...f,heure:'10:00'})) }} style={{ padding:'7px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:700, cursor:'pointer', background:'var(--txt)', border:'none', color:'var(--bg)' }}>
              + RDV
            </button>
          </div>
        </div>

        {/* Journée bloquée */}
        {isBloque && (
          <div style={{ padding:'12px 16px', background:'rgba(192,57,43,.06)', border:'1px solid rgba(192,57,43,.2)', borderRadius:'var(--r)', marginBottom:'12px', fontSize:'13px', color:'#C0392B', fontWeight:600 }}>
            🔒 Journée bloquée — {creneauxForDay(selectedDay).find(c=>c.properties.Statut?.select?.name==='🔒 Bloqué')?.properties.Notes?.rich_text?.[0]?.plain_text || ''}
          </div>
        )}

        {/* Créneaux ouverts du jour */}
        {selCreneaux.filter(c=>c.properties.Statut?.select?.name==='🟢 Ouvert').length > 0 && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
            {selCreneaux.filter(c=>c.properties.Statut?.select?.name==='🟢 Ouvert').map(c => (
              <div key={c.id} style={{ padding:'5px 12px', borderRadius:'20px', background:'rgba(26,140,90,.1)', border:'1px solid rgba(26,140,90,.3)', fontSize:'12px', fontWeight:700, color:'#1A8C5A', display:'flex', alignItems:'center', gap:'6px' }}>
                🟢 {c.properties.Heure?.rich_text?.[0]?.plain_text}
                <button onClick={()=>deleteCreneau(c.id)} style={{ background:'none', border:'none', color:'rgba(26,140,90,.5)', cursor:'pointer', fontSize:'12px', padding:0 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* RDVs du jour */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'32px', color:'var(--txt3)', fontSize:'13px' }}>Chargement…</div>
        ) : selRdvs.length === 0 && !isBloque ? (
          <div style={{ textAlign:'center', padding:'32px 20px', color:'var(--txt3)', fontSize:'13px' }}>
            Pas de RDV ce jour
          </div>
        ) : (
          selRdvs.map(s => {
            const statut  = s.properties.Statut?.select?.name || ''
            const client  = s.properties['Client prénom']?.rich_text?.[0]?.plain_text || 'Client'
            const style   = s.properties['Style / Type']?.rich_text?.[0]?.plain_text || ''
            const prix    = s.properties.Prix?.number || 0
            const acompte = s.properties['Acompte reçu']?.number || 0
            const heure   = getHeure(s)
            const isPrevu = statut === STATUT_PREVU
            const isConf  = statut === STATUT_CONFIRM
            const isNS    = statut === STATUT_NOSHOW
            const isPast  = selectedDay < today
            const stColor = isConf?'#1A8C5A': isNS?'#888':'var(--amber)'

            return (
              <div key={s.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px', marginBottom:'10px', borderLeft:`3px solid ${stColor}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div>
                    {heure && <div style={{ fontFamily:'var(--font-mono)', fontSize:'13px', fontWeight:700, color:stColor, marginBottom:'2px' }}>{heure}</div>}
                    <div style={{ fontSize:'16px', fontWeight:700 }}>{client}</div>
                    {style && <div style={{ fontSize:'12px', color:'var(--txt2)', marginTop:'2px' }}>{style}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:600 }}>{prix}€</div>
                    {acompte > 0 && <div style={{ fontSize:'10px', color:'#1A8C5A' }}>Acompte {acompte}€</div>}
                    <div style={{ fontSize:'10px', fontWeight:700, marginTop:'4px', padding:'2px 7px', borderRadius:'20px', background:stColor+'22', color:stColor }}>{statut}</div>
                  </div>
                </div>
                {!isNS && !isConf && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                    <button onClick={()=>{ setPanelData(s); setConfForm({ prix:String(prix), paiement:'cash', acompte:String(acompte) }); setPanel('confirmRdv') }} style={{
                      padding:'9px', borderRadius:'var(--r)', border:'none', cursor:'pointer', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px',
                      background: isPast ? 'var(--green)' : 'var(--amber)', color:'#fff'
                    }}>✅ {isPast?'Valider':'Client venu'}</button>
                    {onEditRdv && (
                      <button onClick={()=>{ const dr=s.properties.Date?.date?.start||''; onEditRdv({ id:s.id, client, style, prixEstime:String(prix), sessions:'1', acompte:String(acompte), date:dr.split('T')[0]||'', heure:dr.includes('T')?dr.substring(11,16):'', natio:s.properties.Nationalité?.select?.name||'🇫🇷 FR', source:s.properties.Source?.select?.name||'📸 Instagram' }) }} style={{
                        padding:'9px', borderRadius:'var(--r)', background:'var(--surface)', border:'1.5px solid var(--gold)', color:'var(--gold-dk)', fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px', cursor:'pointer'
                      }}>✏️ Modifier</button>
                    )}
                  </div>
                )}
                {isConf && onEditRdv && (
                  <button onClick={()=>{ const dr=s.properties.Date?.date?.start||''; onEditRdv({ id:s.id, client, style, prixEstime:String(prix), sessions:'1', acompte:String(acompte), date:dr.split('T')[0]||'', heure:dr.includes('T')?dr.substring(11,16):'', natio:s.properties.Nationalité?.select?.name||'🇫🇷 FR', source:s.properties.Source?.select?.name||'📸 Instagram' }) }} style={{
                    width:'100%', padding:'8px', borderRadius:'var(--r)', background:'var(--surface)', border:'1px solid var(--border2)', color:'var(--txt3)', fontFamily:'var(--font-head)', fontWeight:600, fontSize:'11px', cursor:'pointer', marginTop:'4px'
                  }}>✏️ Modifier</button>
                )}
              </div>
            )
          })
        )}

      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
