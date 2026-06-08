import React, { useState } from 'react'

function CalculProv({ caTony = 5000, amelyBilling = 800 }) {
  const LOYER_HT    = 716.53
  const RETA_TONY   = 88.72
  const RETA_AMELY  = 80.00
  const CHARGES_VAR = caTony * 0.25
  const CHARGES_OBJ = 50
  const PERSO       = 1500

  // Tony (déduit facture Amely)
  const benTony  = caTony - CHARGES_VAR - LOYER_HT - RETA_TONY - amelyBilling
  const irpfTony = Math.max(0, benTony) * 0.20
  const netTony  = benTony - irpfTony

  // Amely
  const benAmely  = amelyBilling - CHARGES_OBJ - RETA_AMELY
  const irpfAmely = Math.max(0, benAmely) * 0.20
  const netAmely  = benAmely - irpfAmely

  // Couple
  const netCouple = netTony + netAmely
  const dispo     = netCouple - PERSO

  // IVA Tony
  const ivaCollecte = caTony * 0.21
  const ivaRecup    = LOYER_HT * 0.21 + CHARGES_VAR * 0.21 + amelyBilling * 0.21
  const ivaTonyNet  = ivaCollecte - ivaRecup

  const fmt = (n) => `${Math.round(n)}€`

  return (
    <div>
      {/* Tony */}
      <div className="card" style={{ marginBottom: '10px' }}>
        <div className="section-title">🖤 Tony — tatouage</div>
        {[
          { l: `CA HT (${Math.round(caTony/25)}€ × 25j)`, v: fmt(caTony), c: 'var(--blanc)' },
          { l: 'Matériel/charges 25%', v: `-${fmt(CHARGES_VAR)}`, c: 'var(--gris)' },
          { l: 'Loyer HT', v: `-717€`, c: 'var(--gris)' },
          { l: 'RETA', v: `-89€`, c: 'var(--gris)' },
          { l: `Facture Amely (déductible)`, v: `-${amelyBilling}€`, c: '#5DADE2' },
          { l: 'Bénéfice brut', v: fmt(benTony), c: 'var(--pierre)' },
          { l: 'IRPF 20%', v: `-${fmt(irpfTony)}`, c: 'var(--jaune)' },
          { l: 'NET TONY', v: fmt(netTony), c: 'var(--vert)', bold: true },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: r.c, fontWeight: r.bold ? 700 : 400 }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Amely */}
      <div className="card" style={{ marginBottom: '10px' }}>
        <div className="section-title">🌿 Amely — services (autónoma VAM)</div>
        {[
          { l: `CA facturé à Tony HT`, v: `+${amelyBilling}€`, c: '#5DADE2' },
          { l: 'Charges outils/tel', v: `-50€`, c: 'var(--gris)' },
          { l: 'RETA (déjà payée)', v: `-80€`, c: 'var(--gris)' },
          { l: 'Bénéfice brut', v: fmt(benAmely), c: 'var(--pierre)' },
          { l: 'IRPF 20%', v: `-${fmt(irpfAmely)}`, c: 'var(--jaune)' },
          { l: 'NET AMELY', v: fmt(netAmely), c: 'var(--vert)', bold: true },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: r.c, fontWeight: r.bold ? 700 : 400 }}>{r.v}</span>
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--gris2)', marginTop: '8px', lineHeight: 1.5 }}>
          💡 Ce revenu s'ajoute à son CA VAM/La Ligne sur la même autónoma.
        </div>
      </div>

      {/* Couple */}
      <div className="card" style={{ background: 'var(--epine)', borderColor: 'var(--epine2)', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px' }}>Net Tony + Net Amely</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--blanc)' }}>{fmt(netCouple)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>- Charges perso</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rouge)' }}>-1 500€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--epine2)' }}>
          <span style={{ fontWeight: 600 }}>DÉGAGEMENT</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: dispo >= 500 ? 'var(--vert)' : dispo >= 0 ? 'var(--jaune)' : 'var(--rouge)', fontSize: '20px' }}>
            {dispo >= 0 ? '+' : ''}{fmt(dispo)}
          </span>
        </div>
        {dispo < 200 && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--rouge)', background: 'rgba(192,57,43,.15)', padding: '8px', borderRadius: 'var(--r)' }}>
            ⚠️ Panier moyen insuffisant — monter à 200€+ impératif
          </div>
        )}
      </div>

      {/* IVA */}
      <div className="card" style={{ marginBottom: '10px' }}>
        <div className="section-title">IVA — Billing interne neutre</div>
        <div style={{ fontSize: '12px', color: 'var(--gris)', lineHeight: 1.7 }}>
          Amely émet : <strong style={{ color: 'var(--blanc)' }}>{amelyBilling}€ HT + {Math.round(amelyBilling*0.21)}€ TVA = {Math.round(amelyBilling*1.21)}€ TTC</strong><br />
          Tony récupère les {Math.round(amelyBilling*0.21)}€ IVA → coût réel : {amelyBilling}€ HT<br />
          Amely reverse les {Math.round(amelyBilling*0.21)}€ à Hacienda<br />
          <strong style={{ color: 'var(--vert)' }}>Net IVA couple : NEUTRE ✓</strong>
        </div>
        <hr className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>IVA net Tony/mois</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rouge)' }}>{fmt(ivaTonyNet)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>Modelo 303 trimestriel</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rouge)', fontWeight: 700 }}>{fmt(ivaTonyNet * 3)}</span>
        </div>
      </div>

      {/* Projections */}
      <div className="card">
        <div className="section-title">Projections selon panier moyen</div>
        {[150, 200, 250, 300].map(pm => {
          const cat   = pm * 25
          const bt    = cat - cat*0.25 - LOYER_HT - RETA_TONY - amelyBilling
          const nt    = bt * 0.80
          const nc    = nt + netAmely
          const d     = nc - PERSO
          const ok    = d >= 500
          const warn  = d >= 0 && d < 500
          return (
            <div key={pm} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--noir3)', alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{pm}€/j</span>
                <span style={{ fontSize: '11px', color: 'var(--gris)', marginLeft: '8px' }}>{cat}€ CA</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: ok ? 'var(--vert)' : warn ? 'var(--jaune)' : 'var(--rouge)' }}>
                  {d >= 0 ? '+' : ''}{fmt(d)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--gris)' }}>dégagement</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caTony,    setCaTony]    = useState('')
  const [billing,   setBilling]   = useState('800')
  const [activeTab, setActiveTab] = useState('simulateur')

  const tabs = [
    { id: 'simulateur', label: 'Simulateur' },
    { id: 'charges',    label: 'Charges' },
    { id: 'fiscal',     label: 'Fiscal' },
  ]

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Comptabilité</div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: '9px', borderRadius: 'var(--r)', fontSize: '11px',
            background: activeTab === t.id ? 'var(--pierre)' : 'var(--noir2)',
            color: activeTab === t.id ? 'var(--noir)' : 'var(--gris)',
            border: activeTab === t.id ? 'none' : '1px solid var(--noir3)',
            fontFamily: 'var(--font-head)', fontWeight: 600, cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'simulateur' && (
        <div>
          <div className="section-title">Simulateur P&L</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>CA Tony HT/mois (€)</label>
              <input type="number" placeholder="5000" value={caTony} onChange={e => setCaTony(e.target.value)} style={{ fontSize: '18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Billing Amely → Tony</label>
              <input type="number" placeholder="800" value={billing} onChange={e => setBilling(e.target.value)} style={{ fontSize: '18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          <CalculProv caTony={parseFloat(caTony) || 5000} amelyBilling={parseFloat(billing) || 800} />
        </div>
      )}

      {activeTab === 'charges' && (
        <div>
          <div className="section-title">Charges confirmées</div>
          {[
            { l: 'Loyer HT (867€ TTC)', v: '716,53€/mois' },
            { l: 'IVA loyer récupérable', v: '150,47€/mois', green: true },
            { l: 'RETA Tony (tarifa plana)', v: '~89€/mois' },
            { l: 'RETA Amely (tarifa plana)', v: '~80€/mois' },
            { l: 'Matériel tattoo variable', v: '25% du CA Tony' },
            { l: 'Charges perso couple', v: '1 500€/mois' },
          ].map((c, i) => (
            <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '12px 16px' }}>
              <span style={{ fontSize: '13px' }}>{c.l}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: c.green ? 'var(--vert)' : 'var(--pierre)' }}>{c.v}</span>
            </div>
          ))}
          <div className="card" style={{ marginTop: '4px' }}>
            <div className="section-title">Break-even Tony (avec billing 800€ Amely)</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              CA minimum : <strong style={{ color: 'var(--blanc)' }}>3 976€/mois = 159€/jour</strong><br />
              <span style={{ fontSize: '11px', color: 'var(--pierre)' }}>1 session à 150€ + quelques petites pièces = objectif tenu</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {['T2 (avr-juin) — 20 juillet', 'T3 (juil-sept) — 20 octobre', 'T4 (oct-déc) — 30 janvier 2027'].map((t, i) => (
            <div key={i} className="card" style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--gris)' }}>Modelo 303 Tony + 130 Tony + 130 Amely</div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>{t}</div>
            </div>
          ))}
          <div className="card" style={{ marginTop: '8px' }}>
            <div className="section-title">Provisions mensuelles</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.9 }}>
              IRPF Tony (20%) : <strong style={{ color: 'var(--jaune)' }}>~429€/mois</strong><br />
              IRPF Amely (20%) : <strong style={{ color: 'var(--jaune)' }}>~134€/mois</strong><br />
              IVA net Tony : <strong style={{ color: 'var(--rouge)' }}>~469€/mois → 1 407€/trimestre</strong><br />
              IVA Amely (800€) : <strong style={{ color: 'var(--gris2)' }}>168€ collecté = 168€ reversé (neutre)</strong><br />
              <strong style={{ color: 'var(--pierre)' }}>TOTAL PROVISIONS : ~1 032€/mois (~18% du CA)</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
