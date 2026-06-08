import React, { useState } from 'react'

const CHARGES_FIXES = [
  { label: 'Loyer HT (867€ TTC)', montant: 716.53, recurrence: '/mois' },
  { label: 'RETA Tony (tarifa plana)', montant: 88.72, recurrence: '/mois' },
  { label: 'RETA Amely (tarifa plana)', montant: 80.00, recurrence: '/mois' },
  { label: 'Matériel + consomm. (25% CA)', montant: 0, recurrence: '/mois', variable: true },
]

function CalculProv({ ca, amelyCA = 800 }) {
  const loyer_ht = 716.53
  const reta = 88.72 + 80
  const charges_var = ca * 0.25
  const charges_amely = 50
  
  // Tony
  const ben_tony = ca - loyer_ht - charges_var - 88.72
  const irpf_tony = ben_tony > 0 ? ben_tony * 0.20 : 0
  const net_tony = ben_tony - irpf_tony

  // Amely
  const ben_amely = amelyCA - charges_amely - 80
  const irpf_amely = ben_amely > 0 ? ben_amely * 0.20 : 0
  const net_amely = ben_amely - irpf_amely

  // IVA
  const iva_collecte = (ca + amelyCA) * 0.21
  const iva_recup = (loyer_ht * 0.21) + (charges_var * 0.21)
  const iva_net = iva_collecte - iva_recup

  return (
    <div>
      <div className="card" style={{ marginTop: '12px', marginBottom: '10px' }}>
        <div className="section-title">Tony — tatouage</div>
        {[
          { l: 'CA HT', v: `${ca}€`, c: 'var(--blanc)' },
          { l: 'Matériel 25%', v: `-${charges_var.toFixed(0)}€`, c: 'var(--gris)' },
          { l: 'Loyer HT', v: `-717€`, c: 'var(--gris)' },
          { l: 'RETA', v: `-89€`, c: 'var(--gris)' },
          { l: 'Bénéfice brut', v: `${ben_tony.toFixed(0)}€`, c: 'var(--pierre)' },
          { l: 'IRPF à réserver (20%)', v: `-${irpf_tony.toFixed(0)}€`, c: 'var(--jaune)' },
          { l: 'NET TONY', v: `${net_tony.toFixed(0)}€`, c: 'var(--vert)' },
        ].map(row => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: row.c }}>{row.v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '10px' }}>
        <div className="section-title">Amely — services</div>
        {[
          { l: `CA services HT`, v: `${amelyCA}€`, c: 'var(--blanc)' },
          { l: 'Charges outils', v: `-50€`, c: 'var(--gris)' },
          { l: 'RETA', v: `-80€`, c: 'var(--gris)' },
          { l: 'Bénéfice brut', v: `${ben_amely.toFixed(0)}€`, c: 'var(--pierre)' },
          { l: 'IRPF à réserver (20%)', v: `-${irpf_amely.toFixed(0)}€`, c: 'var(--jaune)' },
          { l: 'NET AMELY', v: `${net_amely.toFixed(0)}€`, c: 'var(--vert)' },
        ].map(row => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: row.c }}>{row.v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: 'var(--epine)', borderColor: 'var(--epine2)', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px' }}>Net couple</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--vert)' }}>{(net_tony + net_amely).toFixed(0)}€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>- Charges perso</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rouge)' }}>-1 500€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--epine2)' }}>
          <span style={{ fontWeight: 600 }}>DÉGAGEMENT</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--vert)', fontSize: '18px' }}>
            {(net_tony + net_amely - 1500).toFixed(0)}€
          </span>
        </div>
      </div>

      <div className="card">
        <div className="section-title">IVA à reverser (Modelo 303)</div>
        {[
          { l: `IVA collecté Tony (${ca}€ × 21%)`, v: `${(ca * 0.21).toFixed(0)}€` },
          { l: `IVA collecté Amely (${amelyCA}€ × 21%)`, v: `${(amelyCA * 0.21).toFixed(0)}€` },
          { l: 'IVA récupérable loyer + achats', v: `-${iva_recup.toFixed(0)}€` },
          { l: 'IVA net / mois', v: `${iva_net.toFixed(0)}€`, bold: true },
          { l: 'IVA trimestriel (Modelo 303)', v: `${(iva_net * 3).toFixed(0)}€`, bold: true },
        ].map(row => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: row.bold ? 'var(--rouge)' : 'var(--blanc)', fontWeight: row.bold ? 600 : 400 }}>{row.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caInput, setCaInput]   = useState('')
  const [amelyInput, setAmelyInput] = useState('800')
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>CA Tony (€ HT)</label>
              <input type="number" placeholder="5000" value={caInput} onChange={e => setCaInput(e.target.value)} style={{ fontSize: '18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>CA Amely (€ HT)</label>
              <input type="number" placeholder="800" value={amelyInput} onChange={e => setAmelyInput(e.target.value)} style={{ fontSize: '18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          {(caInput || amelyInput) && (
            <CalculProv ca={parseFloat(caInput) || 5000} amelyCA={parseFloat(amelyInput) || 800} />
          )}
          {!caInput && !amelyInput && (
            <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--gris)', fontSize: '13px' }}>
              Saisis le CA mensuel Tony pour calculer le P&L complet
            </div>
          )}
        </div>
      )}

      {activeTab === 'charges' && (
        <div>
          <div className="section-title">Charges fixes confirmées</div>
          {[
            { label: 'Loyer HT (867€ TTC)', montant: 716.53 },
            { label: 'IVA loyer récupérable', montant: 150.47, green: true },
            { label: 'RETA Tony (tarifa plana)', montant: 88.72 },
            { label: 'RETA Amely (tarifa plana)', montant: 80.00 },
            { label: 'Charges perso couple', montant: 1500 },
          ].map((c, i) => (
            <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '12px 16px' }}>
              <span style={{ fontSize: '13px' }}>{c.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: c.green ? 'var(--vert)' : 'var(--pierre)' }}>
                {c.green ? '+' : ''}{c.montant}€/mois
              </span>
            </div>
          ))}

          <div className="card" style={{ marginTop: '8px' }}>
            <div className="section-title">Break-even Tony</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              Seul : <strong style={{ color: 'var(--blanc)' }}>3 976€/mois = 159€/jour</strong><br />
              Avec Amely 800€ : <strong style={{ color: 'var(--vert)' }}>3 083€/mois = 123€/jour</strong><br />
              <span style={{ fontSize: '11px', color: 'var(--pierre)' }}>→ Les 800€ d'Amely = -36€/jour d'objectif pour Tony</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {[
            { m: 'T2 (avr-juin)', delai: '20 juillet', model: 'Modelo 303 + 130 Tony + 130 Amely' },
            { m: 'T3 (juil-sept)', delai: '20 octobre', model: 'Modelo 303 + 130 Tony + 130 Amely' },
            { m: 'T4 (oct-déc)', delai: '30 janvier 2027', model: 'Modelo 303 + 130 Tony + 130 Amely' },
          ].map((t, i) => (
            <div key={i} className="card" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.model}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '3px' }}>{t.m}</div>
                </div>
                <span className="tag tag-warn">{t.delai}</span>
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: '8px' }}>
            <div className="section-title">Loyer — détail IVA</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              TTC : <strong style={{ color: 'var(--blanc)' }}>867€</strong><br />
              HT déductible : <strong style={{ color: 'var(--pierre)' }}>716,53€</strong><br />
              IVA récupérable : <strong style={{ color: 'var(--vert)' }}>150,47€</strong>
            </div>
          </div>

          <div className="card" style={{ marginTop: '10px' }}>
            <div className="section-title">Provisions à réserver</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.9 }}>
              IRPF Tony (20%) : <strong style={{ color: 'var(--jaune)' }}>~589€/mois</strong><br />
              IRPF Amely (20%) : <strong style={{ color: 'var(--jaune)' }}>~134€/mois</strong><br />
              IVA net mensuel : <strong style={{ color: 'var(--rouge)' }}>~805€/mois</strong><br />
              <strong style={{ color: 'var(--pierre)' }}>TOTAL : ~1 528€/mois = 26% du CA</strong>
            </div>
          </div>

          <div className="card" style={{ marginTop: '10px' }}>
            <div className="section-title">Tarifa plana</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              Tony : ~89€/mois · Surveiller fin période avec gestor<br />
              Amely : ~80€/mois · Si récente, 12 mois garantis
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
