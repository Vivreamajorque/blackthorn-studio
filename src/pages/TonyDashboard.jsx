import React, { useState, useEffect } from 'react'
import { notion } from '../lib/notion'

const today = () => new Date().toISOString().split('T')[0]

const jourSemaine = () => {
  const j = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  return j[new Date().getDay()]
}

const OBJECTIF_JOUR = 200

export default function TonyDashboard({ onLogout }) {
  const [step, setStep] = useState('accueil') // accueil | saisie | confirm | historique
  const [form, setForm] = useState({
    ca: '',
    sessions: '',
    type: '🖤 Tattoo Tony',
    notes: '',
    date: today()
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [historique, setHistorique] = useState([])
  const [loadingHisto, setLoadingHisto] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const loadHistorique = async () => {
    setLoadingHisto(true)
    try {
      const r = await notion.getSessions()
      if (r.results) setHistorique(r.results.slice(0, 10))
    } catch(e) {}
    setLoadingHisto(false)
  }

  const submit = async () => {
    if (!form.ca) return
    setSaving(true)
    try {
      const montant = parseFloat(form.ca)
      const nbSessions = parseInt(form.sessions) || 1
      // Créer une entrée par session si plusieurs
      const sessionName = `Tony · ${form.date} · ${montant}€`
      await notion.addSession({
        session: sessionName,
        type: form.type,
        client: '',
        natio: '—',
        style: form.notes,
        prix: montant,
        acompte: 0,
        solde: montant,
        notes: `${nbSessions} session(s) · ${form.notes}`,
        date: form.date,
        avis: false
      })
      setSaved(true)
      setStep('confirm')
    } catch(e) {
      showToast('Erreur connexion — réessaie')
    }
    setSaving(false)
  }

  const caNum = parseFloat(form.ca) || 0
  const pctObjectif = Math.min(100, (caNum / OBJECTIF_JOUR) * 100)
  const surObjectif = caNum >= OBJECTIF_JOUR

  if (step === 'confirm') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>{surObjectif ? '🔥' : '✅'}</div>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '22px', fontWeight: 800, color: 'var(--pierre)', marginBottom: '12px' }}>
        {surObjectif ? `${caNum}€ — Objectif dépassé !` : `${caNum}€ enregistré`}
      </div>
      <div style={{ fontSize: '14px', color: 'var(--gris)', marginBottom: '8px' }}>
        {surObjectif
          ? `+${(caNum - OBJECTIF_JOUR).toFixed(0)}€ au-dessus de l'objectif journalier`
          : `Il manquait ${(OBJECTIF_JOUR - caNum).toFixed(0)}€ pour l'objectif de ${OBJECTIF_JOUR}€`
        }
      </div>
      <div style={{ fontSize: '12px', color: 'var(--gris2)', marginBottom: '40px' }}>
        Amely voit ça dans le cockpit automatiquement.
      </div>
      <button className="btn btn-primary" onClick={() => { setStep('accueil'); setForm({ ca: '', sessions: '', type: '🖤 Tattoo Tony', notes: '', date: today() }); setSaved(false) }} style={{ width: '100%', maxWidth: 280, padding: '14px', marginBottom: '12px' }}>
        ✓ Terminé pour aujourd'hui
      </button>
      <button className="btn btn-ghost" onClick={() => setStep('historique')} style={{ width: '100%', maxWidth: 280 }}>
        Voir l'historique
      </button>
    </div>
  )

  if (step === 'historique') {
    if (historique.length === 0 && !loadingHisto) loadHistorique()
    return (
      <div style={{ padding: '24px 16px', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Historique</div>
          <button className="btn btn-ghost" onClick={() => setStep('accueil')} style={{ padding: '6px 14px', fontSize: '12px' }}>← Retour</button>
        </div>
        {loadingHisto && <div style={{ color: 'var(--gris)', textAlign: 'center', padding: '40px' }}>Chargement...</div>}
        {historique.map(s => {
          const p = s.properties
          const prix = p.Prix?.number || 0
          const date = p.Date?.date?.start || ''
          const notes = p.Notes?.rich_text?.[0]?.plain_text || ''
          return (
            <div key={s.id} className="card" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--gris)' }}>{date}</div>
                {notes && <div style={{ fontSize: '11px', color: 'var(--gris2)', marginTop: '2px' }}>{notes.substring(0, 40)}</div>}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: prix >= OBJECTIF_JOUR ? 'var(--vert)' : 'var(--pierre)' }}>
                {prix}€
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ACCUEIL TONY
  if (step === 'accueil') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '48px 24px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '26px', fontWeight: 800, color: 'var(--pierre)', letterSpacing: '2px' }}>
          Blackthorn 🖤
        </div>
        <div style={{ fontSize: '14px', color: 'var(--gris)', marginTop: '4px' }}>
          {jourSemaine()} · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Objectif du jour */}
      <div className="card" style={{ marginBottom: '32px', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--gris)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Objectif du jour</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '40px', color: 'var(--pierre)', fontWeight: 500 }}>200€</div>
        <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '4px' }}>panier moyen actuel : 150€</div>
      </div>

      {/* Actions principales */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        <button className="btn btn-primary" onClick={() => setStep('saisie')} style={{ padding: '18px', fontSize: '16px', fontWeight: 700, letterSpacing: '1px' }}>
          + Saisir ma journée
        </button>
        <button className="btn btn-ghost" onClick={() => { setStep('historique'); loadHistorique() }} style={{ padding: '14px' }}>
          Voir l'historique
        </button>
      </div>

      {/* Tips du jour */}
      <div style={{ marginTop: 'auto', paddingTop: '32px' }}>
        <div style={{ fontSize: '12px', color: 'var(--gris)', lineHeight: 1.7, textAlign: 'center' }}>
          💡 Pour augmenter le panier : propose des pièces plus grandes,<br />
          des projets en plusieurs sessions, des zones visibles.<br />
          <strong style={{ color: 'var(--pierre)' }}>250€ moyen = 2× le revenu actuel.</strong>
        </div>
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--gris2)', fontSize: '12px', marginTop: '20px', cursor: 'pointer', textAlign: 'center' }}>
        Déconnexion
      </button>
    </div>
  )

  // SAISIE
  return (
    <div style={{ padding: '32px 24px 24px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700 }}>Ma journée</div>
        <button className="btn btn-ghost" onClick={() => setStep('accueil')} style={{ padding: '6px 14px', fontSize: '12px' }}>← Retour</button>
      </div>

      {/* CA input — grand et clair */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          CA encaissé aujourd'hui (€)
        </div>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={form.ca}
          onChange={e => setForm({...form, ca: e.target.value})}
          style={{
            fontSize: '48px', fontFamily: 'var(--font-mono)', fontWeight: 500,
            textAlign: 'center', background: 'transparent', border: 'none',
            borderBottom: '2px solid var(--pierre)', borderRadius: 0,
            color: 'var(--pierre)', width: '200px', padding: '8px 0'
          }}
        />

        {/* Progress bar vs objectif */}
        {caNum > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ width: '200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--gris)', marginBottom: '4px' }}>
                <span>0€</span>
                <span style={{ color: surObjectif ? 'var(--vert)' : 'var(--pierre)' }}>{caNum}€ / {OBJECTIF_JOUR}€</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: pctObjectif+'%', background: surObjectif ? 'var(--vert)' : 'var(--pierre)' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Infos rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Nb sessions</label>
          <input type="number" inputMode="numeric" placeholder="1" value={form.sessions} onChange={e => setForm({...form, sessions: e.target.value})} style={{ textAlign: 'center', fontSize: '18px' }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date</label>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label>Notes rapides (style, client, remarques)</label>
        <textarea rows="2" placeholder="Ex: botanical avant-bras, client allemand..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{ resize: 'none', fontSize: '14px' }} />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={saving || !form.ca} style={{ width: '100%', padding: '16px', fontSize: '15px' }}>
        {saving ? 'Enregistrement...' : '✓ Valider ma journée'}
      </button>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
