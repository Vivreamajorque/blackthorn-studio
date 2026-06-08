import React, { useState } from 'react'

// ── CONSTANTES ─────────────────────────────────────────
const LOYER_HT = 716.53
const RETA     = 89.00
const PERSO    = 1500    // compte joint mensuel

// CA minimum pour l'équilibre :
// (CA × 0.75 - loyer - reta) × 0.80 = 1500 + 500 + 500 = 2500
// CA = (3125 + 806) / 0.75 = 5241 → ~210€/j × 25j
const OBJ_EQUILIBRE = 3575
const OBJ_JOUR = 143

function PLSimulateur({ ca }) {
  const ben  = ca * 0.75 - LOYER_HT - RETA
  const net  = Math.max(0, ben) * 0.80
  const irpf = Math.max(0, ben) * 0.20

  const joint_ok   = net >= PERSO
  const joint_amount  = Math.min(net, PERSO)

  // IVA
  const iva_col  = ca * 0.21
  const iva_rec  = LOYER_HT * 0.21 + ca * 0.25 * 0.21
  const iva_net  = iva_col - iva_rec

  const fmt = n => `${Math.round(n)}€`
  const pct = Math.min(100, (ca / OBJ_EQUILIBRE) * 100)

  const statut = joint_ok
    ? { label: net > PERSO ? `✅ Équilibre — ${Math.round(net - PERSO)}€ de surplus disponible` : '✅ Charges couvertes', color: 'var(--vert)' }
    : { label: `⚠️ Manque ${Math.round(PERSO - net)}€ pour couvrir les charges`, color: 'var(--rouge)' }

  return (
    <div>
      {/* Statut */}
      <div style={{ background: 'var(--noir3)', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: '16px', borderLeft: `3px solid ${statut.color}` }}>
        <div style={{ fontSize: '13px', color: statut.color, fontWeight: 600 }}>{statut.label}</div>
      </div>

      {/* Jauge équilibre */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>Progression vers l'équilibre</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--pierre)' }}>{pct.toFixed(0)}%</span>
        </div>
        <div style={{ height: '8px', background: 'var(--noir3)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct > 70 ? 'var(--jaune)' : 'var(--rouge)', borderRadius: '4px', transition: 'width .4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--gris)' }}>0€</span>
          <span style={{ fontSize: '10px', color: 'var(--pierre)' }}>Équilibre {fmt(OBJ_EQUILIBRE)}</span>
        </div>
      </div>

      {/* P&L */}
      <div className="card" style={{ marginBottom: '10px' }}>
        <div className="section-title">🖤 Tony — P&L mensuel</div>
        {[
          { l: `CA HT (${Math.round(ca/25)}€/j × 25j)`, v: fmt(ca), c: 'var(--blanc)' },
          { l: 'Matériel/charges 25%', v: `-${fmt(ca*0.25)}`, c: 'var(--gris)' },
          { l: 'Loyer HT', v: `-717€`, c: 'var(--gris)' },
          { l: 'RETA', v: `-89€`, c: 'var(--gris)' },
          { l: 'Bénéfice brut', v: fmt(ben), c: 'var(--pierre)' },
          { l: 'IRPF à réserver (20%)', v: `-${fmt(irpf)}`, c: 'var(--jaune)' },
          { l: 'NET DISPONIBLE', v: fmt(net), c: 'var(--vert)', bold: true },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: r.c, fontWeight: r.bold ? 700 : 400 }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Répartition simple */}
      <div className="card" style={{ marginBottom: '10px', borderColor: joint_ok ? 'var(--epine2)' : 'var(--gris2)', background: joint_ok ? 'var(--epine)' : 'var(--noir2)' }}>
        <div className="section-title">Répartition du net</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <span style={{ fontSize: '12px' }}>🏠 Compte joint (ménage)</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: joint_ok ? 'var(--vert)' : 'var(--rouge)' }}>{fmt(joint_amount)}</span>
        </div>
        {net > PERSO && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--pierre)' }}>💰 Disponible (épargne / pockets)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--pierre)', fontWeight: 700 }}>{fmt(net - PERSO)}</span>
          </div>
        )}
      </div>

      {/* IVA */}
      <div className="card">
        <div className="section-title">IVA — Modelo 303</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--noir3)' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>IVA net mensuel</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--rouge)' }}>{fmt(iva_net)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: '12px', color: 'var(--gris)' }}>Modelo 303 trimestriel</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--rouge)', fontWeight: 700 }}>{fmt(iva_net * 3)}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--gris2)', marginTop: '6px' }}>
          Mettre {fmt(iva_net)}/mois de côté dès l'encaissement.
        </div>
      </div>
    </div>
  )
}

export default function Comptabilite() {
  const [caInput, setCaInput] = useState('')
  const [tab, setTab]         = useState('simulateur')

  const tabs = [
    { id: 'simulateur', label: 'Simulateur' },
    { id: 'charges',    label: 'Charges' },
    { id: 'fiscal',     label: 'Fiscal' },
  ]

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Comptabilité</div>

      {/* Equilibre rapide */}
      <div className="card" style={{ marginBottom: '20px', borderColor: 'var(--pierre3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px' }}>Point d'équilibre</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--pierre)', marginTop: '2px' }}>143€/jour</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--gris)' }}>= 3 575€ CA/mois</div>
            <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>Charges couvertes — surplus à décider</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px', borderRadius: 'var(--r)', fontSize: '11px',
            background: tab === t.id ? 'var(--pierre)' : 'var(--noir2)',
            color: tab === t.id ? 'var(--noir)' : 'var(--gris)',
            border: tab === t.id ? 'none' : '1px solid var(--noir3)',
            fontFamily: 'var(--font-head)', fontWeight: 600, cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'simulateur' && (
        <div>
          <div className="form-group">
            <label>CA Tony ce mois (€ HT) — ou 143 × 25 = 3 575€</label>
            <input type="number" placeholder="3575" value={caInput} onChange={e => setCaInput(e.target.value)} style={{ fontSize: '22px', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
          </div>
          <PLSimulateur ca={parseFloat(caInput) || 5250} />
        </div>
      )}

      {tab === 'charges' && (
        <div>
          <div className="section-title">Charges fixes confirmées</div>
          {[
            { l: 'Loyer TTC (studio)', v: '867€/mois' },
            { l: 'Loyer HT déductible', v: '716,53€', green: true },
            { l: 'IVA récupérable', v: '150,47€', green: true },
            { l: 'RETA Tony (tarifa plana)', v: '~89€/mois' },
            { l: 'Matériel variable', v: '25% du CA' },
            { l: 'Charges perso ménage', v: '1 500€/mois' },
          ].map((c, i) => (
            <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '12px 16px' }}>
              <span style={{ fontSize: '13px' }}>{c.l}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: c.green ? 'var(--vert)' : 'var(--pierre)' }}>{c.v}</span>
            </div>
          ))}
          <div className="card" style={{ marginTop: '4px', borderColor: 'var(--pierre3)' }}>
            <div className="section-title">Projections panier moyen</div>
            {[157, 210, 250, 300, 350, 400].map(pm => {
              const ca   = pm * 25
              const net  = Math.max(0, ca * 0.75 - LOYER_HT - RETA) * 0.80
              const ok   = net >= PERSO + PERSO
              const surplus = Math.max(0, net - PERSO - PERSO)
              return (
                <div key={pm} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{pm}€/j</span>
                    {pm === 210 && <span style={{ fontSize: '10px', color: 'var(--pierre)', marginLeft: '8px' }}>← ÉQUILIBRE</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: ok ? 'var(--vert)' : 'var(--rouge)' }}>
                      {ok ? `+${Math.round(net - PERSO)}€ dispo` : `${Math.round(net)}€ net`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'fiscal' && (
        <div>
          <div className="section-title">Échéances 2026</div>
          {[
            { p: 'T2 (avr-juin)', d: '20 juillet' },
            { p: 'T3 (juil-sept)', d: '20 octobre' },
            { p: 'T4 (oct-déc)', d: '30 janv. 2027' },
          ].map((t, i) => (
            <div key={i} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Modelo 303 + 130</div>
                <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>{t.p}</div>
              </div>
              <span className="tag tag-warn">{t.d}</span>
            </div>
          ))}
          <div className="card" style={{ marginTop: '8px' }}>
            <div className="section-title">Provisions mensuelles</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.9 }}>
              IRPF Tony (20% bénéfice)<br />
              IVA net : ~469€/mois → <strong style={{ color: 'var(--rouge)' }}>1 407€/trimestre</strong><br />
              <strong style={{ color: 'var(--pierre)' }}>Règle : 26% de chaque encaissement de côté</strong>
            </div>
          </div>
          <div className="card" style={{ marginTop: '10px' }}>
            <div className="section-title">Virements internes (pas de facturation)</div>
            <div style={{ fontSize: '13px', color: 'var(--gris)', lineHeight: 1.8 }}>
              Tony vire directement à Amely <strong style={{ color: 'var(--blanc)' }}>500€/mois</strong> depuis le compte entreprise.<br />
              Ce n'est <strong style={{ color: 'var(--blanc)' }}>pas une facture</strong>, pas d'IVA, pas d'IRPF supplémentaire.<br />
              À documenter en interne comme répartition des bénéfices.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
