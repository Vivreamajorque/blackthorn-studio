import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const fmt = (n) => {
  if (!n && n !== 0) return '—'
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M'
  if (n >= 1000) return (n/1000).toFixed(1)+'k'
  return String(Math.round(n))
}

const PLATS = ['📸 Instagram', '👥 Facebook', '🖤 Blackthorn IG']
const todayStr = () => new Date().toISOString().split('T')[0]

export default function Communication() {
  const [metriques, setMetriques] = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('dashboard')
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState('')
  const [form, setForm]           = useState({
    plateforme: '🖤 Blackthorn IG', date: todayStr(),
    abonnes:'', abonnesDelta:'', impressions:'', reach:'',
    interactions:'', tauxEngagement:'', posts:'', avisGoogle:'', dms:'', rdvRS:'', notes:''
  })

  const showToast = (m) => { setToast(m); setTimeout(()=>setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await notion.getMetriquesRS()
      if (r.results) setMetriques(r.results)
    } catch(e) {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const saveMetrique = async () => {
    if (!form.plateforme || !form.date) return
    setSaving(true)
    try {
      await notion.addMetriqueRS(form)
      showToast('✓ Métriques enregistrées')
      setForm({ plateforme:'🖤 Blackthorn IG', date:todayStr(), abonnes:'', abonnesDelta:'', impressions:'', reach:'', interactions:'', tauxEngagement:'', posts:'', avisGoogle:'', dms:'', rdvRS:'', notes:'' })
      load()
    } catch(e) { showToast('Erreur — réessaie') }
    setSaving(false)
  }

  // Dernières métriques par plateforme
  const getLatest = (plat) => metriques.find(m => m.properties.Plateforme?.select?.name === plat)
  const getVal = (m, prop) => m?.properties[prop]?.number ?? null

  const TABS = [
    { id:'dashboard', l:'Dashboard' },
    { id:'saisie', l:'Saisir' },
    { id:'historique', l:'Historique' },
  ]

  return (
    <div style={{ padding:'0 0 96px', background:'var(--bg)', minHeight:'100dvh' }}>
      {/* Header sticky */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 16px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(26,18,9,.04)' }}>
        <div style={{ fontFamily:'var(--font-head)', fontSize:'16px', fontWeight:800, letterSpacing:'-.3px' }}>Communication</div>
        <button onClick={load} style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:'var(--txt3)', cursor:'pointer' }}>↻</button>
      </div>

      <div style={{ padding:'16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'18px', overflowX:'auto', paddingBottom:'2px' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flexShrink:0, padding:'8px 16px', borderRadius:'20px', fontSize:'12px', cursor:'pointer',
              background:tab===t.id?'var(--txt)':'var(--surface)',
              color:tab===t.id?'var(--bg)':'var(--txt2)',
              border:tab===t.id?'none':'1px solid var(--border2)',
              fontFamily:'var(--font-head)', fontWeight:700, transition:'all .2s',
              boxShadow:tab===t.id?'var(--shadow-sm)':'none'
            }}>{t.l}</button>
          ))}
        </div>

        {/* ── DASHBOARD ──────────────────────────────── */}
        {tab === 'dashboard' && (
          <div>
            <div className="section-title-gold" style={{ marginBottom:'12px' }}>Dernières métriques Blackthorn</div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--txt3)' }}>Chargement...</div>
            ) : (
              PLATS.map(plat => {
                const last = getLatest(plat)
                const abonnes    = getVal(last, 'Abonnés')
                const delta      = getVal(last, 'Abonnés +/-')
                const reach      = getVal(last, 'Reach')
                const engagement = getVal(last, 'Taux engagement')
                const rdv        = getVal(last, 'RDV pris via RS')
                const avis       = getVal(last, 'Avis Google')
                const dms        = getVal(last, 'DMs reçus')
                const date       = last?.properties.Date?.date?.start || null

                return (
                  <div key={plat} className="card" style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                      <div style={{ fontFamily:'var(--font-head)', fontSize:'14px', fontWeight:700 }}>{plat}</div>
                      <div style={{ fontSize:'10px', color:'var(--txt3)' }}>
                        {date ? new Date(date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : 'Aucune donnée'}
                      </div>
                    </div>

                    {!last ? (
                      <div style={{ fontSize:'12px', color:'var(--txt3)', textAlign:'center', padding:'12px 0' }}>
                        Pas encore de données — utilise "Saisir" pour commencer
                      </div>
                    ) : (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                          {[
                            { l:'Abonnés', v:fmt(abonnes), sub:delta!==null?(delta>0?`+${delta}`:`${delta}`):null, c:delta>0?'var(--green)':delta<0?'var(--red)':'var(--txt3)' },
                            { l:'Reach', v:fmt(reach), sub:null, c:'var(--txt)' },
                            { l:'Engagement', v:engagement!==null?`${(engagement*100).toFixed(1)}%`:'—', sub:null, c:engagement>=0.03?'var(--green)':engagement>=0.01?'var(--amber)':'var(--red)' },
                          ].map(x=>(
                            <div key={x.l} style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'8px', textAlign:'center' }}>
                              <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'3px' }}>{x.l}</div>
                              <div style={{ fontFamily:'var(--font-mono)', fontSize:'16px', fontWeight:500, color:x.c }}>{x.v}</div>
                              {x.sub && <div style={{ fontSize:'10px', color:x.c, marginTop:'1px' }}>{x.sub}</div>}
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
                          {[
                            { l:'RDV via RS', v:rdv!==null?rdv:'—', c:rdv>0?'var(--green)':'var(--txt3)' },
                            { l:'Avis Google', v:avis!==null?avis:'—', c:avis>0?'var(--gold-dk)':'var(--txt3)' },
                            { l:'DMs reçus', v:dms!==null?dms:'—', c:'var(--txt)' },
                          ].map(x=>(
                            <div key={x.l} style={{ background:'var(--bg)', borderRadius:'var(--r)', padding:'7px', textAlign:'center' }}>
                              <div style={{ fontSize:'9px', color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:'2px' }}>{x.l}</div>
                              <div style={{ fontFamily:'var(--font-mono)', fontSize:'15px', fontWeight:500, color:x.c }}>{x.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Liens rapides */}
            <div className="section-title-gold" style={{ margin:'20px 0 10px' }}>Accès rapides</div>
            {[
              { l:'Instagram Blackthorn', url:'https://www.instagram.com/blackthorntattoo_campos/', icon:'📸' },
              { l:'Facebook Blackthorn', url:'https://www.facebook.com/blackthorntattoo', icon:'👥' },
              { l:'Google Business', url:'https://business.google.com', icon:'⭐' },
            ].map(link=>(
              <a key={link.l} href={link.url} target="_blank" rel="noopener noreferrer" className="card" style={{
                display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px', padding:'12px 16px',
                textDecoration:'none', color:'var(--txt)', cursor:'pointer'
              }}>
                <span style={{ fontSize:'20px' }}>{link.icon}</span>
                <span style={{ fontSize:'13px', fontWeight:500, flex:1 }}>{link.l}</span>
                <span style={{ color:'var(--txt3)', fontSize:'14px' }}>↗</span>
              </a>
            ))}
          </div>
        )}

        {/* ── SAISIE MÉTRIQUES ──────────────────────── */}
        {tab === 'saisie' && (
          <div>
            <div className="section-title-gold" style={{ marginBottom:'12px' }}>Saisie hebdomadaire</div>

            <div className="form-group" style={{ marginBottom:'12px' }}>
              <label>Plateforme</label>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'4px' }}>
                {PLATS.map(p=>(
                  <button key={p} onClick={()=>setForm({...form,plateforme:p})} style={{
                    padding:'7px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                    background:form.plateforme===p?'var(--txt)':'var(--surface)',
                    color:form.plateforme===p?'var(--bg)':'var(--txt2)',
                    border:form.plateforme===p?'none':'1.5px solid var(--border2)'
                  }}>{p}</button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom:'16px' }}>
              <label>Date de relevé</label>
              <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
              {[
                {l:'Abonnés total',k:'abonnes',ph:'ex: 1250'},
                {l:'Évolution abonnés',k:'abonnesDelta',ph:'ex: +12 ou -3'},
                {l:'Impressions',k:'impressions',ph:'ex: 15000'},
                {l:'Reach',k:'reach',ph:'ex: 8500'},
                {l:'Interactions',k:'interactions',ph:'ex: 450'},
                {l:'Posts publiés',k:'posts',ph:'ex: 4'},
                {l:'DMs reçus',k:'dms',ph:'ex: 8'},
                {l:'RDV pris via RS',k:'rdvRS',ph:'ex: 2'},
                {l:'Avis Google reçus',k:'avisGoogle',ph:'ex: 1'},
              ].map(f=>(
                <div key={f.k} className="form-group" style={{ margin:0 }}>
                  <label>{f.l}</label>
                  <input type="number" inputMode="numeric" placeholder={f.ph}
                    value={form[f.k]} onChange={e=>setForm({...form,[f.k]:e.target.value})}
                    style={{ textAlign:'center' }}/>
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom:'16px' }}>
              <label>Taux d'engagement (%)</label>
              <input type="number" inputMode="decimal" step="0.1" placeholder="ex: 3.2"
                value={form.tauxEngagement} onChange={e=>setForm({...form,tauxEngagement:e.target.value})}
                style={{ textAlign:'center', fontSize:'18px' }}/>
            </div>

            <div className="form-group" style={{ marginBottom:'20px' }}>
              <label>Notes</label>
              <textarea rows="2" placeholder="Observations, post viral, campagne..." value={form.notes}
                onChange={e=>setForm({...form,notes:e.target.value})} style={{ resize:'none' }}/>
            </div>

            <button className="btn btn-gold" onClick={saveMetrique} disabled={saving} style={{ width:'100%', padding:'16px', fontSize:'15px' }}>
              {saving ? 'Enregistrement...' : '✓ Enregistrer les métriques'}
            </button>
          </div>
        )}

        {/* ── HISTORIQUE ─────────────────────────────── */}
        {tab === 'historique' && (
          <div>
            {loading ? (
              <div style={{ textAlign:'center', padding:'40px', color:'var(--txt3)' }}>Chargement...</div>
            ) : metriques.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:'30px', border:'1.5px dashed var(--border2)' }}>
                <div style={{ fontSize:'24px', marginBottom:'8px' }}>📊</div>
                <div style={{ fontSize:'13px', color:'var(--txt2)', fontWeight:600 }}>Aucune métrique enregistrée</div>
                <div style={{ fontSize:'11px', color:'var(--txt3)', marginTop:'4px' }}>Commence par l'onglet "Saisir"</div>
              </div>
            ) : (
              metriques.map(m => {
                const plat = m.properties.Plateforme?.select?.name || '?'
                const date = m.properties.Date?.date?.start || ''
                const ab = m.properties.Abonnés?.number
                const reach = m.properties.Reach?.number
                const rdv = m.properties['RDV pris via RS']?.number
                return (
                  <div key={m.id} className="card" style={{ marginBottom:'8px', padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'12px', fontWeight:600 }}>{plat}</span>
                      <span style={{ fontSize:'11px', color:'var(--txt3)' }}>{date ? new Date(date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'}) : '—'}</span>
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:'var(--txt2)', flexWrap:'wrap' }}>
                      {ab!=null&&<span>👥 {fmt(ab)}</span>}
                      {reach!=null&&<span>👁 {fmt(reach)}</span>}
                      {rdv!=null&&rdv>0&&<span style={{ color:'var(--green)', fontWeight:600 }}>📅 {rdv} RDV</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
