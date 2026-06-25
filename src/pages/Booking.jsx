import React, { useState, useEffect } from 'react'
import { notion } from '../lib/notion'

const SUMUP_AFFILIATE = 'https://api.sumup.com/v0.1/checkout'
// Note: SumUp paiement en ligne = via SumUp Checkout API ou lien Pay by Link
// On génère un lien SumUp Pay by Link dynamique

const todayStr = () => new Date().toISOString().split('T')[0]

function addDays(str, n) {
  const d = new Date(str); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
}

// Génère les 14 prochains jours avec créneaux dispo
// Les créneaux "ouverts" seront lus depuis Notion Sessions (statut Ouvert)
// Pour l'instant : créneaux par défaut du studio
const DEFAULT_SLOTS = ['10:00','11:00','14:00','15:00','16:00','17:00','18:00','19:00']

// Convertit HH:MM en minutes
const toMin = (h) => { if (!h) return null; const [hh,mm] = h.split(':').map(Number); return hh*60+mm }

// Convertit HH:MM en minutes
const getHeureRdv = (s) => {
  const dateRaw = s.properties.Date?.date?.start || ''
  if (dateRaw.includes('T')) return dateRaw.substring(11, 16)
  // Fallback : heure dans les notes "· 17:00"
  const notes = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
  return notes.match(/·\s*(\d{2}:\d{2})/)?.[1] || null
}

const getDureeRdv = (s) => {
  // Durée stockée en minutes dans Notes "2 session(s)" ou directement
  const notes = s.properties.Notes?.rich_text?.[0]?.plain_text || ''
  const durMatch = notes.match(/(\d+)h(\d*)/)
  if (durMatch) return parseInt(durMatch[1])*60 + (parseInt(durMatch[2])||0)
  // Par défaut 120min (2h) pour tout RDV sans durée précisée
  return 120
}

// Vérifie si [heure, heure+dureeMin] chevauche les RDVs existants du jour
const hasOverlapBooking = (rdvs, heure, dureeMin) => {
  const start = toMin(heure)
  if (start === null) return false
  const end = start + parseInt(dureeMin || 120)
  return rdvs.some(s => {
    const st = s.properties.Statut?.select?.name || ''
    if (st === '👻 No-show' || st === '❌ Annulé') return false
    const h = getHeureRdv(s)
    if (!h) return false
    const sStart = toMin(h)
    const sEnd = sStart + getDureeRdv(s)
    return start < sEnd && end > sStart
  })
}

export default function Booking() {
  const token = window.location.pathname.split('/booking/')[1]?.split('/')[0] || ''

  const [devis,       setDevis]     = useState(null)
  const [loading,     setLoading]   = useState(true)
  const [error,       setError]     = useState('')
  const [step,        setStep]      = useState(1) // 1=résumé, 2=calendrier, 3=acompte, 4=confirmé
  const [selectedDay, setSelDay]    = useState('')
  const [calMonth,    setCalMonth]  = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`
  })
  const [selectedHr,  setSelHr]     = useState('')
  const [sessions,    setSessions]  = useState([]) // RDV déjà pris
  const [saving,      setSaving]    = useState(false)
  const [payUrl,      setPayUrl]    = useState('')
  const [payLoading,  setPayLoading]= useState(false)
  const [checkoutId,  setCheckoutId]= useState('')
  const [lang,        setLang]      = useState('fr')

  const T = {
    fr: {
      loading:'Chargement…', error:'Lien invalide ou expiré.',
      step1title:'Ton projet', step1sub:'Vérifie les détails avant de choisir ton créneau.',
      price:'Prix convenu', acompte:'Acompte à régler', noAcompte:'Aucun',
      next:'Choisir mon créneau →', chooseSlot:'Choisis ton créneau',
      noSlot:'Aucune disponibilité ce jour', confirm:'Confirmer ce créneau →',
      payTitle:'Régler l\'acompte', payDesc:'Paiement sécurisé SumUp',
      payBtn:'Payer l\'acompte maintenant →',
      confirmedTitle:'C\'est réservé ! 🖤', confirmedSub:'Tony a reçu ta réservation.',
      payReceived:'Paiement reçu', depositPaid:'Acompte payé', balanceStudio:'Solde en studio',
      yourAppt:'Ton rendez-vous', addToCalendar:'Ajouter à ton agenda',
      calGoogle:'Google Agenda', calGoogleSub:'Gmail · Android',
      calApple:'Apple Calendar / Outlook', calAppleSub:'iPhone · Mac · Windows',
      practical:'Infos pratiques',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Mange bien avant · Hydrate-toi · Vêtements confortables · Sans alcool 24h avant',
      wa:'Une question ? WhatsApp Tony →', cancel:'Annuler',
      paySecure:'Paiement sécurisé SumUp', payReturn:'Après ton paiement, reviens sur cette page — ta réservation sera confirmée automatiquement',
      duration:'Durée estimée',
    },
    en: {
      loading:'Loading…', error:'Invalid or expired link.',
      step1title:'Your project', step1sub:'Check the details before choosing your slot.',
      price:'Agreed price', acompte:'Deposit to pay', noAcompte:'None',
      next:'Choose my slot →', chooseSlot:'Choose your slot',
      noSlot:'No availability today', confirm:'Confirm this slot →',
      payTitle:'Pay the deposit', payDesc:'Secure payment via SumUp',
      payBtn:'Pay deposit now →',
      confirmedTitle:'You\'re booked! 🖤', confirmedSub:'Tony received your booking.',
      payReceived:'Payment received', depositPaid:'Deposit paid', balanceStudio:'Balance at studio',
      yourAppt:'Your appointment', addToCalendar:'Add to your calendar',
      calGoogle:'Google Calendar', calGoogleSub:'Gmail · Android',
      calApple:'Apple Calendar / Outlook', calAppleSub:'iPhone · Mac · Windows',
      practical:'Practical info',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Eat before · Stay hydrated · Comfortable clothes · No alcohol 24h before',
      wa:'Any question? WhatsApp Tony →', cancel:'Cancel',
      paySecure:'Secure payment via SumUp', payReturn:'After payment, come back to this page — your booking will be confirmed automatically',
      duration:'Estimated duration',
    },
    es: {
      loading:'Cargando…', error:'Enlace inválido o caducado.',
      step1title:'Tu proyecto', step1sub:'Revisa los detalles antes de elegir tu cita.',
      price:'Precio acordado', acompte:'Señal a pagar', noAcompte:'Ninguna',
      next:'Elegir mi cita →', chooseSlot:'Elige tu cita',
      noSlot:'Sin disponibilidad hoy', confirm:'Confirmar esta cita →',
      payTitle:'Pagar la señal', payDesc:'Pago seguro con SumUp',
      payBtn:'Pagar la señal ahora →',
      confirmedTitle:'¡Reservado! 🖤', confirmedSub:'Tony ha recibido tu reserva.',
      payReceived:'Pago recibido', depositPaid:'Señal pagada', balanceStudio:'Resto en el estudio',
      yourAppt:'Tu cita', addToCalendar:'Añadir a tu calendario',
      calGoogle:'Google Calendar', calGoogleSub:'Gmail · Android',
      calApple:'Apple Calendar / Outlook', calAppleSub:'iPhone · Mac · Windows',
      practical:'Información práctica',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Come antes · Hidrátate · Ropa cómoda · Sin alcohol 24h antes',
      wa:'¿Alguna pregunta? WhatsApp Tony →', cancel:'Cancelar',
      paySecure:'Pago seguro con SumUp', payReturn:'Tras el pago, vuelve a esta página — tu reserva se confirmará automáticamente',
      duration:'Duración estimada',
    },
    de: {
      loading:'Laden…', error:'Ungültiger oder abgelaufener Link.',
      step1title:'Dein Projekt', step1sub:'Überprüfe die Details, bevor du deinen Termin wählst.',
      price:'Vereinbarter Preis', acompte:'Anzahlung', noAcompte:'Keine',
      next:'Termin wählen →', chooseSlot:'Wähle deinen Termin',
      noSlot:'Keine Verfügbarkeit heute', confirm:'Diesen Termin bestätigen →',
      payTitle:'Anzahlung bezahlen', payDesc:'Sichere Zahlung via SumUp',
      payBtn:'Jetzt Anzahlung bezahlen →',
      confirmedTitle:'Gebucht! 🖤', confirmedSub:'Tony hat deine Buchung erhalten.',
      payReceived:'Zahlung erhalten', depositPaid:'Anzahlung bezahlt', balanceStudio:'Restbetrag im Studio',
      yourAppt:'Dein Termin', addToCalendar:'Zum Kalender hinzufügen',
      calGoogle:'Google Kalender', calGoogleSub:'Gmail · Android',
      calApple:'Apple Kalender / Outlook', calAppleSub:'iPhone · Mac · Windows',
      practical:'Praktische Infos',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Vorher essen · Viel trinken · Bequeme Kleidung · Kein Alkohol 24h vorher',
      wa:'Fragen? WhatsApp Tony →', cancel:'Abbrechen',
      paySecure:'Sichere Zahlung via SumUp', payReturn:'Nach der Zahlung komm auf diese Seite zurück — deine Buchung wird automatisch bestätigt',
      duration:'Geschätzte Dauer',
    },
    ca: {
      loading:'Carregant…', error:'Enllaç invàlid o caducat.',
      step1title:'El teu projecte', step1sub:'Revisa els detalls abans de triar el teu horari.',
      price:'Preu acordat', acompte:'Bestreta a pagar', noAcompte:'Cap',
      next:'Triar el meu horari →', chooseSlot:'Tria el teu horari',
      noSlot:'Sense disponibilitat avui', confirm:'Confirmar aquest horari →',
      payTitle:'Pagar la bestreta', payDesc:'Pagament segur amb SumUp',
      payBtn:'Pagar la bestreta ara →',
      confirmedTitle:'Reservat! 🖤', confirmedSub:'En Tony ha rebut la teva reserva.',
      payReceived:'Pagament rebut', depositPaid:'Bestreta pagada', balanceStudio:'Resta a l\'estudi',
      yourAppt:'La teva cita', addToCalendar:'Afegir al calendari',
      calGoogle:'Google Calendar', calGoogleSub:'Gmail · Android',
      calApple:'Apple Calendar / Outlook', calAppleSub:'iPhone · Mac · Windows',
      practical:'Informació pràctica',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Menja bé abans · Hidrata\'t · Roba còmoda · Sense alcohol 24h abans',
      wa:'Alguna pregunta? WhatsApp Tony →', cancel:'Cancel·lar',
      paySecure:'Pagament segur amb SumUp', payReturn:'Després del pagament, torna a aquesta pàgina — la teva reserva es confirmarà automàticament',
      duration:'Durada estimada',
    },
  }
  const t = T[lang] || T.fr

  // Détection langue navigateur
  useEffect(() => {
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('ca')) setLang('ca')
    else if (nav.startsWith('es')) setLang('es')
    else if (nav.startsWith('de')) setLang('de')
    else if (nav.startsWith('en')) setLang('en')
    else setLang('fr')
  }, [])

  // Charger le devis depuis le token
  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return }
    ;(async () => {
      try {
        const r = await notion.getDevisByToken(token)
        if (!r.results?.length) {
          setError('Lien invalide ou expiré — token : ' + token)
          setLoading(false)
          return
        }
        const d = r.results[0]
        const statut = d.properties.Statut?.select?.name || ''
        if (statut === '✅ Réservé') { setStep(4); setDevis(d); setLoading(false); return }
        if (statut === '❌ Refusé')  { setError('Ce devis a été annulé.'); setLoading(false); return }
        setDevis(d)
        // Charger sessions maintenant (bloquant — nécessaire pour le filtrage anti-chevauchement)
        try {
          const s = await notion.getSessions()
          if (s.results) setSessions(s.results)
        } catch(e) { console.warn('sessions non chargées:', e) }
      } catch(e) {
        setError('Erreur technique : ' + (e?.message || 'inconnue'))
      }
      setLoading(false)
    })()
  }, [token])

  // Créneaux Notion — chargés par tranches pour éviter la limite 200 de Notion
  const [creneaux,   setCreneaux]   = useState([])
  const [dataReady,  setDataReady]  = useState(false)

  // Heures disponibles par défaut 9h-22h
  const ALL_HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00',
                     '16:00','17:00','18:00','19:00','20:00','21:00','22:00']

  useEffect(() => {
    if (!devis || sessions === null) return
    const fetchAll = async () => {
      const all = []
      for (let w = 0; w < 5; w++) {
        const dateMin = addDays(todayStr(), w * 6 + 1)
        const dateMax = addDays(todayStr(), w * 6 + 6)
        try {
          const r = await notion.getCreneauxRange(dateMin, dateMax)
          if (r.results) all.push(...r.results)
        } catch(e) {}
      }
      // Pour les 30 prochains jours — si un jour n'a PAS de créneaux Notion
      // on génère des créneaux virtuels 9h-22h (non bloqués)
      const notionDays = new Set(
        all
          .filter(c => c.properties.Statut?.select?.name !== '🔒 Bloqué')
          .map(c => (c.properties.Date?.date?.start || '').split('T')[0])
          .filter(Boolean)
      )
      const virtualCreneaux = []
      for (let i = 1; i <= 30; i++) {
        const day = addDays(todayStr(), i)
        if (notionDays.has(day)) continue // déjà dans Notion
        // Vérifier si le jour n'est pas bloqué entièrement
        const bloqueJour = all.some(c =>
          (c.properties.Date?.date?.start || '').split('T')[0] === day &&
          c.properties.Statut?.select?.name === '🔒 Bloqué' &&
          !c.properties.Heure?.rich_text?.[0]?.plain_text
        )
        if (bloqueJour) continue
        // Générer créneaux virtuels pour ce jour
        for (const h of ALL_HOURS) {
          virtualCreneaux.push({
            id: 'virtual-' + day + '-' + h,
            properties: {
              Date:   { date: { start: day } },
              Heure:  { rich_text: [{ plain_text: h }] },
              Statut: { select: { name: '🟢 Ouvert' } }
            }
          })
        }
      }
      setCreneaux([...all, ...virtualCreneaux])
      setDataReady(true)
    }
    fetchAll()
  }, [devis, sessions])

  // Vérifier le paiement quand le client revient sur la page (après SumUp)
  useEffect(() => {
    if (!checkoutId || !token || step !== 3) return
    const check = async () => {
      try {
        const r = await fetch(`/api/sumup-check?checkoutId=${checkoutId}&token=${token}`)
        const d = await r.json()
        if (d.paid) {
          await finalizeBooking()
          setStep(4)
        }
      } catch(e) {}
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [checkoutId, token, step])

  // Durée du devis en minutes
  const devisDureeMin = devis?.properties['Durée']?.number || 120

  // RDVs du jour (prévus ou confirmés) pour vérifier chevauchement
  const rdvsForDay = (day) => sessions.filter(s => {
    const dateRaw = s.properties.Date?.date?.start || ''
    const dateDay = dateRaw.split('T')[0]
    const st = s.properties.Statut?.select?.name || ''
    return dateDay === day && ['🗓 Prévu','✅ Confirmé'].includes(st)
  })

  // Créneaux virtuels 9h-20h — indépendants de Notion
  const ALL_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
    '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30',
    '17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30',
    '21:00','21:30','22:00']

  const slotsForDay = (day) => {
    const rdvs = rdvsForDay(day)
    // Créneaux bloqués dans Notion (🔴 Fermé ou déjà pris)
    const blockedNotion = new Set(
      creneaux
        .filter(c => {
          const d = (c.properties.Date?.date?.start || '').split('T')[0]
          return d === day && c.properties.Statut?.select?.name !== '🟢 Ouvert'
        })
        .map(c => c.properties.Heure?.rich_text?.[0]?.plain_text || '')
        .filter(Boolean)
    )
    return ALL_SLOTS.filter(h => {
      if (blockedNotion.has(h)) return false
      if (hasOverlapBooking(rdvs, h, devisDureeMin)) return false
      return true
    })
  }

  // Tous les jours des 100 prochains jours (sauf dimanche si Tony ne travaille pas le dimanche)
  const today0 = new Date().toISOString().split('T')[0]
  const candidateDays = Array.from({ length: 100 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1)
    return d.toISOString().split('T')[0]
  })

  // Jours réellement disponibles après filtrage chevauchements
  const daysWithSlots = candidateDays.filter(day => slotsForDay(day).length > 0)

  // On génère les 30 prochains jours pour la nav calendrier
  const days = []
  let cursor = addDays(todayStr(), 1)
  while (days.length < 30) { days.push(cursor); cursor = addDays(cursor, 1) }

  // Confirmer le créneau → marquer dans Notion + redirect SumUp
  // Confirmer le créneau -> aller au paiement (simple, sans await)
  const confirmSlot = () => {
    if (!selectedDay || !selectedHr) return
    setStep(3)
  }

  // Créer le RDV dans Notion APRÈS paiement confirmé
  const finalizeBooking = async () => {
    if (!devis || !selectedDay || !selectedHr) return
    try {
      const devisDuree = String(devis.properties['Durée']?.number || 120)
      await notion.addAppointment({
        client:     devis.properties['Client']?.rich_text?.[0]?.plain_text || 'Client',
        style:      devis.properties['Description']?.rich_text?.[0]?.plain_text || '',
        prixEstime: devis.properties['Prix']?.number || 0,
        acompte:    devis.properties['Acompte']?.number || 0,
        date:       selectedDay,
        heure:      selectedHr,
        duree:      devisDuree,
        natio:      'Autre',
        source:     '🔗 Lien réservation',
        sessions:   1,
      })
      await notion.markDevisReserve(devis.id, selectedDay, selectedHr)
    } catch(e) { console.error('finalizeBooking error:', e) }
    setStep(4)
  }

  const acompte = devis ? (devis.properties['Acompte']?.number || 0) : 0
  const prix    = devis ? (devis.properties['Prix']?.number || 0) : 0
  const client  = devis ? (devis.properties['Client']?.rich_text?.[0]?.plain_text || '') : ''
  const desc    = devis ? (devis.properties['Description']?.rich_text?.[0]?.plain_text || '') : ''

  // SumUp Pay by Link (lien simple vers le paiement SumUp)
  // Tony devra générer ce lien depuis son compte SumUp
  // En attendant l'API, on génère un lien WhatsApp avec le montant
  const sumupLink = `https://pay.sumup.com/b2c/BLACKTHORN?amount=${acompte}&currency=EUR&title=Acompte%20tatouage%20${client}`
  const waLink    = `https://wa.me/34601571142?text=Acompte%20${acompte}%E2%82%AC%20pour%20${encodeURIComponent(client)}%20%E2%80%94%20${selectedDay}%20${selectedHr}`

  // ── STYLES ──────────────────────────────────────────────────
  const bg = '#0C0C0C', bg2 = '#141414', accent = '#7EC8C0', gold = '#C9A050'
  const text = '#F0EFE8', muted = '#888', border = '#2A2A2A'

  const css = `
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: Inter, sans-serif; background:${bg}; color:${text}; min-height:100vh; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
  `

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:bg, color:muted }}>
      {t.loading}
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:bg, color:muted, textAlign:'center', padding:'24px' }}>
      <div>
        <div style={{ fontSize:'32px', marginBottom:'12px' }}>⚠️</div>
        <div style={{ fontSize:'15px' }}>{error}</div>
      </div>
    </div>
  )

  return (
    <div style={{ background:bg, minHeight:'100vh', fontFamily:'Inter, sans-serif' }}>
      <style>{`
        * { box-sizing:border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        input[type=range] { accent-color: ${accent}; }
      `}</style>

      {/* NAV */}
      <nav style={{ background:'rgba(12,12,12,.96)', backdropFilter:'blur(14px)', borderBottom:`1px solid ${border}`, padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <img src="/blackthorn-logo.png" alt="Blackthorn" style={{ height:'36px', filter:'invert(1)', opacity:.9 }} />
        <div style={{ display:'flex', gap:'4px' }}>
          {['fr','en','es','de','ca'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding:'4px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:700, cursor:'pointer', border:'none', textTransform:'uppercase',
              background: lang===l ? accent : 'transparent', color: lang===l ? '#0C0C0C' : muted
            }}>{l}</button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth:'480px', margin:'0 auto', padding:'24px 16px 60px' }}>

        {/* ÉTAPE 1 — Résumé projet */}
        {step === 1 && (
          <div>
            <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontWeight:700, marginBottom:'4px', color:text }}>{t.step1title}</h1>
            <p style={{ fontSize:'13px', color:muted, marginBottom:'24px' }}>{t.step1sub}</p>

            <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'20px', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', color:muted, marginBottom:'14px' }}>Résumé</div>
              <div style={{ fontSize:'14px', color:text, lineHeight:1.6, marginBottom:'16px' }}>{desc}</div>
              <div style={{ borderTop:`1px solid ${border}`, paddingTop:'14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom: devis?.properties['Durée']?.number ? '12px' : '0' }}>
                <div>
                  <div style={{ fontSize:'11px', color:muted, marginBottom:'3px' }}>{t.price}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'24px', fontWeight:700, color:text }}>{prix}€</div>
                </div>
                <div>
                  <div style={{ fontSize:'11px', color:muted, marginBottom:'3px' }}>{t.acompte}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'24px', fontWeight:700, color:gold }}>{acompte > 0 ? acompte+'€' : t.noAcompte}</div>
                </div>
              </div>
              {devis?.properties['Durée']?.number && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:`rgba(126,200,192,.08)`, border:`1px solid rgba(126,200,192,.2)`, borderRadius:'10px' }}>
                  <span style={{ fontSize:'16px' }}>⏱</span>
                  <div>
                    <div style={{ fontSize:'11px', color:muted }}>Durée estimée de la séance</div>
                    <div style={{ fontSize:'14px', fontWeight:700, color:text }}>
                      {(() => { const m = devis.properties['Durée'].number; const h = Math.floor(m/60); const min = m%60; return h > 0 ? h+'h'+(min>0?min:'') : min+'min' })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setStep(2)} style={{
              width:'100%', padding:'16px', background:accent, color:'#0C0C0C',
              border:'none', borderRadius:'50px', fontSize:'15px', fontWeight:700, cursor:'pointer'
            }}>{t.next}</button>
          </div>
        )}

        {/* ÉTAPE 2 — Calendrier */}
        {step === 2 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h1 style={{ fontFamily:'Georgia, serif', fontSize:'20px', fontWeight:700 }}>{t.chooseSlot}</h1>
              <button onClick={() => setStep(1)} style={{ background:'transparent', border:`1px solid ${border}`, color:muted, borderRadius:'20px', padding:'5px 12px', fontSize:'12px', cursor:'pointer' }}>{t.cancel}</button>
            </div>

            {/* Jours avec créneaux disponibles */}
            {!dataReady ? (
              <div style={{ textAlign:'center', padding:'32px', color:muted, fontSize:'13px' }}>
                Chargement des disponibilités…
              </div>
            ) : daysWithSlots.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 20px', color:muted, fontSize:'13px' }}>
                <div style={{ fontSize:'28px', marginBottom:'10px' }}>📅</div>
                Aucun créneau disponible pour le moment.<br/>Contacte Tony sur WhatsApp pour fixer un RDV.
                <br/><br/>
                <a href="https://wa.me/34601571142" style={{ color:accent, fontWeight:700, textDecoration:'none' }}>💬 WhatsApp Tony →</a>
              </div>
            ) : (
              <>
                {/* Calendrier mensuel */}
                {(() => {
                  const [calYear, calMon] = calMonth.split('-').map(Number)
                  const firstDay = new Date(calYear, calMon-1, 1)
                  const lastDay  = new Date(calYear, calMon, 0)
                  const daysInMonth = lastDay.getDate()
                  // Lundi = 0
                  let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6
                  const cells = []
                  for (let i=0; i<startDow; i++) cells.push(null)
                  for (let d=1; d<=daysInMonth; d++) cells.push(d)

                  const prevMonth = () => {
                    const d = new Date(calYear, calMon-2, 1)
                    setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
                  }
                  const nextMonth = () => {
                    const d = new Date(calYear, calMon, 1)
                    setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
                  }

                  const today0 = new Date().toISOString().split('T')[0]
                  const locale = lang==='fr'?'fr-FR':lang==='es'?'es-ES':lang==='de'?'de-DE':lang==='ca'?'ca-ES':'en-GB'
                  const monthLabel = firstDay.toLocaleDateString(locale, { month:'long', year:'numeric' })

                  return (
                    <div style={{ marginBottom:'20px' }}>
                      {/* Nav mois */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <button onClick={prevMonth} style={{ background:'none', border:`1px solid ${border}`, borderRadius:'50%', width:32, height:32, cursor:'pointer', color:text, fontSize:'16px' }}>‹</button>
                        <div style={{ fontSize:'15px', fontWeight:700, color:text, textTransform:'capitalize' }}>{monthLabel}</div>
                        <button onClick={nextMonth} style={{ background:'none', border:`1px solid ${border}`, borderRadius:'50%', width:32, height:32, cursor:'pointer', color:text, fontSize:'16px' }}>›</button>
                      </div>

                      {/* Jours de la semaine */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'6px' }}>
                        {['L','M','M','J','V','S','D'].map((d,i) => (
                          <div key={i} style={{ textAlign:'center', fontSize:'11px', fontWeight:700, color:muted, padding:'4px 0' }}>{d}</div>
                        ))}
                      </div>

                      {/* Grille jours */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
                        {cells.map((day, i) => {
                          if (!day) return <div key={i} />
                          const dayStr = `${calYear}-${String(calMon).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                          const hasSl  = daysWithSlots.includes(dayStr)
                          const isPast = dayStr < today0
                          const isSel  = selectedDay === dayStr
                          const isToday = dayStr === today0
                          return (
                            <button key={i} onClick={() => {
                              if (!hasSl || isPast) return
                              setSelDay(dayStr); setSelHr('')
                              setTimeout(() => document.getElementById('horaires-section')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50)
                            }} style={{
                              padding:'8px 0', borderRadius:'8px', textAlign:'center',
                              cursor: hasSl && !isPast ? 'pointer' : 'default',
                              border: isSel ? `2px solid ${accent}` : isToday ? `1px solid ${muted}` : '1px solid transparent',
                              background: isSel ? accent : hasSl && !isPast ? `rgba(126,200,192,.12)` : 'transparent',
                              color: isSel ? '#0C0C0C' : isPast ? border : hasSl ? accent : muted,
                              fontWeight: hasSl && !isPast ? 700 : 400,
                              fontSize: '14px',
                              opacity: isPast ? 0.35 : 1,
                              position: 'relative'
                            }}>
                              {day}
                              {hasSl && !isPast && !isSel && (
                                <div style={{ position:'absolute', bottom:3, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:accent }} />
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* Légende */}
                      <div style={{ display:'flex', gap:'14px', marginTop:'10px', justifyContent:'center' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:muted }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:accent }} /> Disponible
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:muted }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:border }} /> Non disponible
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Créneaux horaires — section séparée en bas */}
                <div id="horaires-section" style={{
                  borderTop: selectedDay ? `1px solid ${border}` : 'none',
                  paddingTop: selectedDay ? '20px' : '0'
                }}>
                  {selectedDay && (<>
                    <div style={{ fontSize:'13px', fontWeight:700, color:accent, marginBottom:'14px', textTransform:'capitalize' }}>
                      🕐 {formatDate(selectedDay)}
                    </div>
                    {slotsForDay(selectedDay).length === 0 ? (
                      <div style={{ textAlign:'center', color:muted, padding:'20px', fontSize:'13px' }}>{t.noSlot}</div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' }}>
                        {slotsForDay(selectedDay).map(h => (
                          <button key={h} onClick={() => setSelHr(h)} style={{
                            padding:'14px 6px', borderRadius:'10px', textAlign:'center',
                            fontWeight:700, fontSize:'15px', cursor:'pointer',
                            background: selectedHr===h ? accent : bg2,
                            color:      selectedHr===h ? '#0C0C0C' : text,
                            border:     `1px solid ${selectedHr===h ? accent : border}`
                          }}>{h}</button>
                        ))}
                      </div>
                    )}
                    {selectedHr && (
                      <button onClick={confirmSlot} style={{
                        width:'100%', padding:'16px', background:accent, color:'#0C0C0C',
                        border:'none', borderRadius:'50px', fontSize:'15px', fontWeight:700, cursor:'pointer'
                      }}>💳 Passer au paiement →</button>
                    )}
                  </>)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ÉTAPE 3 — Paiement acompte */}
        {step === 3 && (
          <div>
            <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>{t.payTitle}</h1>
            <p style={{ fontSize:'13px', color:muted, marginBottom:'24px' }}>{t.payDesc}</p>

            {/* Récap RDV */}
            <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'18px', marginBottom:'20px' }}>
              <div style={{ fontSize:'13px', color:accent, fontWeight:700, marginBottom:'4px' }}>
                📅 {formatDate(selectedDay)} à {selectedHr}
              </div>
              <div style={{ fontSize:'12px', color:muted }}>
                Blackthorn Tattoo · Campos, Mallorca
                {devis?.properties['Durée']?.number && ` · ⏱ ${devis.properties['Durée'].number}min`}
              </div>
            </div>

            <div style={{ background:bg2, border:`1px solid ${gold}44`, borderRadius:'16px', padding:'20px', marginBottom:'20px', textAlign:'center' }}>
              <div style={{ fontSize:'12px', color:muted, marginBottom:'6px' }}>{t.acompte}</div>
              <div style={{ fontFamily:'monospace', fontSize:'40px', fontWeight:700, color:gold }}>{acompte}€</div>
              <div style={{ fontSize:'12px', color:muted, marginTop:'6px' }}>Solde restant : {prix - acompte}€ (réglé en studio)</div>
            </div>

            {/* Bouton SumUp via API serveur */}
            {!payUrl ? (
              <button onClick={async () => {
                setPayLoading(true)
                try {
                  const r = await fetch('/api/sumup-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      amount:      acompte,
                      description: `Acompte tatouage — ${client} — ${selectedDay} ${selectedHr}`,
                      reference:   `BT-${token}-${Date.now()}`
                    })
                  })
                  const d = await r.json()
                  if (d.payUrl) {
                    setPayUrl(d.payUrl)
                    setCheckoutId(d.checkoutId || '')
                    // ✅ FIX : écrire la date dans le devis AVANT d'ouvrir SumUp
                    // → le webhook arrive toujours après, la date est déjà dans Notion
                    try { await notion.markDevisReserve(devis.id, selectedDay, selectedHr) } catch(_) {}
                    window.open(d.payUrl, '_blank')
                  } else {
                    throw new Error(d.error || JSON.stringify(d.details) || 'Erreur SumUp')
                  }
                } catch(e) {
                  setPayUrl('ERROR:' + e.message)
                }
                setPayLoading(false)
              }} disabled={payLoading} style={{
                width:'100%', padding:'16px',
                background: payLoading ? '#555' : '#1B5E20',
                color:'white', border:'none', borderRadius:'50px',
                fontSize:'15px', fontWeight:700, cursor:'pointer',
                marginBottom:'10px'
              }}>
                {payLoading ? 'Génération du lien…' : `💳 ${t.payBtn}`}
              </button>
            ) : payUrl.startsWith('ERROR:') ? (
              <div>
                <div style={{ background:'rgba(192,57,43,.1)', border:'1px solid rgba(192,57,43,.3)', borderRadius:'12px', padding:'14px', marginBottom:'12px', fontSize:'12px', color:'#C0392B' }}>
                  ⚠️ {payUrl.replace('ERROR:','')}
                </div>
                <button onClick={() => setPayUrl('')} style={{
                  width:'100%', padding:'12px', background:'transparent',
                  border:`1px solid ${border}`, color:muted, borderRadius:'50px',
                  fontSize:'12px', cursor:'pointer'
                }}>↩ Réessayer</button>
              </div>
            ) : (
              <a href={payUrl} target="_blank" rel="noopener" style={{
                display:'block', width:'100%', padding:'16px',
                background:'#1B5E20', color:'white',
                textDecoration:'none', borderRadius:'50px',
                fontSize:'15px', fontWeight:700, textAlign:'center', marginBottom:'10px'
              }}>
                💳 Payer {acompte}€ sur SumUp →
              </a>
            )}
            {payUrl && !payUrl.startsWith('ERROR:') && (
              <div style={{ marginTop:'12px', padding:'14px 16px', background:`rgba(126,200,192,.06)`, border:`1px solid rgba(126,200,192,.15)`, borderRadius:'12px', fontSize:'12px', color:muted, textAlign:'center', lineHeight:1.6 }}>
                🔒 {t.paySecure}
                <br/>
                <span style={{ fontSize:'11px', opacity:.8 }}>{t.payReturn}</span>
              </div>
            )}
            <div style={{ fontSize:'11px', color:muted, textAlign:'center', marginTop:'8px' }}>
              Paiement sécurisé SumUp · Carte bancaire acceptée
            </div>
          </div>
        )}

        {/* ÉTAPE 4 — Confirmé */}
        {step === 4 && (() => {
          // Liens agenda (Google, Apple, Outlook)
          const calTitle = encodeURIComponent(`Tattoo — Blackthorn Tattoo Campos`)
          const calAddr  = encodeURIComponent('Carrer de Santanyí 19, 07630 Campos, Mallorca')
          const calDesc  = encodeURIComponent(`Tatouage avec Tony · Blackthorn Tattoo Campos\nAcompte réglé : ${acompte}€ · Solde : ${prix - acompte}€ à régler en studio`)

          // Construire dates pour l'agenda
          const buildCalDates = () => {
            if (!selectedDay || !selectedHr) return null
            const dureeMin = devis?.properties['Durée']?.number || 120
            const [hh, mm] = selectedHr.split(':').map(Number)
            const start = new Date(`${selectedDay}T${selectedHr}:00`)
            const end   = new Date(start.getTime() + dureeMin * 60000)
            const fmt   = (d) => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'
            const fmtApple = (d) => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'
            return { start: fmt(start), end: fmt(end) }
          }
          const dates = buildCalDates()

          const googleUrl = dates
            ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${dates.start}/${dates.end}&details=${calDesc}&location=${calAddr}`
            : null

          // Fichier ICS pour Apple/Outlook
          const icsContent = dates ? [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Blackthorn Tattoo//FR',
            'BEGIN:VEVENT',
            `DTSTART:${dates.start}`,
            `DTEND:${dates.end}`,
            `SUMMARY:Tattoo — Blackthorn Tattoo Campos`,
            `LOCATION:Carrer de Santanyí 19, 07630 Campos, Mallorca`,
            `DESCRIPTION:Acompte réglé : ${acompte}€ · Solde : ${prix - acompte}€ à régler en studio`,
            'END:VEVENT', 'END:VCALENDAR'
          ].join('\r\n') : null

          const downloadIcs = () => {
            if (!icsContent) return
            const blob = new Blob([icsContent], { type: 'text/calendar' })
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href = url; a.download = 'rdv-blackthorn.ics'; a.click()
            URL.revokeObjectURL(url)
          }

          return (
            <div style={{ paddingTop:'32px' }}>
              {/* Header confirmation paiement */}
              <div style={{ textAlign:'center', marginBottom:'28px' }}>
                <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'rgba(26,140,90,.12)', border:`2px solid #1A8C5A`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'28px' }}>
                  ✅
                </div>
                <h1 style={{ fontFamily:'Georgia, serif', fontSize:'22px', fontWeight:700, marginBottom:'6px', color:text }}>{t.confirmedTitle}</h1>
                <p style={{ fontSize:'13px', color:muted }}>{t.confirmedSub}</p>
              </div>

              {/* Bloc paiement confirmé */}
              <div style={{ background:'rgba(26,140,90,.06)', border:'1.5px solid rgba(26,140,90,.25)', borderRadius:'16px', padding:'18px', marginBottom:'14px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, color:'#1A8C5A', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>💳 {t.payReceived}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <div style={{ background:'rgba(0,0,0,.15)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                    <div style={{ fontSize:'10px', color:muted, marginBottom:'3px' }}>{t.depositPaid}</div>
                    <div style={{ fontFamily:'monospace', fontSize:'20px', fontWeight:700, color:'#1A8C5A' }}>{acompte}€</div>
                  </div>
                  <div style={{ background:'rgba(0,0,0,.15)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
                    <div style={{ fontSize:'10px', color:muted, marginBottom:'3px' }}>{t.balanceStudio}</div>
                    <div style={{ fontFamily:'monospace', fontSize:'20px', fontWeight:700, color:text }}>{prix - acompte}€</div>
                  </div>
                </div>
              </div>

              {/* Bloc RDV confirmé */}
              {selectedDay && selectedHr && (
                <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'18px', marginBottom:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>📅 {t.yourAppt}</div>
                  <div style={{ fontSize:'16px', fontWeight:700, color:text, marginBottom:'4px', textTransform:'capitalize' }}>
                    {new Date(selectedDay).toLocaleDateString(lang==='fr'?'fr-FR':lang==='es'?'es-ES':lang==='de'?'de-DE':'en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                  </div>
                  <div style={{ fontSize:'14px', color:muted, marginBottom:'4px' }}>🕐 {selectedHr}{devis?.properties['Durée']?.number ? ` — ${t.duration} : ${Math.floor(devis.properties['Durée'].number/60)}h${devis.properties['Durée'].number%60>0?devis.properties['Durée'].number%60:''}` : ''}</div>
                  <div style={{ fontSize:'13px', color:muted }}>📍 Carrer de Santanyí 19 · Campos, Mallorca</div>
                </div>
              )}

              {/* Ajouter à l'agenda */}
              {dates && (
                <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'18px', marginBottom:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'12px' }}>🗓 {t.addToCalendar}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {googleUrl && (
                      <a href={googleUrl} target="_blank" rel="noopener" style={{
                        display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px',
                        background:'rgba(66,133,244,.1)', border:'1px solid rgba(66,133,244,.25)',
                        borderRadius:'12px', textDecoration:'none', color:text
                      }}>
                        <span style={{ fontSize:'18px' }}>📅</span>
                        <div>
                          <div style={{ fontSize:'13px', fontWeight:700 }}>{t.calGoogle}</div>
                          <div style={{ fontSize:'11px', color:muted }}>{t.calGoogleSub}</div>
                        </div>
                        <span style={{ marginLeft:'auto', fontSize:'12px', color:muted }}>→</span>
                      </a>
                    )}
                    <button onClick={downloadIcs} style={{
                      display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px',
                      background:'rgba(255,255,255,.05)', border:`1px solid ${border}`,
                      borderRadius:'12px', cursor:'pointer', width:'100%', textAlign:'left', color:text
                    }}>
                      <span style={{ fontSize:'18px' }}>🍎</span>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:700 }}>{t.calApple}</div>
                        <div style={{ fontSize:'11px', color:muted }}>{t.calAppleSub}</div>
                      </div>
                      <span style={{ marginLeft:'auto', fontSize:'12px', color:muted }}>↓</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Infos pratiques */}
              <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'18px', marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:muted, marginBottom:'10px' }}>{t.practical}</div>
                <div style={{ fontSize:'12px', color:muted, lineHeight:1.8 }}>{t.tips}</div>
              </div>

              <a href="https://wa.me/34601571142" target="_blank" rel="noopener" style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                padding:'14px 24px', background:'#25D366', color:'white', textDecoration:'none',
                borderRadius:'50px', fontSize:'14px', fontWeight:700
              }}>
                💬 {t.wa}
              </a>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
