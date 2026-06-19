import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

// ── CONSTANTES TARIF ──────────────────────────────────────────
const PRICES = {
  low:  { xs:70, s:70, m:90,  l:200, xl:350, xxl:600 },
  high: { xs:80, s:85, m:115, l:260, xl:450, xxl:780 }
}
const COMPLEXITY = [
  { label:'Minimaliste', mult:0.88 },
  { label:'Simple',      mult:1.00 },
  { label:'Standard',    mult:1.11 },
  { label:'Élaboré',     mult:1.28 },
  { label:'Très complexe', mult:1.44 }
]
const todayStr = () => new Date().toISOString().split('T')[0]

function calcUnit(season, style, size, complexity, ink) {
  const base = PRICES[season][size]
  const styleMult = style === 'blackwork' ? 1.10 : 1.00
  const compMult  = COMPLEXITY[complexity].mult
  const colorAdd  = ink === 'color' ? 15 : 0
  return Math.max(70, Math.round((base * styleMult * compMult + colorAdd) / 5) * 5)
}

function calcAcompte(prix) {
  const pct10 = prix * 0.10
  if (pct10 <= 30) return 30
  return Math.ceil(pct10 / 10) * 10
}

function calcSession(tattoos, manualDisc) {
  const subtotal = tattoos.reduce((a, t) => a + t.price, 0)
  const n = tattoos.length
  const eligible = subtotal >= 80
  let autoPct = 0
  if (eligible && n >= 4) autoPct = 20
  else if (eligible && n === 3) autoPct = 15
  else if (eligible && n === 2) autoPct = 10
  const afterAuto  = subtotal * (1 - autoPct / 100)
  const manPct     = eligible ? manualDisc : 0
  const afterMan   = afterAuto * (1 - manPct / 100)
  const total      = Math.round(afterMan / 5) * 5
  return { subtotal, autoPct, manPct, total, savings: subtotal - total }
}

function genToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

// ── STYLES INLINE ──────────────────────────────────────────────
const S = {
  page:   { padding:'0 0 90px', minHeight:'100dvh', background:'var(--bg)' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' },
  h1:     { fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:800 },
  card:   { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'16px', marginBottom:'12px' },
  sectionTitle: { fontSize:'10px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--txt3)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' },
  pillRow: { display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' },
  pill: (active) => ({
    padding:'7px 13px', borderRadius:'20px', fontSize:'12px', fontWeight:600, cursor:'pointer',
    background: active ? 'var(--txt)' : 'var(--bg)',
    color:      active ? 'var(--bg)' : 'var(--txt2)',
    border:     active ? 'none'      : '1.5px solid var(--border2)',
    transition: 'all .15s'
  }),
  pillLg: (active) => ({
    flex:1, padding:'10px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:600, cursor:'pointer', textAlign:'center',
    background: active ? 'var(--txt)' : 'var(--bg)',
    color:      active ? 'var(--bg)' : 'var(--txt2)',
    border:     active ? 'none'      : '1.5px solid var(--border2)',
  }),
  input: { width:'100%', background:'var(--bg)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'10px 12px', fontFamily:'var(--font-body)', fontSize:'14px', color:'var(--txt)', outline:'none' },
  priceBox: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:'12px' },
  priceVal: { fontFamily:'var(--font-mono)', fontSize:'28px', fontWeight:600, color:'var(--txt)' },
  acompteBox: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(212,130,10,0.08)', border:'1px solid rgba(212,130,10,0.3)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:'14px' },
  btnPrimary: { width:'100%', padding:'14px', background:'var(--txt)', color:'var(--bg)', border:'none', borderRadius:'var(--r)', fontFamily:'var(--font-head)', fontSize:'14px', fontWeight:700, cursor:'pointer' },
  btnGhost: { padding:'6px 14px', background:'transparent', border:'1px solid var(--border2)', borderRadius:'20px', fontFamily:'var(--font-body)', fontSize:'12px', fontWeight:600, cursor:'pointer', color:'var(--txt2)' },
  tattooItem: { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'10px', marginBottom:'6px' },
  devisItem:  { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px', marginBottom:'10px' },
  badge: (color) => ({ display:'inline-block', fontSize:'10px', fontWeight:700, padding:'3px 9px', borderRadius:'20px', background:color+' 22', border:'1px solid '+color+'55', color:color }),
}

const STATUT_COLOR = {
  '⏳ En attente': '#888',
  '✅ Validé':     '#1A8C5A',
  '❌ Refusé':     '#C0392B',
  '🔗 Lien envoyé':'#2980B9',
  '✅ Réservé':    '#1A8C5A',
}

export default function Devis({ onBack }) {
  const [view, setView] = useState('list') // list | new | detail
  const [devisList, setDevisList] = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [selected, setSelected] = useState(null)

  // ── Calculateur state ───────────────────────────────────────
  const [season,      setSeason]     = useState('low')
  const [style,       setStyle]      = useState('blackwork')
  const [size,        setSize]       = useState('m')
  const [complexity,  setComplexity] = useState(2)
  const [ink,         setInk]        = useState('bw')
  const [tattooNote,  setTattooNote] = useState('')
  const [tattoos,     setTattoos]    = useState([])
  const [manualDisc,  setManualDisc] = useState(0)
  const [clientName,  setClientName] = useState('')
  const [clientNotes, setClientNotes]= useState('')
  const [duree,       setDuree]      = useState('120')
  const [tattooCount, setTattooCount]= useState(1)
  const [saving,      setSaving]     = useState(false)
  const [acompteReq,  setAcompteReq] = useState(true)  // case à décocher
  const [rdvPanel,    setRdvPanel]   = useState(false)
  const [rdvDate,     setRdvDate]    = useState('')
  const [rdvHeure,    setRdvHeure]   = useState('10:00')
  const [rdvSaving,   setRdvSaving]  = useState(false)
  const [vPanel,      setVPanel]     = useState(false)  // panel nouveau versement
  const [vMontant,    setVMontant]   = useState('')
  const [vMode,       setVMode]      = useState('cash')

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  // Versements stockés dans Notes comme JSON: [{"date":"2026-06-20","montant":100,"mode":"cash"},...]
  const parseVersements = (devisItem) => {
    try {
      const notes = devisItem?.properties?.Notes?.rich_text?.[0]?.plain_text || ''
      const match = notes.match(/VERSEMENTS:(\[.*?\])/)
      return match ? JSON.parse(match[1]) : []
    } catch { return [] }
  }

  const totalVerse = (vers) => vers.reduce((s, v) => s + (v.montant || 0), 0)

  const addVersement = async (devisItem, montant, mode) => {
    const vers = parseVersements(devisItem)
    vers.push({ date: new Date().toISOString().split('T')[0], montant: parseFloat(montant), mode })
    const notes = devisItem?.properties?.Notes?.rich_text?.[0]?.plain_text || ''
    const notesBase = notes.replace(/VERSEMENTS:\[.*?\]/, '').trim()
    const newNotes = (notesBase + ' VERSEMENTS:' + JSON.stringify(vers)).trim().substring(0, 1900)
    await notion.patchPage(devisItem.id, {
      Notes: { rich_text: [{ text: { content: newNotes } }] }
    })
  }

  const submitRdvDirect = async () => {
    if (!selected || !rdvDate || !rdvHeure) return
    setRdvSaving(true)
    try {
      const dureeDevis = selected.properties['Durée']?.number || 120
      await notion.addAppointment({
        client:     getStr(selected, 'Client'),
        style:      getStr(selected, 'Description').substring(0, 200),
        prixEstime: getNum(selected, 'Prix'),
        acompte:    getNum(selected, 'Acompte'),
        date:       rdvDate,
        heure:      rdvHeure,
        duree:      String(dureeDevis),
        natio:      'Autre',
        source:     '📋 Devis',
        sessions:   1,
      })
      await notion.updateDevisStatut(selected.id, '✅ Réservé')
      showToast('📅 RDV calé dans le planning ✓')
      setRdvPanel(false)
      setSelected(prev => ({ ...prev, statut: '✅ Réservé' }))
      load()
    } catch(e) { showToast('Erreur: ' + e.message) }
    setRdvSaving(false)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getDevis()
      if (r.results) setDevisList(r.results)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Calculs ─────────────────────────────────────────────────
  const unitPrice = calcUnit(season, style, size, complexity, ink)
  const { subtotal, autoPct, manPct, total, savings } = calcSession(tattoos, manualDisc)
  const acompte = calcAcompte(total)

  const addTattoo = () => {
    const styleLabel = style === 'blackwork' ? 'Blackwork' : 'Fine Line'
    const inkLabel   = ink === 'bw' ? 'Noir & gris' : 'Couleur'
    setTattoos(prev => [...prev, {
      price: unitPrice, style: styleLabel, size, sizeKey: size,
      complexity: COMPLEXITY[complexity].label, complexityIdx: complexity,
      ink: inkLabel, inkKey: ink, styleKey: style,
      note: tattooNote.trim()
    }])
    setTattooCount(n => n + 1)
    setTattooNote('')
  }

  const removeTattoo = (idx) => {
    setTattoos(prev => { const n=[...prev]; n.splice(idx,1); return n })
  }

  const resetCalc = () => {
    setTattoos([]); setTattooCount(1); setManualDisc(0)
    setClientName(''); setClientNotes(''); setTattooNote(''); setDuree('120'); setAcompteReq(true)
    setStyle('blackwork'); setSize('m'); setComplexity(2); setInk('bw')
  }

  // ── Sauvegarder devis ──────────────────────────────────────
  const saveDevis = async () => {
    if (!clientName.trim() || tattoos.length === 0) {
      showToast('Client et au moins 1 tatouage requis'); return
    }
    setSaving(true)
    try {
      const token   = genToken()
      const descArr = tattoos.map((t,i)=>`#${i+1} ${t.style} ${t.size.toUpperCase()} ${t.complexity}${t.note?' — '+t.note:''}`)
      // Notion rich_text limite à 2000 chars — on tronque le JSON des tatouages
      const tatouagesJson = JSON.stringify(tattoos.map(t=>({p:t.price,st:t.styleKey,sz:t.sizeKey,ci:t.complexityIdx,ik:t.inkKey,n:t.note||''})))
      const tatouagesTronc = tatouagesJson.length > 1900 ? tatouagesJson.substring(0, 1900) : tatouagesJson
      await notion.addDevis({
        client:      clientName.trim(),
        description: descArr.join(' | ').substring(0, 1900),
        prix:        total,
        acompte:     acompteReq ? acompte : 0,
        token:       token,
        tatouages:   tatouagesTronc,
        duree:       parseInt(duree) || 120,
        dateCreation:todayStr(),
        notes:       clientNotes.trim().substring(0, 500)
      })
      showToast('Devis sauvegardé ✓')
      resetCalc()
      setView('list')
      load()
    } catch (e) {
      const msg = e?.message || 'Erreur inconnue'
      showToast('Erreur: ' + msg.substring(0, 60))
      console.error('saveDevis error:', e)
    }
    setSaving(false)
  }

  // ── Mettre à jour statut ──────────────────────────────────
  const updateStatut = async (id, statut) => {
    try {
      await notion.updateDevisStatut(id, statut)
      showToast('Statut mis à jour ✓')
      load()
      setSelected(prev => prev ? { ...prev, statut } : prev)
    } catch(e) { showToast('Erreur') }
  }

  // ── Copier lien ───────────────────────────────────────────
  const deleteDevis = async (id) => {
    if (!window.confirm('Supprimer ce devis ?')) return
    try {
      await notion.deleteCreneau(id) // réutilise le même mécanisme d'archivage
      showToast('Devis supprimé')
      load()
    } catch(e) { showToast('Erreur') }
  }

  const copyLink = async (token) => {
    const url = `${window.location.origin}/booking/${token}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Lien copié ✓')
    } catch {
      // fallback
      const el = document.createElement('input')
      el.value = url; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
      showToast('Lien copié ✓')
    }
  }

  const shareLink = (token) => {
    const url = `${window.location.origin}/booking/${token}`
    if (navigator.share) {
      navigator.share({ title: 'Réservation Blackthorn Tattoo', text: 'Réserve ton créneau et paie l\'acompte 👇', url })
    } else { copyLink(token) }
  }

  // ── Helpers données Notion ────────────────────────────────
  const getStr  = (s, field)   => s.properties[field]?.rich_text?.[0]?.plain_text || ''
  const getNum  = (s, field)   => s.properties[field]?.number || 0
  const getStat = (s)          => s.properties.Statut?.select?.name || '⏳ En attente'
  const getToken= (s)          => getStr(s, 'Token')

  // ─────────────────────────────────────────────────────────
  // VUE : LISTE DEVIS
  // ─────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div style={S.page}>
      <div style={{ padding:'16px 16px 0' }}>
        <div style={S.header}>
          <div style={S.h1}>Devis</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button style={S.btnGhost} onClick={onBack}>← Hub</button>
            <button style={{ ...S.btnGhost, background:'var(--txt)', color:'var(--bg)', border:'none' }}
              onClick={() => { resetCalc(); setView('new') }}>+ Nouveau</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'40px', color:'var(--txt3)', fontSize:'13px' }}>Chargement…</div>
        ) : devisList.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--txt3)', fontSize:'13px' }}>
            <div style={{ fontSize:'28px', marginBottom:'10px' }}>📋</div>
            Aucun devis pour l'instant
          </div>
        ) : (
          devisList.map(d => {
            const statut = getStat(d)
            const token  = getToken(d)
            const prix   = getNum(d, 'Prix')
            const acomp  = getNum(d, 'Acompte')
            const client = getStr(d, 'Client')
            const desc   = getStr(d, 'Description')
            const date   = d.properties['Date création']?.date?.start || ''
            const color  = STATUT_COLOR[statut] || '#888'

            return (
              <div key={d.id} style={S.devisItem}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-head)', fontSize:'15px', fontWeight:700 }}>{client}</div>
                    <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'2px' }}>{date}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'18px', fontWeight:600 }}>{prix}€</div>
                    <div style={{ fontSize:'11px', color:'#D4820A' }}>acompte {acomp}€</div>
                  </div>
                </div>
                {desc && <div style={{ fontSize:'12px', color:'var(--txt2)', marginBottom:'10px', lineHeight:1.5 }}>{desc}</div>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:color+'22', color }}>{statut}</span>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {(statut==='⏳ En attente'||statut==='✅ Validé'||statut==='🔗 Lien envoyé') && token && (
                      <button onClick={() => shareLink(token)} style={{ ...S.btnGhost, fontSize:'11px', padding:'5px 10px', color:'#2980B9', borderColor:'#2980B9' }}>
                        📤 Lien
                      </button>
                    )}
                    <button onClick={() => deleteDevis(d.id)} style={{ ...S.btnGhost, fontSize:'11px', padding:'5px 10px', color:'#C0392B', borderColor:'rgba(192,57,43,.3)' }}>
                      🗑
                    </button>
                    <button onClick={() => { setSelected({ ...d, statut, token, prix, acomp, client, desc }); setView('detail') }} style={{ ...S.btnGhost, fontSize:'11px', padding:'5px 10px' }}>
                      Gérer →
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  // ─────────────────────────────────────────────────────────
  // VUE : DÉTAIL / GESTION DEVIS
  // ─────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const statut = getStat(selected)
    const token  = getToken(selected)
    const bookingUrl = `${window.location.origin}/booking/${token}`

    return (
      <div style={S.page}>
        <div style={{ padding:'16px 16px 0' }}>
          <div style={S.header}>
            <div style={S.h1}>{getStr(selected, 'Client')}</div>
            <button style={S.btnGhost} onClick={() => { setSelected(null); setView('list') }}>← Retour</button>
          </div>

          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
              <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px',
                background:(STATUT_COLOR[statut]||'#888')+'22', color:STATUT_COLOR[statut]||'#888' }}>{statut}</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'20px', fontWeight:600 }}>{getNum(selected,'Prix')}€</div>
                <div style={{ fontSize:'11px', color:'#D4820A' }}>acompte {getNum(selected,'Acompte')}€</div>
              </div>
            </div>
            <div style={{ fontSize:'13px', color:'var(--txt2)', lineHeight:1.6 }}>{getStr(selected,'Description')}</div>
          </div>

          {/* Lien de réservation */}
          {token && (
            <div style={{ ...S.card, background:'rgba(41,128,185,0.06)', border:'1px solid rgba(41,128,185,0.25)' }}>
              <div style={{ fontSize:'11px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'#2980B9', marginBottom:'8px' }}>Lien client</div>
              <div style={{ fontSize:'11px', color:'var(--txt3)', wordBreak:'break-all', marginBottom:'12px', padding:'8px', background:'var(--bg)', borderRadius:'8px', fontFamily:'var(--font-mono)' }}>
                {bookingUrl}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <button onClick={() => copyLink(token)} style={{ ...S.btnGhost, width:'100%', textAlign:'center' }}>📋 Copier</button>
                <button onClick={() => shareLink(token)} style={{ ...S.btnGhost, width:'100%', textAlign:'center', color:'#2980B9', borderColor:'#2980B9' }}>📤 Partager</button>
              </div>
            </div>
          )}

          {/* Bloc versements progressifs */}
          {(() => {
            const vers   = parseVersements(selected)
            const total  = getNum(selected, 'Prix')
            const verse  = totalVerse(vers)
            const reste  = Math.max(0, total - verse)
            const pct    = total > 0 ? Math.min(100, Math.round(verse / total * 100)) : 0
            const complet = verse >= total && total > 0

            return (
              <div style={S.card}>
                <div style={{ ...S.sectionTitle, marginBottom:'12px' }}>💰 Versements</div>

                {/* Barre de progression */}
                <div style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px' }}>
                    <span style={{ color:'var(--txt3)' }}>Versé : <strong style={{ color:'#1A8C5A' }}>{verse}€</strong></span>
                    <span style={{ color:'var(--txt3)' }}>Total : <strong style={{ color:'var(--txt)' }}>{total}€</strong></span>
                  </div>
                  <div style={{ background:'var(--bg)', borderRadius:'20px', height:'8px', overflow:'hidden' }}>
                    <div style={{ width: pct+'%', height:'100%', background: complet ? '#1A8C5A' : '#D4820A', borderRadius:'20px', transition:'width .4s' }}/>
                  </div>
                  <div style={{ textAlign:'right', fontSize:'11px', marginTop:'4px', color: complet ? '#1A8C5A' : '#D4820A', fontWeight:700 }}>
                    {complet ? '✅ Intégralement payé' : reste+'€ restants'}
                  </div>
                </div>

                {/* Liste des versements */}
                {vers.length > 0 && (
                  <div style={{ marginBottom:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                    {vers.map((v, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--bg)', borderRadius:'var(--r)', fontSize:'12px' }}>
                        <div style={{ color:'var(--txt3)' }}>{v.date} · {v.mode === 'cash' ? '💵' : '💳'} {v.mode}</div>
                        <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'#1A8C5A' }}>+{v.montant}€</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Panel nouveau versement */}
                {vPanel ? (
                  <div style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'12px', marginBottom:'8px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                      <div>
                        <label style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>Montant €</label>
                        <input type="number" inputMode="decimal" value={vMontant} onChange={e => setVMontant(e.target.value)}
                          placeholder="0" style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'10px', fontFamily:'var(--font-mono)', fontSize:'18px', color:'var(--txt)', textAlign:'center' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>Mode</label>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {['cash','carte'].map(m => (
                            <button key={m} onClick={() => setVMode(m)} style={{
                              flex:1, padding:'10px', borderRadius:'var(--r)', border:'none', cursor:'pointer',
                              fontFamily:'var(--font-head)', fontWeight:700, fontSize:'12px',
                              background: vMode===m ? 'var(--txt)' : 'var(--bg2,var(--bg))',
                              color: vMode===m ? 'var(--bg)' : 'var(--txt2)'
                            }}>{m==='cash'?'💵 Cash':'💳 Carte'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      <button onClick={() => { setVPanel(false); setVMontant('') }} style={{ ...S.btnGhost, textAlign:'center' }}>Annuler</button>
                      <button onClick={async () => {
                        if (!vMontant || parseFloat(vMontant) <= 0) return
                        setSaving(true)
                        try {
                          await addVersement(selected, vMontant, vMode)
                          showToast('✅ Versement enregistré')
                          setVPanel(false); setVMontant('')
                          load()
                          setSelected(prev => {
                            // Recalc notes localement pour refresh immédiat
                            return prev
                          })
                        } catch(e) { showToast('Erreur') }
                        setSaving(false)
                      }} disabled={saving || !vMontant} style={{ ...S.btnPrimary, background: saving||!vMontant ? '#555':'#1A8C5A', opacity:!vMontant?.0:1 }}>
                        ✓ Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setVPanel(true)} style={{ ...S.btnGhost, width:'100%', textAlign:'center', fontSize:'13px' }}>
                    + Ajouter un versement
                  </button>
                )}
              </div>
            )
          })()}

          {/* Caler RDV direct */}
          <div style={S.card}>
            <div style={{ ...S.sectionTitle, marginBottom:'10px' }}>Caler le rendez-vous</div>
            {!rdvPanel ? (
              <button onClick={() => setRdvPanel(true)} style={{ ...S.btnPrimary, background:'#1A8C5A' }}>
                📅 Caler le RDV dans le planning
              </button>
            ) : (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px' }}>
                  <div>
                    <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Date</div>
                    <input type="date" value={rdvDate} onChange={e => setRdvDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--txt)' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Heure</div>
                    <input type="time" value={rdvHeure} onChange={e => setRdvHeure(e.target.value)}
                      style={{ width:'100%', background:'var(--bg)', border:'1.5px solid var(--border2)', borderRadius:'var(--r)', padding:'10px 12px', fontFamily:'var(--font-mono)', fontSize:'14px', color:'var(--txt)' }}/>
                  </div>
                </div>
                {selected.properties['Durée']?.number && (
                  <div style={{ fontSize:'11px', color:'var(--txt3)', marginBottom:'10px' }}>
                    ⏱ Durée : {selected.properties['Durée'].number}min — créneau bloqué jusqu'à {(() => {
                      const [h,m] = rdvHeure.split(':').map(Number)
                      const fin = h*60+m+(selected.properties['Durée']?.number||120)
                      return `${String(Math.floor(fin/60)).padStart(2,'0')}:${String(fin%60).padStart(2,'0')}`
                    })()}
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <button onClick={() => setRdvPanel(false)} style={{ ...S.btnGhost, textAlign:'center' }}>Annuler</button>
                  <button onClick={submitRdvDirect} disabled={rdvSaving || !rdvDate} style={{ ...S.btnPrimary, background: rdvSaving||!rdvDate ? '#555':'#1A8C5A', opacity: !rdvDate ? .6:1 }}>
                    {rdvSaving ? '…' : '✓ Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions statut */}
          <div style={S.card}>
            <div style={{ ...S.sectionTitle, marginBottom:'10px' }}>Mettre à jour le statut</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {[
                { label:'✅ Validé',      val:'✅ Validé',      bg:'#1A8C5A' },
                { label:'❌ Refusé',      val:'❌ Refusé',      bg:'#C0392B' },
                { label:'🔗 Lien envoyé', val:'🔗 Lien envoyé', bg:'#2980B9' },
                { label:'⏳ En attente',  val:'⏳ En attente',  bg:'#888'    },
              ].map(({ label, val, bg }) => (
                <button key={val} onClick={() => updateStatut(selected.id, val)} style={{
                  padding:'10px', borderRadius:'var(--r)', border:`1.5px solid ${bg}44`,
                  background: statut === val ? bg : bg+'11',
                  color: statut === val ? 'white' : bg,
                  fontFamily:'var(--font-body)', fontSize:'12px', fontWeight:700, cursor:'pointer'
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────
  // VUE : NOUVEAU DEVIS (calculateur)
  // ─────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ padding:'16px 16px 0' }}>
        <div style={S.header}>
          <div style={S.h1}>Nouveau devis</div>
          <button style={S.btnGhost} onClick={() => setView('list')}>← Devis</button>
        </div>

        {/* Client */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Client</div>
          <input style={S.input} placeholder="Prénom / identifiant client *"
            value={clientName} onChange={e => setClientName(e.target.value)} />
        </div>

        {/* Switch saison */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Saison</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
            <button style={S.pillLg(season==='low')} onClick={() => setSeason('low')}>🌿 Basse saison<br/><span style={{ fontSize:'10px', opacity:.7 }}>Oct – Avr</span></button>
            <button style={S.pillLg(season==='high')} onClick={() => setSeason('high')}>☀️ Haute saison<br/><span style={{ fontSize:'10px', opacity:.7 }}>Mai – Sep</span></button>
          </div>
        </div>

        {/* Configurateur */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Tatouage #{tattooCount}</div>

          {/* Style */}
          <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Style</div>
          <div style={S.pillRow}>
            {[['blackwork','🖤 Blackwork ×1.10'],['fineline','🪶 Fine Line ×1.00']].map(([k,l]) => (
              <button key={k} style={S.pill(style===k)} onClick={() => setStyle(k)}>{l}</button>
            ))}
          </div>

          {/* Taille */}
          <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Taille</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'14px' }}>
            {[
              ['xs','XS','≤3cm'],['s','S','3–6cm'],['m','M','6–12cm'],
              ['l','L','12–20cm'],['xl','XL','20–35cm'],['xxl','XXL','>35cm']
            ].map(([k,label,dim]) => (
              <button key={k} onClick={() => setSize(k)} style={{
                padding:'9px 6px', borderRadius:'10px', fontSize:'12px', fontWeight:700, cursor:'pointer', textAlign:'center',
                background: size===k ? 'var(--txt)' : 'var(--bg)',
                color:      size===k ? 'var(--bg)' : 'var(--txt2)',
                border:     size===k ? 'none'      : '1.5px solid var(--border2)',
              }}>
                <div>{label}</div>
                <div style={{ fontSize:'10px', fontWeight:400, opacity:.7 }}>{dim}</div>
                <div style={{ fontSize:'10px', fontFamily:'var(--font-mono)', color: size===k?'rgba(255,255,255,.75)':'var(--gold-dk)', marginTop:'2px' }}>
                  {PRICES[season][k]}€
                </div>
              </button>
            ))}
          </div>

          {/* Complexité */}
          <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>
            Complexité — <span style={{ color:'var(--gold-dk)' }}>{COMPLEXITY[complexity].label}</span>
          </div>
          <input type="range" min="0" max="4" value={complexity}
            onChange={e => setComplexity(parseInt(e.target.value))}
            style={{ width:'100%', accentColor:'var(--txt)', marginBottom:'14px', cursor:'pointer' }} />

          {/* Encre */}
          <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Encre</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
            <button style={S.pillLg(ink==='bw')} onClick={() => setInk('bw')}>⬛ Noir & gris<br/><span style={{ fontSize:'10px', opacity:.7 }}>Sans supplément</span></button>
            <button style={S.pillLg(ink==='color')} onClick={() => setInk('color')}>🎨 Couleur<br/><span style={{ fontSize:'10px', opacity:.7 }}>+15€</span></button>
          </div>

          {/* Note */}
          <input style={{ ...S.input, marginBottom:'12px' }} placeholder="Note (motif, emplacement…)"
            value={tattooNote} onChange={e => setTattooNote(e.target.value)} />

          {/* Prix unitaire + bouton ajouter */}
          <div style={S.priceBox}>
            <div style={{ fontSize:'12px', color:'var(--txt3)' }}>Tatouage #{tattooCount}</div>
            <div style={S.priceVal}>{unitPrice}<span style={{ fontSize:'14px', color:'var(--txt3)', marginLeft:'3px' }}>€</span></div>
          </div>
          <button style={{ ...S.btnPrimary, background:'transparent', color:'var(--txt)', border:'2px dashed var(--border2)' }}
            onClick={addTattoo}>
            + Ajouter à la session
          </button>
        </div>

        {/* Session en cours */}
        {tattoos.length > 0 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Session ({tattoos.length} tatouage{tattoos.length>1?'s':''})</div>
            {tattoos.map((t, i) => (
              <div key={i} style={S.tattooItem}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--txt3)', minWidth:'22px' }}>#{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:600 }}>{t.style} · {t.size.toUpperCase()} · {t.complexity}</div>
                  <div style={{ fontSize:'11px', color:'var(--txt3)' }}>{t.ink}{t.note?' · '+t.note:''}</div>
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', fontWeight:600 }}>{t.price}€</div>
                <button onClick={() => removeTattoo(i)} style={{ background:'none', border:'none', color:'var(--txt3)', cursor:'pointer', fontSize:'14px', padding:'4px' }}>✕</button>
              </div>
            ))}

            {/* Réduction manuelle */}
            {subtotal >= 80 && (
              <div style={{ marginTop:'12px', marginBottom:'12px' }}>
                <div style={{ fontSize:'10px', color:'var(--txt3)', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', marginBottom:'6px' }}>Réduction manuelle</div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {[0,10,15,20].map(d => (
                    <button key={d} onClick={() => setManualDisc(d)} style={S.pill(manualDisc===d)}>
                      {d===0?'Aucune':'-'+d+'%'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Totaux */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:'12px', marginTop:'8px' }}>
              {(autoPct>0||manPct>0) && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'var(--txt3)', marginBottom:'4px' }}>
                  <span>Sous-total</span><span style={{ textDecoration:'line-through' }}>{subtotal}€</span>
                </div>
              )}
              {autoPct>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#1A8C5A', marginBottom:'4px' }}>
                  <span>Multi-tatouages (−{autoPct}%)</span><span>−{Math.round(subtotal*autoPct/100)}€</span>
                </div>
              )}
              {manPct>0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#1A8C5A', marginBottom:'4px' }}>
                  <span>Remise manuelle (−{manPct}%)</span><span>−{Math.round(subtotal*(1-autoPct/100)*manPct/100)}€</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
                <span style={{ fontFamily:'var(--font-head)', fontSize:'14px', fontWeight:700 }}>TOTAL</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'26px', fontWeight:600 }}>{total}€</span>
              </div>
            </div>

            {/* Acompte — toggle + calcul */}
            <button
              onClick={() => setAcompteReq(v => !v)}
              style={{
                display:'flex', alignItems:'center', gap:'10px',
                marginBottom:'10px', marginTop:'4px',
                background:'none', border:'none', cursor:'pointer', padding:'4px 0', width:'100%', textAlign:'left'
              }}>
              <div style={{
                width:36, height:20, borderRadius:10, flexShrink:0,
                background: acompteReq ? '#D4820A' : 'var(--border2)',
                position:'relative', transition:'background .2s'
              }}>
                <div style={{
                  position:'absolute', top:2, left: acompteReq ? 18 : 2,
                  width:16, height:16, borderRadius:'50%', background:'white',
                  transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)'
                }}/>
              </div>
              <span style={{ fontSize:'13px', color:'var(--txt2)', userSelect:'none' }}>
                Acompte requis
              </span>
            </button>
            {acompteReq && (
              <div style={S.acompteBox}>
                <div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'#D4820A', textTransform:'uppercase', letterSpacing:'1px' }}>Acompte client</div>
                  <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'2px' }}>
                    {total > 300 ? `10% arrondi à la dizaine = ${calcAcompte(total)}€` : `Minimum garanti = 30€`}
                  </div>
                </div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'22px', fontWeight:700, color:'#D4820A' }}>{acompte}€</div>
              </div>
            )}
            {!acompteReq && (
              <div style={{ fontSize:'12px', color:'var(--txt3)', padding:'8px 0' }}>Aucun acompte — paiement intégral en studio</div>
            )}
          </div>
        )}

        {/* Durée de la séance */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Durée estimée de la séance</div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {[['60','1h'],['90','1h30'],['120','2h'],['150','2h30'],['180','3h'],['240','4h'],['360','6h'],['480','Journée']].map(([v,l]) => (
              <button key={v} onClick={() => setDuree(v)} style={S.pill(duree===v)}>{l}</button>
            ))}
          </div>
          {duree && (
            <div style={{ marginTop:'10px', fontSize:'12px', color:'var(--txt3)' }}>
              Le créneau client sera bloqué sur <strong style={{ color:'var(--txt)' }}>{parseInt(duree)/60 >= 1 ? Math.floor(parseInt(duree)/60)+'h'+(parseInt(duree)%60>0?parseInt(duree)%60:'') : parseInt(duree)+'min'}</strong> dans le planning
            </div>
          )}
        </div>

        {/* Notes + Sauvegarder */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Notes internes</div>
          <input style={{ ...S.input, marginBottom:'14px' }} placeholder="Notes, précisions…"
            value={clientNotes} onChange={e => setClientNotes(e.target.value)} />
          <button style={S.btnPrimary} onClick={saveDevis} disabled={saving || !clientName || tattoos.length===0}>
            {saving ? 'Enregistrement…' : '💾 Sauvegarder le devis'}
          </button>
        </div>

      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
