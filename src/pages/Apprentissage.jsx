import React, { useState } from 'react'

const PIERCING = {
  title: '💎 Piercing', color: 'var(--bleu)',
  phases: [
    { label: 'Formation & matériel', items: ['Curso higiénico-sanitario Decreto 43/2003','Commander kit pinces + aiguilles (300-500€)','Stock bijoux titane implant-grade (3-5K€)','Présentoir bijoux studio','Théorie : anatomie des zones de piercing','Pratiquer sur orange / silicone'] },
    { label: 'Premières peaux (août 2026)', items: ['Premiers piercings entourage (gratuits)','10 piercings documentés avec photos','Maîtriser la stérilisation et protocole','Lobes oreilles ✓','Hélix ✓','Nez ✓'] },
    { label: 'Semi-pro (oct-déc 2026)', items: ['Clients volontaires tarif réduit (20€)','30 piercings réalisés total','Nombril maîtrisé','Tragus maîtrisé','Premier bijou vendu à chaque client'] },
    { label: '✅ Professionnelle (Jan 2027)', items: ['Tarifs plein Blackthorn','5+ piercings/semaine réguliers','CA piercing studio : 600€/semaine','1 bijou vendu par piercing minimum'] }
  ]
}

const TATTOO = {
  title: '🖤 Fine Line Tattoo', color: 'var(--pierre)',
  phases: [
    { label: 'Fondation (mois 1-4 de 2027)', items: ['Dessin technique 30 min/jour','Practice skin : lignes, courbes, cercles','Aiguilles fine line (1RL, 3RL, 5RL)','Régler une machine rotative','Observer 20 sessions Tony minimum','Maîtriser la tension de peau'] },
    { label: 'Premières peaux (mois 5-10)', items: ['Premier tatouage entourage (gratuit)','10 tatouages sur entourage documentés','Photos before/after systématiques','Retours Tony sur chaque pièce','Micro-designs < 3 cm maîtrisés','Soins post-tatouage maîtrisés'] },
    { label: 'Semi-pro (mois 11-18)', items: ['Premiers clients payants (60-80€)','Portfolio 20 pièces documentées','CA tatouage 500€/mois','3 styles fine line maîtrisés','Posts résultats sur Instagram'] },
    { label: '✅ Pro (2029)', items: ['Tarifs plein Blackthorn (80€ minimum)','4-5 sessions/semaine','CA 3-5K€/mois','Style signature reconnaissable','Clients fidèles en projet long'] }
  ]
}

function PhaseBlock({ phase, idx, discipline }) {
  const [open, setOpen] = useState(idx === 0)
  const [checked, setChecked] = useState({})

  const toggle = (i) => setChecked(c => ({ ...c, [i]: !c[i] }))
  const done = Object.values(checked).filter(Boolean).length
  const pct = Math.round(done / phase.items.length * 100)

  return (
    <div className="card" style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{phase.label}</div>
          <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '3px' }}>{done}/{phase.items.length} étapes</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '50px', height: '4px', background: 'var(--noir3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: pct+'%', height: '100%', background: discipline.color, transition: 'width .3s' }} />
          </div>
          <span style={{ color: 'var(--gris)', fontSize: '14px' }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--noir3)', paddingTop: '12px' }}>
          {phase.items.map((item, i) => (
            <div key={i} onClick={() => toggle(i)} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '6px 0', cursor: 'pointer',
              opacity: checked[i] ? 0.5 : 1, transition: 'opacity .2s'
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '4px', flexShrink: 0, marginTop: '1px',
                background: checked[i] ? discipline.color : 'var(--noir3)',
                border: `2px solid ${checked[i] ? discipline.color : 'var(--gris2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s'
              }}>
                {checked[i] && <span style={{ color: 'var(--noir)', fontSize: '11px', fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: '13px', lineHeight: 1.5, textDecoration: checked[i] ? 'line-through' : 'none' }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Apprentissage() {
  const [tab, setTab] = useState('piercing')

  return (
    <div style={{ padding: '24px 16px 8px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
        Apprentissage Amely
      </div>
      <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '16px' }}>
        Piercing → Pro 2027 · Fine Line → Pro 2029
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[{ id: 'piercing', label: '💎 Piercing', color: 'var(--bleu)' }, { id: 'tattoo', label: '🖤 Fine Line', color: 'var(--pierre)' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px', borderRadius: 'var(--r)',
            background: tab === t.id ? t.color : 'var(--noir2)',
            color: tab === t.id ? 'var(--noir)' : 'var(--gris)',
            border: tab === t.id ? 'none' : '1px solid var(--noir3)',
            fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: '13px',
            cursor: 'pointer', transition: 'all .2s'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'piercing' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', background: 'rgba(41,128,185,.1)', borderColor: 'var(--bleu)' }}>
            <div style={{ fontSize: '12px', color: 'var(--gris)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--blanc)' }}>Budget matériel :</strong> 4 000–6 000€<br />
              <strong style={{ color: 'var(--blanc)' }}>Récupéré en :</strong> 6–8 semaines d'activité<br />
              <strong style={{ color: 'var(--blanc)' }}>Marge bijoux :</strong> 75–85% | Viser 1 bijou/piercing<br />
              <strong style={{ color: 'var(--vert)' }}>Objectif Jan 2027 : tarifs plein Blackthorn</strong>
            </div>
          </div>
          {PIERCING.phases.map((phase, i) => <PhaseBlock key={i} phase={phase} idx={i} discipline={PIERCING} />)}
        </div>
      )}

      {tab === 'tattoo' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', background: 'rgba(196,168,130,.08)', borderColor: 'var(--pierre)' }}>
            <div style={{ fontSize: '12px', color: 'var(--gris)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--blanc)' }}>Style :</strong> Fine Line / Micro — clientèle féminine FR+EN+DE<br />
              <strong style={{ color: 'var(--blanc)' }}>Mentor :</strong> Tony (sur place, zéro coût école)<br />
              <strong style={{ color: 'var(--blanc)' }}>Ticket futur :</strong> 120–250€ la pièce<br />
              <strong style={{ color: 'var(--vert)' }}>Objectif 2029 : artiste professionnelle Blackthorn</strong>
            </div>
          </div>
          {TATTOO.phases.map((phase, i) => <PhaseBlock key={i} phase={phase} idx={i} discipline={TATTOO} />)}
        </div>
      )}
    </div>
  )
}
