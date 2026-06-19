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

export default function Booking() {
  const token = window.location.pathname.split('/booking/')[1]?.split('/')[0] || ''

  const [devis,       setDevis]     = useState(null)
  const [loading,     setLoading]   = useState(true)
  const [error,       setError]     = useState('')
  const [step,        setStep]      = useState(1) // 1=résumé, 2=calendrier, 3=acompte, 4=confirmé
  const [selectedDay, setSelDay]    = useState('')
  const [selectedHr,  setSelHr]     = useState('')
  const [sessions,    setSessions]  = useState([]) // RDV déjà pris
  const [saving,      setSaving]    = useState(false)
  const [payUrl,      setPayUrl]    = useState('')
  const [payLoading,  setPayLoading]= useState(false)
  const [lang,        setLang]      = useState('fr')

  const T = {
    fr: {
      loading:'Chargement…', error:'Lien invalide ou expiré.',
      step1title:'Ton projet', step1sub:'Vérifie les détails avant de choisir ton créneau.',
      price:'Prix convenu', acompte:'Acompte à régler',
      next:'Choisir mon créneau →', chooseSlot:'Choisis ton créneau',
      noSlot:'Aucune disponibilité ce jour', confirm:'Confirmer ce créneau →',
      payTitle:'Régler l\'acompte', payDesc:'Paiement sécurisé SumUp',
      payBtn:'Payer l\'acompte maintenant →',
      confirmedTitle:'C\'est réservé ! 🖤', confirmedSub:'Tony a reçu ta réservation.',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Mange bien avant de venir · Hydrate-toi · Vêtements confortables · Sans alcool 24h avant',
      wa:'Une question ? WhatsApp Tony →',
      cancel:'Annuler',
    },
    en: {
      loading:'Loading…', error:'Invalid or expired link.',
      step1title:'Your project', step1sub:'Check the details before choosing your slot.',
      price:'Agreed price', acompte:'Deposit to pay',
      next:'Choose my slot →', chooseSlot:'Choose your slot',
      noSlot:'No availability today', confirm:'Confirm this slot →',
      payTitle:'Pay the deposit', payDesc:'Secure payment via SumUp',
      payBtn:'Pay deposit now →',
      confirmedTitle:'You\'re booked! 🖤', confirmedSub:'Tony received your booking.',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Eat before · Stay hydrated · Comfortable clothes · No alcohol 24h before',
      wa:'Any question? WhatsApp Tony →',
      cancel:'Cancel',
    },
    es: {
      loading:'Cargando…', error:'Enlace inválido o caducado.',
      step1title:'Tu proyecto', step1sub:'Revisa los detalles antes de elegir tu cita.',
      price:'Precio acordado', acompte:'Señal a pagar',
      next:'Elegir mi cita →', chooseSlot:'Elige tu cita',
      noSlot:'Sin disponibilidad hoy', confirm:'Confirmar esta cita →',
      payTitle:'Pagar la señal', payDesc:'Pago seguro con SumUp',
      payBtn:'Pagar la señal ahora →',
      confirmedTitle:'¡Reservado! 🖤', confirmedSub:'Tony ha recibido tu reserva.',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Come antes · Hidrátate · Ropa cómoda · Sin alcohol 24h antes',
      wa:'¿Alguna pregunta? WhatsApp Tony →',
      cancel:'Cancelar',
    },
    de: {
      loading:'Laden…', error:'Ungültiger oder abgelaufener Link.',
      step1title:'Dein Projekt', step1sub:'Überprüfe die Details, bevor du deinen Termin wählst.',
      price:'Vereinbarter Preis', acompte:'Anzahlung',
      next:'Termin wählen →', chooseSlot:'Wähle deinen Termin',
      noSlot:'Keine Verfügbarkeit heute', confirm:'Diesen Termin bestätigen →',
      payTitle:'Anzahlung bezahlen', payDesc:'Sichere Zahlung via SumUp',
      payBtn:'Jetzt Anzahlung bezahlen →',
      confirmedTitle:'Gebucht! 🖤', confirmedSub:'Tony hat deine Buchung erhalten.',
      addr:'Carrer de Santanyí 19 · 07630 Campos, Mallorca',
      tips:'Gut essen · Gut trinken · Bequeme Kleidung · Kein Alkohol 24h vorher',
      wa:'Fragen? WhatsApp Tony →',
      cancel:'Abbrechen',
    },
  }
  const t = T[lang] || T.fr

  // Détection langue navigateur
  useEffect(() => {
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('es')) setLang('es')
    else if (nav.startsWith('de')) setLang('de')
    else if (nav.startsWith('en')) setLang('en')
    else setLang('fr')
  }, [])

  // Charger le devis depuis le token
  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return }
    ;(async () => {
      try {
        const [r, s] = await Promise.all([
          notion.getDevisByToken(token),
          notion.getSessions()
        ])
        if (!r.results?.length) { setError(t.error); setLoading(false); return }
        const d = r.results[0]
        const statut = d.properties.Statut?.select?.name || ''
        if (statut === '✅ Réservé') { setStep(4); setDevis(d); setLoading(false); return }
        if (statut === '❌ Refusé')  { setError('Ce devis a été annulé.'); setLoading(false); return }
        setDevis(d)
        if (s.results) setSessions(s.results)
      } catch(e) { setError(t.error) }
      setLoading(false)
    })()
  }, [token])

  // Créneaux Notion — ouverts uniquement, pas déjà réservés
  const [creneaux, setCreneaux] = useState([])
  useEffect(() => {
    if (!devis) return
    const dateMin = addDays(todayStr(), 1)
    const dateMax = addDays(todayStr(), 30)
    notion.getCreneauxRange(dateMin, dateMax).then(r => {
      if (r.results) setCreneaux(r.results)
    }).catch(() => {})
  }, [devis])

  // Jours qui ont au moins 1 créneau ouvert
  const daysWithSlots = [...new Set(
    creneaux
      .filter(c => c.properties.Statut?.select?.name === '🟢 Ouvert')
      .map(c => (c.properties.Date?.date?.start || '').split('T')[0])
      .filter(Boolean)
  )].sort()

  // Créneaux ouverts pour un jour donné
  const slotsForDay = (day) =>
    creneaux
      .filter(c => {
        const d = (c.properties.Date?.date?.start || '').split('T')[0]
        return d === day && c.properties.Statut?.select?.name === '🟢 Ouvert'
      })
      .map(c => c.properties.Heure?.rich_text?.[0]?.plain_text || '')
      .filter(Boolean)
      .sort()

  // On génère les 30 prochains jours pour la nav calendrier
  const days = []
  let cursor = addDays(todayStr(), 1)
  while (days.length < 30) { days.push(cursor); cursor = addDays(cursor, 1) }

  // Confirmer le créneau → marquer dans Notion + redirect SumUp
  // Confirmer le créneau -> aller au paiement (RDV créé APRÈS paiement)
  const confirmSlot = () => {
    if (!selectedDay || !selectedHr) return
    setStep(3)
  }

  // Créer le RDV dans Notion APRÈS paiement confirmé
  const finalizeBooking = async () => {
    if (!devis || !selectedDay || !selectedHr) return
    try {
      await notion.addAppointment({
        client:     devis.properties['Client']?.rich_text?.[0]?.plain_text || 'Client',
        style:      devis.properties['Description']?.rich_text?.[0]?.plain_text || '',
        prixEstime: devis.properties['Prix']?.number || 0,
        acompte:    devis.properties['Acompte']?.number || 0,
        date:       selectedDay,
        heure:      selectedHr,
        duree:      '120',
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
          {['fr','en','es','de'].map(l => (
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
              <div style={{ borderTop:`1px solid ${border}`, paddingTop:'14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <div style={{ fontSize:'11px', color:muted, marginBottom:'3px' }}>{t.price}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'24px', fontWeight:700, color:text }}>{prix}€</div>
                </div>
                <div>
                  <div style={{ fontSize:'11px', color:muted, marginBottom:'3px' }}>{t.acompte}</div>
                  <div style={{ fontFamily:'monospace', fontSize:'24px', fontWeight:700, color:gold }}>{acompte}€</div>
                </div>
              </div>
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
            {daysWithSlots.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 20px', color:muted, fontSize:'13px' }}>
                <div style={{ fontSize:'28px', marginBottom:'10px' }}>📅</div>
                Aucun créneau disponible pour le moment.<br/>Contacte Tony sur WhatsApp pour fixer un RDV.
                <br/><br/>
                <a href="https://wa.me/34601571142" style={{ color:accent, fontWeight:700, textDecoration:'none' }}>💬 WhatsApp Tony →</a>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                {daysWithSlots.map(d => {
                  const sel   = selectedDay === d
                  const dd    = new Date(d)
                  const slots = slotsForDay(d)
                  const dow   = dd.toLocaleDateString(lang==='fr'?'fr-FR':lang==='es'?'es-ES':lang==='de'?'de-DE':'en-GB',{weekday:'long'})
                  const date  = dd.toLocaleDateString(lang==='fr'?'fr-FR':lang==='es'?'es-ES':lang==='de'?'de-DE':'en-GB',{day:'numeric',month:'long'})
                  return (
                    <button key={d} onClick={() => { setSelDay(d); setSelHr('') }} style={{
                      padding:'12px 16px', borderRadius:'12px', textAlign:'left', cursor:'pointer', border:'none',
                      background: sel ? accent : bg2,
                      outline: sel ? `2px solid ${accent}` : 'none'
                    }}>
                      <div style={{ fontSize:'13px', fontWeight:700, color: sel?'#0C0C0C':text, textTransform:'capitalize' }}>{dow} {date}</div>
                      <div style={{ fontSize:'11px', color: sel?'rgba(0,0,0,.6)':muted, marginTop:'2px' }}>{slots.length} créneau{slots.length>1?'x':''} disponible{slots.length>1?'s':''}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Créneaux horaires */}
            {selectedDay && (
              <div>
                <div style={{ fontSize:'13px', fontWeight:600, color:accent, marginBottom:'12px' }}>
                  {formatDate(selectedDay)}
                </div>
                {slotsForDay(selectedDay).length === 0 ? (
                  <div style={{ textAlign:'center', color:muted, padding:'20px', fontSize:'13px' }}>{t.noSlot}</div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'20px' }}>
                    {slotsForDay(selectedDay).map(h => (
                      <button key={h} onClick={() => setSelHr(h)} style={{
                        padding:'12px 6px', borderRadius:'10px', textAlign:'center', fontWeight:700, fontSize:'14px', cursor:'pointer',
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
              </div>
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
              <div style={{ fontSize:'12px', color:muted }}>Blackthorn Tattoo · Campos, Mallorca</div>
            </div>

            <div style={{ background:bg2, border:`1px solid ${gold}44`, borderRadius:'16px', padding:'20px', marginBottom:'20px', textAlign:'center' }}>
              <div style={{ fontSize:'12px', color:muted, marginBottom:'6px' }}>{t.acompte}</div>
              <div style={{ fontFamily:'monospace', fontSize:'40px', fontWeight:700, color:gold }}>{acompte}€</div>
              <div style={{ fontSize:'12px', color:muted, marginTop:'6px' }}>Solde restant : {prix - acompte}€ (réglé en studio)</div>
            </div>

            {/* Bouton SumUp */}
            {!payUrl ? (
              <button onClick={async () => {
                setPayLoading(true)
                try {
                  const r = await fetch('/api/sumup-checkout', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({
                      amount: acompte,
                      description: `Acompte tatouage — ${client} — ${selectedDay} ${selectedHr}`,
                      reference: `BT-${token}-${Date.now()}`
                    })
                  })
                  const d = await r.json()
                  if (d.payUrl) setPayUrl(d.payUrl)
                  else throw new Error(d.error)
                } catch(e) {
                  window.open(waLink, '_blank')
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
            ) : (
              <a href={payUrl} target="_blank" rel="noopener" onClick={() => setTimeout(finalizeBooking, 3000)} style={{
                display:'block', width:'100%', padding:'16px',
                background:'#1B5E20', color:'white',
                textDecoration:'none', borderRadius:'50px',
                fontSize:'15px', fontWeight:700, textAlign:'center', marginBottom:'10px'
              }}>
                💳 Payer {acompte}€ maintenant →
              </a>
            )}
            {payUrl && (
              <button onClick={finalizeBooking} style={{
                width:'100%', padding:'12px', marginTop:'8px',
                background:'transparent', border:`1px solid ${accent}`, color:accent,
                borderRadius:'50px', fontSize:'13px', fontWeight:700, cursor:'pointer'
              }}>
                ✅ J'ai payé — Confirmer ma réservation
              </button>
            )}
            <div style={{ fontSize:'11px', color:muted, textAlign:'center', marginTop:'8px' }}>
              Paiement sécurisé SumUp · Carte bancaire acceptée
            </div>
          </div>
        )}

        {/* ÉTAPE 4 — Confirmé */}
        {step === 4 && (
          <div style={{ textAlign:'center', paddingTop:'40px' }}>
            <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`rgba(126,200,192,.12)`, border:`2px solid ${accent}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:'28px' }}>
              🖤
            </div>
            <h1 style={{ fontFamily:'Georgia, serif', fontSize:'24px', fontWeight:700, marginBottom:'8px' }}>{t.confirmedTitle}</h1>
            <p style={{ fontSize:'13px', color:muted, marginBottom:'28px' }}>{t.confirmedSub}</p>

            <div style={{ background:bg2, border:`1px solid ${border}`, borderRadius:'16px', padding:'20px', textAlign:'left', marginBottom:'16px' }}>
              <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:muted, marginBottom:'12px' }}>Infos pratiques</div>
              <div style={{ fontSize:'13px', color:text, lineHeight:1.8 }}>📍 {t.addr}</div>
              <div style={{ fontSize:'12px', color:muted, marginTop:'10px', lineHeight:1.7 }}>{t.tips}</div>
            </div>

            <a href="https://wa.me/34601571142" target="_blank" rel="noopener" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              padding:'14px 24px', background:'#25D366', color:'white', textDecoration:'none',
              borderRadius:'50px', fontSize:'14px', fontWeight:700
            }}>
              💬 {t.wa}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
