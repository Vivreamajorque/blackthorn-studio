import React, { useState } from 'react'

// ── MODÈLE RÉEL ────────────────────────────────────────────
// Charges FIXES (dues même avec 0 CA) : loyer 867€ + RETA 89€ = 956€
// Charges VARIABLES (matériel) : ~8% du CA
// Bénéfice = CA - 956 - CA×0.08 = CA×0.92 - 956
// Net = Bénéfice × 0.80 (après IRPF 20%)
// Équilibre mensuel : 123€/j × 25j = 3 077€/mois
// Équilibre annuel (avec hiver) : 181€/j en été

const LOYER_TTC = 867
const RETA      = 89
const FIXES     = 956    // loyer + RETA
const MATOS     = 0.08   // 8% CA variable
const PERSO     = 1500
const PROV_MOIS = 1057

const fmt = n => `${Math.round(Math.abs(n))}€`
const fmtSign = n => (n >= 0 ? '+' : '-') + fmt(n)

function PLSimulateur({ ca }) {
  const fixes    = FIXES
  const matos    = Math.round(ca * MATOS)
  const charges  = fixes + matos
  const ben      = ca - charges
  const irpf     = Math.max(0, Math.round(ben * 0.20))
  const net      = Math.max(0, Math.round(ben * 0.80))
  const dispo    = net - PERSO
  const iva_col  = Math.round(ca * 0.21)
  const iva_net  = Math.max(0, Math.round(iva_col - charges * 0.21))

  const pct = Math.min(100, Math.round((ca / 3077) * 100))

  const statut =
    net >= PERSO + PROV_MOIS
      ? { t: `✅ Équilibre + réserve hiver — +${fmt(dispo - PROV_MOIS)} libre`, c: 'var(--vert)' }
      : net >= PERSO
      ? { t: `✅ Charges couvertes — +${fmt(dispo)} dispo (pas de réserve hiver)`, c: 'var(--jaune)' }
      : { t: `⚠️ Déficit — manque ${fmt(PERSO - net)} pour couvrir les charges`, c: 'var(--rouge)' }

  return (
    <div>
      <div style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:'14px', borderLeft:`3px solid ${statut.c}` }}>
        <div style={{ fontSize:'13px', color:statut.c, fontWeight:600 }}>{statut.t}</div>
      </div>

      <div style={{ marginBottom:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
          <span style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px' }}>vs équilibre mensuel (123€/j)</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--pierre)' }}>{pct}%</span>
        </div>
        <div style={{ height:'7px', background:'var(--noir3)', borderRadius:'4px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:net>=PERSO?'var(--vert)':pct>70?'var(--jaune)':'var(--rouge)', borderRadius:'4px', transition:'width .4s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'10px', color:'var(--gris2)' }}>
          <span>0€</span><span>Équilibre 3 077€</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom:'10px' }}>
        <div className="section-title">P&L mensuel</div>
        {[
          { l: `CA HT  (${Math.round(ca/25)}€/j × 25j)`, v: fmt(ca),         c: 'var(--vert)' },
          { l: 'Loyer TTC',                               v: `-${fmt(fixes-RETA)}€`, c: 'var(--gris)' },
          { l: 'RETA',                                    v: `-${RETA}€`,     c: 'var(--gris)' },
          { l: `Matériel ~8%`,                            v: `-${fmt(matos)}`,c: 'var(--gris)' },
          { l: 'Bénéfice brut',                           v: ben>0?fmt(ben):`-${fmt(Math.abs(ben))}`, c: ben>0?'var(--pierre)':'var(--rouge)' },
          { l: 'IRPF à réserver (20%)',                   v: `-${fmt(irpf)}`, c: 'var(--jaune)' },
          { l: 'Net disponible',                          v: fmt(net),        c: net>=PERSO?'var(--vert)':'var(--rouge)', bold:true },
          { l: 'Charges ménage',                          v: `-${PERSO}€`,    c: 'var(--gris)' },
          { l: 'Dispo libre',                             v: fmtSign(dispo),  c: dispo>=0?'var(--vert)':'var(--rouge)', bold:true },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.c, fontWeight:r.bold?700:400 }}>{r.v}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">IVA — Modelo 303</div>
        {[
          { l: `Collecté (${fmt(ca)} × 21%)`, v: fmt(iva_col) },
          { l: 'Nette à reverser',             v: fmt(iva_net), bold:true },
          { l: 'Trimestriel (× 3)',             v: fmt(iva_net*3), bold:true },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.bold?'var(--rouge)':'var(--blanc)', fontWeight:r.bold?700:400 }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caInput,   setCaInput]   = useState('')
  const [activeTab, setActiveTab] = useState('simulateur')

  return (
    <div style={{ padding:'24px 16px 8px' }}>
      <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700, marginBottom:'16px' }}>Comptabilité</div>

      {/* Les 3 seuils */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'20px' }}>
        {[
          { label:'Équilibre mensuel', val:'123€/j', sub:'charges + impôts', color:'var(--jaune)' },
          { label:'Tenir l\'hiver',    val:'181€/j', sub:'en été seulement', color:'var(--pierre)' },
          { label:'Confort',           val:'300€/j', sub:'surplus + réserve', color:'var(--vert)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--noir2)', border:`1px solid ${s.color}33`, borderRadius:'var(--r)', padding:'10px 8px', textAlign:'center' }}>
            <div style={{ fontSize:'9px', color:'var(--gris)', textTransform:'uppercase', marginBottom:'4px', lineHeight:1.3 }}>{s.label}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'17px', color:s.color, fontWeight:500 }}>{s.val}</div>
            <div style={{ fontSize:'9px', color:'var(--gris2)', marginTop:'3px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        {['simulateur','charges','fiscal'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex:1, padding:'9px', borderRadius:'var(--r)', fontSize:'11px',
            background:activeTab===t?'var(--pierre)':'var(--noir2)',
            color:activeTab===t?'var(--noir)':'var(--gris)',
            border:activeTab===t?'none':'1px solid var(--noir3)',
            fontFamily:'var(--font-head)', fontWeight:600, cursor:'pointer',
            textTransform:'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {activeTab === 'simulateur' && (
        <div>
          <div className="form-group">
            <label>CA Tony ce mois (€ HT)</label>
            <input type="number" placeholder="3077" value={caInput}
              onChange={e => setCaInput(e.target.value)}
              style={{ fontSize:'22px', textAlign:'center', fontFamily:'var(--font-mono)' }} />
          </div>
          <PLSimulateur ca={parseFloat(caInput) || 3077} />
        </div>
      )}

      {activeTab === 'charges' && (
        <div>
          <div className="section-title">Structure des charges</div>
          <div className="card" style={{ marginBottom:'12px' }}>
            <div style={{ fontSize:'12px', color:'var(--gris)', lineHeight:1.8 }}>
              <strong style={{ color:'var(--rouge)' }}>Fixes (dues même avec 0 CA) :</strong><br/>
              Loyer TTC 867€ + RETA 89€ = <strong style={{ color:'var(--pierre)' }}>956€/mois incompressibles</strong><br/><br/>
              <strong style={{ color:'var(--gris)' }}>Variables (matériel ~8% CA) :</strong><br/>
              Cartouches, encres, gants, consommables
            </div>
          </div>
          <div className="card">
            <div className="section-title">Net selon le panier quotidien</div>
            {[100, 123, 150, 181, 200, 250, 300, 350].map(pm => {
              const ca   = pm * 25
              const ben  = ca - FIXES - ca * MATOS
              const net  = Math.max(0, ben) * 0.80
              const disp = net - PERSO
              const icon = disp >= PROV_MOIS ? '✅' : disp >= 0 ? '🟡' : '🔴'
              return (
                <div key={pm} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--noir3)', alignItems:'center' }}>
                  <div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px' }}>{pm}€/j</span>
                    {pm===123 && <span style={{ fontSize:'10px', color:'var(--jaune)', marginLeft:'6px' }}>équilibre</span>}
                    {pm===181 && <span style={{ fontSize:'10px', color:'var(--pierre)', marginLeft:'6px' }}>+ hiver</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:disp>=0?'var(--vert)':'var(--rouge)' }}>
                      {disp>=0?'+':''}{Math.round(disp)}€
                    </span>
                    <span>{icon}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {[
            { p:'T2 (avr-juin)', d:'20 juillet' },
            { p:'T3 (juil-sept)', d:'20 octobre' },
            { p:'T4 (oct-déc)', d:'30 janv. 2027' },
          ].map((t,i) => (
            <div key={i} className="card" style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600 }}>Modelo 303 + 130</div>
                <div style={{ fontSize:'11px', color:'var(--gris)', marginTop:'2px' }}>{t.p}</div>
              </div>
              <span className="tag tag-warn">{t.d}</span>
            </div>
          ))}
          <div className="card" style={{ marginTop:'8px' }}>
            <div className="section-title">Hiver (déc + jan = 0 CA)</div>
            <div style={{ fontSize:'13px', color:'var(--gris)', lineHeight:1.9 }}>
              Toujours dû : loyer 867€ + RETA 89€ + ménage 1 500€<br/>
              = <strong style={{ color:'var(--rouge)' }}>2 456€/mois × 2 = 4 912€</strong><br/>
              Réserve totale à constituer : <strong style={{ color:'var(--pierre)' }}>5 285€</strong><br/>
              Mettre de côté en été : <strong style={{ color:'var(--pierre)' }}>1 057€/mois (juin→oct)</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
