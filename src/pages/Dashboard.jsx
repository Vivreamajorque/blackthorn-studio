import React, { useState, useEffect, useCallback } from 'react'
import { notion } from '../lib/notion'

const LOYER_TTC  = 867
const LOYER_HT   = 716.53
const RETA       = 89
const PERSO      = 1500
const OBJ_JOUR   = 143
const PROV_HIVER = 1057

const todayStr  = () => new Date().toISOString().split('T')[0]
const thisMonth = () => todayStr().substring(0, 7)

const fmt = (n) => {
  const abs = Math.abs(Math.round(n))
  return (n < 0 ? '-' : '') + (abs >= 1000 ? (abs/1000).toFixed(1) + 'k€' : abs + '€')
}

function Bar({ pct, color = 'var(--pierre)', height = 6 }) {
  return (
    <div style={{ height, background: 'var(--noir3)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: Math.min(100, pct) + '%', background: color, borderRadius: 3, transition: 'width .5s ease' }} />
    </div>
  )
}

function Row({ label, value, sub, color = 'var(--blanc)', indent = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
      <span style={{ fontSize: '12px', color: 'var(--gris)', paddingLeft: indent ? '12px' : 0 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color }}>{value}</span>
        {sub && <div style={{ fontSize: '10px', color: 'var(--gris2)' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [depenses, setDepenses] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([notion.getSessions(), notion.getDepenses()])
      if (s.results) setSessions(s.results)
      if (d.results) setDepenses(d.results)
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const m = thisMonth()
  const today = todayStr()

  // ── Calculs CA ──────────────────────────────────
  const sessionsM = sessions.filter(s => (s.properties.Date?.date?.start || '').startsWith(m))
  const caMois    = sessionsM.reduce((a, s) => a + (s.properties.Prix?.number || 0), 0)
  const nbMois    = sessionsM.length
  const panierM   = nbMois > 0 ? Math.round(caMois / nbMois) : 0

  const sessionsJ = sessions.filter(s => s.properties.Date?.date?.start === today)
  const caJour    = sessionsJ.reduce((a, s) => a + (s.properties.Prix?.number || 0), 0)
  const nbJour    = sessionsJ.length
  const panierJ   = nbJour > 0 ? Math.round(caJour / nbJour) : 0

  // Panier 7 derniers jours (avec au moins 1 session)
  const last7 = Array.from({length:7},(_,i) => { const d = new Date(); d.setDate(d.getDate()-i); return d.toISOString().split('T')[0] })
  const sessions7 = sessions.filter(s => last7.includes(s.properties.Date?.date?.start))
  const ca7   = sessions7.reduce((a,s) => a + (s.properties.Prix?.number||0), 0)
  const nb7   = sessions7.length
  const panier7 = nb7 > 0 ? Math.round(ca7 / nb7) : 0

  // ── Calculs financiers ──────────────────────────
  const matos      = Math.round(caMois * 0.25)
  const ben        = caMois * 0.75 - LOYER_HT - RETA
  const netMois    = Math.max(0, Math.round(ben * 0.80))
  const irpfProv   = Math.max(0, Math.round(ben * 0.20))
  const ivaCollect = Math.round(caMois * 0.21)
  const ivaRecup   = Math.round(LOYER_HT * 0.21 + caMois * 0.25 * 0.21)
  const ivaNette   = Math.max(0, ivaCollect - ivaRecup)
  const depMois    = depenses.filter(d => (d.properties.Date?.date?.start||'').startsWith(m)).reduce((a,d) => a + (d.properties.Montant?.number||0), 0)
  const totalSorties = LOYER_HT + RETA + matos + Math.round(depMois)
  const surplus    = netMois - PERSO

  // Saison été ?
  const month = new Date().getMonth() + 1
  const isEte = month >= 6 && month <= 10

  // Équilibre
  const pctEquil = Math.min(100, Math.round((caMois / (OBJ_JOUR * 25)) * 100))

  return (
    <div style={{ padding: '20px 16px 8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, letterSpacing: '3px', color: 'var(--pierre)' }}>BLACKTHORN</div>
          <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>
        <button onClick={load} style={{ background:'none', border:'none', color:'var(--gris)', fontSize:'18px', cursor:'pointer', padding:'4px' }}>↻</button>
      </div>

      {/* ── PANIER MOYEN — VITRINE ─────────────────── */}
      <div className="card" style={{ marginBottom: '16px', borderColor: panierM >= 200 ? 'var(--epine2)' : panierM >= 143 ? 'var(--gris2)' : 'var(--rouge)' }}>
        <div style={{ fontSize: '11px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Panier moyen (CA ÷ sessions)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
          {[
            { label: "Aujourd'hui", pm: panierJ, nb: nbJour },
            { label: '7 derniers jours', pm: panier7, nb: nb7 },
            { label: 'Ce mois', pm: panierM, nb: nbMois },
          ].map(({ label, pm, nb }) => (
            <div key={label} style={{ padding: '10px 6px', background: 'var(--noir3)', borderRadius: 'var(--r)' }}>
              <div style={{ fontSize: '9px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color: pm >= 200 ? 'var(--vert)' : pm >= 143 ? 'var(--pierre)' : nb === 0 ? 'var(--gris2)' : 'var(--rouge)' }}>
                {nb === 0 ? '—' : pm + '€'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--gris2)', marginTop: '2px' }}>{nb > 0 ? `${nb} sess.` : 'aucune'}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '10px', color: 'var(--gris)' }}>
            <span>0€</span>
            <span style={{ color: 'var(--pierre)' }}>Équilibre 143€ · Objectif été 300€</span>
          </div>
          <Bar pct={Math.min(100, (panierM / 300) * 100)} color={panierM >= 300 ? 'var(--vert)' : panierM >= 143 ? 'var(--pierre)' : 'var(--rouge)'} height={8} />
        </div>
      </div>

      {/* ── CA MOIS ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="label">CA mois HT</div>
          <div className="value">{loading ? '...' : fmt(caMois)}</div>
          <Bar pct={pctEquil} color={caMois >= OBJ_JOUR*25 ? 'var(--vert)' : 'var(--pierre)'} />
          <div className="sub">{pctEquil}% de l'équilibre ({OBJ_JOUR}€/j)</div>
        </div>
        <div className="stat-card">
          <div className="label">Aujourd'hui</div>
          <div className="value" style={{ color: caJour >= OBJ_JOUR ? 'var(--vert)' : caJour > 0 ? 'var(--pierre)' : 'var(--gris2)' }}>
            {loading ? '...' : caJour > 0 ? fmt(caJour) : '—'}
          </div>
          <div className="sub">{nbJour > 0 ? `${nbJour} session${nbJour>1?'s':''}` : 'Pas encore saisi'}</div>
        </div>
      </div>

      {/* ── TABLEAU FINANCES COMPLET ───────────────── */}
      <div className="section-title">Finances du mois</div>
      <div className="card" style={{ marginBottom: '16px' }}>

        {/* Entrées */}
        <div style={{ fontSize: '10px', color: 'var(--pierre)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '6px 0 2px' }}>ENTRÉES</div>
        <Row label="CA encaissé HT" value={fmt(caMois)} color="var(--vert)" />
        <Row label="IVA collecté (21%)" value={fmt(ivaCollect)} color="var(--gris)" sub="reversé à Hacienda" />

        {/* Sorties opérationnelles */}
        <div style={{ fontSize: '10px', color: 'var(--rouge)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 0 2px' }}>SORTIES OPÉRATIONNELLES</div>
        <Row label="Loyer HT studio" value={`-${LOYER_HT.toFixed(0)}€`} color="var(--gris)" />
        <Row label="RETA Tony" value={`-${RETA}€`} color="var(--gris)" />
        <Row label="Matériel/charges 25%" value={`-${fmt(matos)}`} color="var(--gris)" />
        {depMois > 0 && <Row label="Dépenses saisies" value={`-${fmt(depMois)}`} color="var(--gris)" />}
        <Row label="Total sorties opé." value={`-${fmt(totalSorties)}`} color="var(--rouge)" />

        {/* Résultat */}
        <div style={{ fontSize: '10px', color: 'var(--pierre3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 0 2px' }}>RÉSULTAT</div>
        <Row label="Bénéfice brut" value={fmt(Math.round(ben))} color={ben > 0 ? 'var(--pierre)' : 'var(--rouge)'} />
        <Row label="Prov. IRPF (20%)" value={`-${fmt(irpfProv)}`} color="var(--jaune)" sub="→ compte provision" />
        <Row label="IVA nette à reverser" value={`-${fmt(ivaNette)}`} color="var(--jaune)" sub="→ compte provision" />
        <Row label={<strong>NET DISPONIBLE</strong>} value={fmt(netMois)} color={netMois >= PERSO ? 'var(--vert)' : 'var(--rouge)'} />

        {/* Vie */}
        <div style={{ fontSize: '10px', color: 'var(--gris)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 0 2px' }}>VIE</div>
        <Row label="Charges ménage" value={`-${PERSO}€`} color="var(--gris)" />
        <Row label={isEte ? "Provision hiver (été)" : "Réserve hiver"} value={isEte ? `-${PROV_HIVER}€` : '—'} color={isEte ? 'var(--pierre)' : 'var(--gris2)'} sub={isEte ? '→ compte réserve' : ''} />

        {/* Résultat final */}
        <div style={{ marginTop: '8px', padding: '10px', background: surplus > 0 ? 'var(--epine)' : 'rgba(192,57,43,.15)', borderRadius: 'var(--r)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Dispo après charges + réserve</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: surplus > 0 ? 'var(--vert)' : 'var(--rouge)', fontWeight: 700 }}>
              {surplus >= 0 ? '+' : ''}{fmt(isEte ? surplus - PROV_HIVER : surplus)}
            </span>
          </div>
        </div>
      </div>

      {/* ── PROVISIONS À CONSTITUER ───────────────── */}
      <div className="section-title">Ce qui doit être de côté</div>
      <div className="card" style={{ marginBottom: '16px' }}>
        {[
          { l: 'IRPF Tony (20% bénéfice)', v: irpfProv, color: 'var(--jaune)' },
          { l: 'IVA nette', v: ivaNette, color: 'var(--jaune)' },
          { l: isEte ? 'Réserve hiver (été uniquement)' : 'Réserve hiver', v: isEte ? PROV_HIVER : 0, color: 'var(--pierre)' },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: r.color }}>{fmt(r.v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontWeight: 600 }}>
          <span style={{ fontSize: '13px' }}>TOTAL À PROVISIONNER</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--rouge)' }}>
            {fmt(irpfProv + ivaNette + (isEte ? PROV_HIVER : 0))}
          </span>
        </div>
      </div>

      {/* ── CHARGES FIXES RAPPEL ─────────────────── */}
      <div className="section-title">Charges fixes mensuelles</div>
      <div className="card" style={{ marginBottom: '8px' }}>
        {[
          { l: 'Loyer studio TTC', v: `${LOYER_TTC}€` },
          { l: 'RETA Tony', v: `${RETA}€` },
          { l: 'Charges ménage', v: `${PERSO}€` },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--noir3)' }}>
            <span style={{ fontSize: '12px', color: 'var(--gris)' }}>{r.l}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--pierre)' }}>{r.v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: 600 }}>
          <span style={{ fontSize: '12px' }}>Total fixe</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--rouge)' }}>{LOYER_TTC + RETA + PERSO}€/mois</span>
        </div>
      </div>

    </div>
  )
}
