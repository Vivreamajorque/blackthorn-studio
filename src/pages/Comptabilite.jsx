import React, { useState } from 'react'

// Modèle : charges = 25% CA tout compris (loyer + RETA + matériel)
// Bénéfice = CA × 75% · Net = Bénéfice × 80% · IRPF = Bénéfice × 20%
const PERSO    = 1500
const OBJ_JOUR = 100   // CA × 0.60 = 1500 → 2500€/mois

const fmt = n => `${Math.round(Math.abs(n))}€`

function PLSimulateur({ ca }) {
  const charges = Math.round(ca * 0.25)
  const ben     = Math.round(ca * 0.75)
  const irpf    = Math.round(ben * 0.20)
  const net     = Math.round(ben * 0.80)
  const surplus = net - PERSO
  const iva_col = Math.round(ca * 0.21)
  const iva_net = Math.round(iva_col * 0.25)   // ~5% CA net
  const pct     = Math.min(100, Math.round((ca / (OBJ_JOUR * 25)) * 100))

  const statut = net >= PERSO
    ? { label: net > PERSO ? `✅ Équilibre — +${fmt(surplus)} disponible` : '✅ Charges couvertes pile', color: 'var(--vert)' }
    : { label: `⚠️ Manque ${fmt(PERSO - net)} pour couvrir les charges`, color: 'var(--rouge)' }

  return (
    <div>
      <div style={{ background:'var(--noir3)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:'14px', borderLeft:`3px solid ${statut.color}` }}>
        <div style={{ fontSize:'13px', color:statut.color, fontWeight:600 }}>{statut.label}</div>
      </div>

      {/* Barre équilibre */}
      <div style={{ marginBottom:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
          <span style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px' }}>vs équilibre (100€/j)</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--pierre)' }}>{pct}%</span>
        </div>
        <div style={{ height:'7px', background:'var(--noir3)', borderRadius:'4px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:net>=PERSO?'var(--vert)':pct>70?'var(--jaune)':'var(--rouge)', borderRadius:'4px', transition:'width .4s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px', fontSize:'10px', color:'var(--gris2)' }}>
          <span>0€</span>
          <span>Équilibre 2 500€</span>
        </div>
      </div>

      {/* P&L */}
      <div className="card" style={{ marginBottom:'10px' }}>
        <div className="section-title">P&L mensuel</div>
        {[
          { l:`CA HT (${Math.round(ca/25)}€/j × 25j)`,   v:`${fmt(ca)}`,      c:'var(--vert)' },
          { l:'Charges 25% (loyer+RETA+matériel)',         v:`-${fmt(charges)}`,c:'var(--gris)' },
          { l:'Bénéfice brut',                             v:fmt(ben),          c:'var(--pierre)' },
          { l:'IRPF à réserver (20%)',                     v:`-${fmt(irpf)}`,   c:'var(--jaune)' },
          { l:'Net disponible',                            v:fmt(net),          c:net>=PERSO?'var(--vert)':'var(--rouge)', bold:true },
          { l:'Charges ménage',                            v:`-${PERSO}€`,      c:'var(--gris)' },
          { l:'Dispo libre',                               v:(surplus>=0?'+':'')+fmt(Math.abs(surplus)), c:surplus>=0?'var(--vert)':'var(--rouge)', bold:true },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.c, fontWeight:r.bold?700:400 }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* IVA */}
      <div className="card">
        <div className="section-title">IVA — Modelo 303</div>
        {[
          { l:`IVA collecté (${fmt(ca)} × 21%)`, v:`${fmt(iva_col)}` },
          { l:'IVA nette à reverser (~5% CA)',    v:`${fmt(iva_net)}`, bold:true },
          { l:'Trimestriel (× 3)',                v:`${fmt(iva_net*3)}`, bold:true },
        ].map(r => (
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--noir3)' }}>
            <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.bold?'var(--rouge)':'var(--blanc)', fontWeight:r.bold?700:400 }}>{r.v}</span>
          </div>
        ))}
        <div style={{ fontSize:'11px', color:'var(--gris2)', marginTop:'8px' }}>
          Mettre de côté {fmt(iva_net)}/mois dès l'encaissement.
        </div>
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caInput,  setCaInput]  = useState('')
  const [activeTab, setActiveTab] = useState('simulateur')

  const tabs = [
    { id:'simulateur', label:'Simulateur' },
    { id:'charges',    label:'Charges' },
    { id:'fiscal',     label:'Fiscal' },
  ]

  return (
    <div style={{ padding:'24px 16px 8px' }}>
      <div style={{ fontFamily:'var(--font-head)', fontSize:'18px', fontWeight:700, marginBottom:'16px' }}>Comptabilité</div>

      {/* Point équilibre */}
      <div className="card" style={{ marginBottom:'20px', borderColor:'var(--pierre3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'11px', color:'var(--gris)', textTransform:'uppercase', letterSpacing:'1px' }}>Équilibre</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'24px', color:'var(--pierre)', marginTop:'2px' }}>100€/jour</div>
          </div>
          <div style={{ textAlign:'right', fontSize:'11px', color:'var(--gris)' }}>
            <div>2 500€ CA/mois</div>
            <div style={{ marginTop:'2px' }}>Charges couvertes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex:1, padding:'9px', borderRadius:'var(--r)', fontSize:'11px',
            background:activeTab===t.id?'var(--pierre)':'var(--noir2)',
            color:activeTab===t.id?'var(--noir)':'var(--gris)',
            border:activeTab===t.id?'none':'1px solid var(--noir3)',
            fontFamily:'var(--font-head)', fontWeight:600, cursor:'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      {/* SIMULATEUR */}
      {activeTab === 'simulateur' && (
        <div>
          <div className="form-group">
            <label>CA Tony ce mois (€ HT)</label>
            <input type="number" placeholder="2500" value={caInput}
              onChange={e => setCaInput(e.target.value)}
              style={{ fontSize:'22px', textAlign:'center', fontFamily:'var(--font-mono)' }} />
          </div>
          <PLSimulateur ca={parseFloat(caInput) || 2500} />
        </div>
      )}

      {/* CHARGES */}
      {activeTab === 'charges' && (
        <div>
          <div className="section-title">Charges mensuelles</div>
          <div className="card" style={{ marginBottom:'10px' }}>
            <div style={{ fontSize:'12px', color:'var(--gris)', lineHeight:1.8 }}>
              Les charges sont calculées à <strong style={{ color:'var(--pierre)' }}>25% du CA</strong> — tout compris :<br/>
              loyer TTC (867€), RETA (89€), matériel et consommables.
            </div>
          </div>
          {[
            { l:'Loyer TTC studio', v:'867€' },
            { l:'RETA Tony (tarifa plana)', v:'~89€' },
            { l:'Matériel consommable', v:'~variable' },
            { l:'Total 25% sur 2 500€ CA', v:'625€', note:'équilibre' },
            { l:'Total 25% sur 5 000€ CA', v:'1 250€', note:'objectif été' },
            { l:'Total 25% sur 7 500€ CA', v:'1 875€', note:'haute saison' },
          ].map((r,i) => (
            <div key={i} className="card" style={{ marginBottom:'8px', display:'flex', justifyContent:'space-between', padding:'12px 16px', alignItems:'center' }}>
              <span style={{ fontSize:'13px' }}>{r.l}</span>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:'var(--pierre)' }}>{r.v}</span>
                {r.note && <div style={{ fontSize:'10px', color:'var(--gris)' }}>{r.note}</div>}
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop:'8px' }}>
            <div className="section-title">Projections nettes</div>
            {[100,150,200,250,300,350,400].map(pm => {
              const ca   = pm * 25
              const net  = Math.round(ca * 0.75 * 0.80)
              const dispo = net - PERSO
              const ok   = dispo >= 0
              return (
                <div key={pm} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)', alignItems:'center' }}>
                  <div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'14px' }}>{pm}€/j</span>
                    {pm === 100 && <span style={{ fontSize:'10px', color:'var(--pierre)', marginLeft:'8px' }}>← équilibre</span>}
                  </div>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:ok?'var(--vert)':'var(--rouge)' }}>
                    {dispo>=0?'+':''}{Math.round(dispo)}€ dispo
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FISCAL */}
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

          <div className="card" style={{ marginTop:'8px', marginBottom:'10px' }}>
            <div className="section-title">Provisions / mois (sur 5 000€ CA)</div>
            {[
              { l:'IRPF (20% × 3 750€)', v:'750€', c:'var(--jaune)' },
              { l:'IVA nette (~5% CA)', v:'~250€', c:'var(--jaune)' },
              { l:'Réserve hiver (été uniquement)', v:'1 057€', c:'var(--pierre)' },
            ].map(r => (
              <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--noir3)' }}>
                <span style={{ fontSize:'12px', color:'var(--gris)' }}>{r.l}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'13px', color:r.c }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-title">Charges incompressibles hiver</div>
            <div style={{ fontSize:'13px', color:'var(--gris)', lineHeight:1.8 }}>
              Déc + Jan (0 CA) : loyer 867€ + RETA 89€ + ménage 1 500€<br/>
              = <strong style={{ color:'var(--rouge)' }}>2 456€/mois à sortir de la réserve</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
