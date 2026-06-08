import React, { useState } from 'react'

const TRIMESTRES = ['T2 2026 (avr-juin)', 'T3 2026 (juil-sept)', 'T4 2026 (oct-déc)']

const CHARGES_FIXES = [
  { label: 'Loyer HT', montant: 991.74, recurrence: '/mois' },
  { label: 'RETA Tony (tarifa plana)', montant: 88.72, recurrence: '/mois' },
  { label: 'Matériel consommable', montant: 180, recurrence: '/mois' },
  { label: 'Residuos sanitarios', montant: 45, recurrence: '/mois' },
  { label: 'Assurance RC Pro', montant: 65, recurrence: '/mois' },
]

function CalculProv({ ca }) {
  const iva = (ca * 0.17).toFixed(2)
  const irpf = (ca * 0.20).toFixed(2)
  const total = (ca * 0.37).toFixed(2)
  const net = (ca - parseFloat(total)).toFixed(2)
  return (
    <div className="card" style={{ marginTop: '12px' }}>
      <div className="section-title">Provisions sur {ca}€</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          { l: 'IVA à reverser (17% net)', v: iva+'€', c: 'var(--rouge)' },
          { l: 'IRPF à reverser (20%)', v: irpf+'€', c: 'var(--jaune)' },
          { l: 'Total à mettre de côté', v: total+'€', c: 'var(--pierre)' },
          { l: 'Disponible net', v: net+'€', c: 'var(--vert)' },
        ].map(row => (
          <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '13px', color: 'var(--gris)' }}>{row.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: row.c }}>{row.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caInput, setCaInput] = useState('')
  const [activeTab, setActiveTab] = useState('provisions')

  const tabs = [
    { id: 'provisions', label: '% Provisions' },
    { id: 'charges', label: 'Charges' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'facturation', label: 'Facturation' },
  ]

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
        Comptabilité
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="btn" style={{
            padding: '8px 16px', flexShrink: 0, fontSize: '12px',
            background: activeTab === t.id ? 'var(--pierre)' : 'var(--noir2)',
            color: activeTab === t.id ? 'var(--noir)' : 'var(--gris)',
            border: activeTab === t.id ? 'none' : '1px solid var(--noir3)'
          }}>{t.label}</button>
        ))}
      </div>

      {/* PROVISIONS */}
      {activeTab === 'provisions' && (
        <div>
          <div className="section-title">Calculateur de provisions</div>
          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '12px', lineHeight: 1.5 }}>
              Sur chaque paiement reçu, mets de côté :<br />
              <strong style={{ color: 'var(--rouge)' }}>17% IVA net</strong> + <strong style={{ color: 'var(--jaune)' }}>20% IRPF</strong> = <strong style={{ color: 'var(--pierre)' }}>37% total</strong>
            </div>
            <div className="form-group">
              <label>CA encaissé (€)</label>
              <input type="number" placeholder="Ex: 280" value={caInput} onChange={e => setCaInput(e.target.value)} />
            </div>
          </div>
          {caInput && parseFloat(caInput) > 0 && <CalculProv ca={parseFloat(caInput)} />}

          <div className="card" style={{ marginTop: '16px' }}>
            <div className="section-title">Règle d'or</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.7 }}>
              Dès qu'un paiement arrive → vire <strong style={{ color: 'var(--pierre)' }}>37%</strong> sur ton compte provision.<br />
              Ne touche jamais à ce compte. C'est l'argent de Hacienda.
            </div>
          </div>
        </div>
      )}

      {/* CHARGES */}
      {activeTab === 'charges' && (
        <div>
          <div className="section-title">Charges fixes confirmées</div>
          {CHARGES_FIXES.map((c, i) => (
            <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '12px 16px' }}>
              <span style={{ fontSize: '13px' }}>{c.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pierre)' }}>
                {c.montant}€<span style={{ fontSize: '11px', color: 'var(--gris)' }}>{c.recurrence}</span>
              </span>
            </div>
          ))}
          <div className="card" style={{ marginTop: '12px', background: 'var(--epine)', borderColor: 'var(--epine2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>TOTAL mensuel</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pierre)' }}>
                {CHARGES_FIXES.reduce((a,c) => a+c.montant, 0).toFixed(2)}€
              </span>
            </div>
          </div>

          <div className="card" style={{ marginTop: '16px' }}>
            <div className="section-title">Break-even</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.7 }}>
              Charges studio : <strong style={{ color: 'var(--blanc)' }}>~1 370€/mois</strong><br />
              + Charges perso : <strong style={{ color: 'var(--blanc)' }}>2 000€/mois</strong><br />
              + Provisions 35% : <strong style={{ color: 'var(--blanc)' }}>~1 430€/mois</strong><br />
              <strong style={{ color: 'var(--pierre)', fontSize: '16px' }}>→ CA minimum : ~4 800€/mois</strong><br />
              <span style={{ color: 'var(--vert)' }}>= 4 sessions/semaine à 280€</span>
            </div>
          </div>
        </div>
      )}

      {/* FISCAL */}
      {activeTab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {[
            { periode: 'T2 (avr-juin)', delai: '20 juillet 2026', model: 'Modelo 303 + 130' },
            { periode: 'T3 (juil-sept)', delai: '20 octobre 2026', model: 'Modelo 303 + 130' },
            { periode: 'T4 (oct-déc)', delai: '30 janvier 2027', model: 'Modelo 303 + 130' },
          ].map((t, i) => (
            <div key={i} className="card" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.model}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '3px' }}>{t.periode}</div>
                </div>
                <span className="tag tag-warn">{t.delai}</span>
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: '16px' }}>
            <div className="section-title">Loyer — détail IVA</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              TTC : <strong style={{ color: 'var(--blanc)' }}>1 200€</strong><br />
              HT déductible : <strong style={{ color: 'var(--pierre)' }}>991,74€</strong><br />
              IVA récupérable : <strong style={{ color: 'var(--vert)' }}>208,26€</strong>
            </div>
          </div>

          <div className="card" style={{ marginTop: '12px' }}>
            <div className="section-title">Tarifa plana Tony</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              Montant : <strong style={{ color: 'var(--pierre)' }}>~89€/mois</strong> (80€ + MEI 0,9%)<br />
              ⚠️ Avec 30K€ en 6 mois → SMI dépassé → simuler avec gestor 3 mois avant fin.
            </div>
          </div>
        </div>
      )}

      {/* FACTURATION */}
      {activeTab === 'facturation' && (
        <div>
          <div className="section-title">Rappels facturation</div>
          <div className="card" style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Tatouage = prestation de service</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.7 }}>
              IVA applicable : <strong style={{ color: 'var(--blanc)' }}>21%</strong><br />
              Facturer en IVA inclus ou HT+IVA selon la demande client<br />
              Conserver TOUTES les factures fournisseurs (déduction IVA soportado)
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>COGS — coût par session</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.7 }}>
              Cartouches + consommables : <strong style={{ color: 'var(--pierre)' }}>~4-6€/session</strong><br />
              = moins de 3% du CA à 280€<br />
              <strong style={{ color: 'var(--vert)' }}>Marge brute : 97%</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
