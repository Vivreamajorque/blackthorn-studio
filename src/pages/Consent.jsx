import React, { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'

const LANGS = {
  fr: {
    title: 'Fiche de consentement', subtitle: 'Blackthorn Tattoo · Campos, Mallorca',
    step1: 'Vos informations', step2: 'Santé', step3: 'Consentements', step4: 'Signature',
    nom: 'Nom complet *', dni: 'DNI / NIE / Passeport *', dateNaissance: 'Date de naissance *',
    nationalite: 'Nationalité', email: 'Email',
    majeurLabel: 'Je déclare avoir 18 ans ou plus',
    mineurLabel: 'Je suis mineur(e) — autorisation parentale jointe',
    contraTitle: 'Cochez si vous avez ou avez eu l\'une de ces conditions :',
    contras: {
      diabetes: 'Diabète', coagulation: 'Troubles de coagulation', cardio: 'Cardiopathies',
      vih: 'VIH / Hépatites B ou C', grossesse: 'Grossesse ou allaitement',
      epilepsie: 'Épilepsie', dermato: 'Psoriasis / Eczéma / Dermatite (zone tatouée)',
      keloide: 'Tendance aux kéloïdes', anticoag: 'Anticoagulants (Aspirine, Warfarine…)',
      isotret: 'Isotrétinoïne (Roaccutane) — 12 derniers mois',
      allergie: 'Allergie aux encres, métaux ou anesthésiants', autoimmun: 'Maladies auto-immunes',
      autre: 'Autre condition médicale importante',
    },
    consentTitle: 'Je confirme et accepte :',
    consents: [
      'Avoir été informé(e) des risques : infection, allergie, kéloïde, décoloration',
      'Comprendre que le tatouage est permanent',
      'Avoir communiqué tous mes antécédents médicaux',
      'Ne pas être sous l\'effet d\'alcool ou de drogues',
      'Avoir approuvé le design, la taille et le placement',
      'M\'engager à suivre les instructions d\'après-soin (aftercare)',
      'Accepter la politique de protection des données (RGPD)',
    ],
    photoOk: 'J\'autorise la publication du tatouage sur les réseaux du studio',
    photoNo: 'Je refuse toute publication sur les réseaux sociaux',
    sigTitle: 'Signature numérique', sigClear: 'Effacer', sigHint: 'Signez ici avec votre doigt',
    required: 'Veuillez remplir tous les champs obligatoires (*) et cocher les consentements.',
    requiredSig: 'Veuillez signer avant de valider.',
    submit: 'Valider et signer',
    saving: 'Enregistrement…',
    done: 'Fiche enregistrée ✅',
    doneSub: 'Votre consentement a été transmis à Blackthorn Tattoo.',
    next: 'Suivant →', back: '← Retour',
    none: 'Aucune de ces conditions',
  },
  en: {
    title: 'Consent Form', subtitle: 'Blackthorn Tattoo · Campos, Mallorca',
    step1: 'Your details', step2: 'Health', step3: 'Consents', step4: 'Signature',
    nom: 'Full name *', dni: 'ID / Passport *', dateNaissance: 'Date of birth *',
    nationalite: 'Nationality', email: 'Email',
    majeurLabel: 'I declare I am 18 years or older',
    mineurLabel: 'I am under 18 — parental consent attached',
    contraTitle: 'Check if you have or have had any of the following:',
    contras: {
      diabetes: 'Diabetes', coagulation: 'Coagulation disorders', cardio: 'Heart conditions',
      vih: 'HIV / Hepatitis B or C', grossesse: 'Pregnancy or breastfeeding',
      epilepsie: 'Epilepsy', dermato: 'Psoriasis / Eczema / Dermatitis (tattoo area)',
      keloide: 'Keloid tendency', anticoag: 'Blood thinners (Aspirin, Warfarin…)',
      isotret: 'Isotretinoin (Roaccutane) — last 12 months',
      allergie: 'Allergy to inks, metals or topical anaesthetics', autoimmun: 'Autoimmune diseases',
      autre: 'Other significant medical condition',
    },
    consentTitle: 'I confirm and agree:',
    consents: [
      'I have been informed of risks: infection, allergy, keloid, fading',
      'I understand tattooing is permanent',
      'I have disclosed all relevant medical history',
      'I am not under the influence of alcohol or drugs',
      'I have approved the design, size and placement',
      'I commit to following aftercare instructions',
      'I accept the data protection policy (GDPR)',
    ],
    photoOk: 'I allow the studio to post the tattoo on social media',
    photoNo: 'I do not authorise any social media publication',
    sigTitle: 'Digital signature', sigClear: 'Clear', sigHint: 'Sign here with your finger',
    required: 'Please fill all required fields (*) and check all consents.',
    requiredSig: 'Please sign before submitting.',
    submit: 'Sign & Submit',
    saving: 'Saving…', done: 'Form submitted ✅', doneSub: 'Your consent has been sent to Blackthorn Tattoo.',
    next: 'Next →', back: '← Back', none: 'None of these',
  },
  es: {
    title: 'Ficha de consentimiento', subtitle: 'Blackthorn Tattoo · Campos, Mallorca',
    step1: 'Tus datos', step2: 'Salud', step3: 'Consentimientos', step4: 'Firma',
    nom: 'Nombre completo *', dni: 'DNI / NIE / Pasaporte *', dateNaissance: 'Fecha de nacimiento *',
    nationalite: 'Nacionalidad', email: 'Email',
    majeurLabel: 'Declaro tener 18 años o más',
    mineurLabel: 'Soy menor de edad — autorización parental adjunta',
    contraTitle: 'Marca si tienes o has tenido alguna de estas condiciones:',
    contras: {
      diabetes: 'Diabetes', coagulation: 'Trastornos de coagulación', cardio: 'Cardiopatías',
      vih: 'VIH / Hepatitis B o C', grossesse: 'Embarazo o lactancia',
      epilepsie: 'Epilepsia', dermato: 'Psoriasis / Eczema / Dermatitis (zona a tatuar)',
      keloide: 'Tendencia a queloides', anticoag: 'Anticoagulantes (Aspirina, Warfarina…)',
      isotret: 'Isotretinoína (Roaccutane) — últimos 12 meses',
      allergie: 'Alergia a tintas, metales o anestésicos tópicos', autoimmun: 'Enfermedades autoinmunes',
      autre: 'Otra condición médica importante',
    },
    consentTitle: 'Confirmo y acepto:',
    consents: [
      'Haber sido informado/a de los riesgos: infección, alergia, queloide, decoloración',
      'Entender que el tatuaje es permanente',
      'Haber comunicado todos mis antecedentes médicos',
      'No estar bajo los efectos del alcohol o drogas',
      'Haber aprobado el diseño, tamaño y ubicación',
      'Comprometerme a seguir las instrucciones de aftercare',
      'Aceptar la política de protección de datos (RGPD)',
    ],
    photoOk: 'Autorizo la publicación del tatuaje en las redes del estudio',
    photoNo: 'No autorizo ninguna publicación en redes sociales',
    sigTitle: 'Firma digital', sigClear: 'Borrar', sigHint: 'Firma aquí con tu dedo',
    required: 'Por favor, rellena todos los campos obligatorios (*) y marca los consentimientos.',
    requiredSig: 'Por favor, firma antes de enviar.',
    submit: 'Firmar y enviar',
    saving: 'Guardando…', done: 'Ficha registrada ✅', doneSub: 'Tu consentimiento ha sido enviado a Blackthorn Tattoo.',
    next: 'Siguiente →', back: '← Volver', none: 'Ninguna de estas condiciones',
  },
  de: {
    title: 'Einverständniserklärung', subtitle: 'Blackthorn Tattoo · Campos, Mallorca',
    step1: 'Deine Daten', step2: 'Gesundheit', step3: 'Einverständnis', step4: 'Unterschrift',
    nom: 'Vollständiger Name *', dni: 'Ausweis / Reisepass *', dateNaissance: 'Geburtsdatum *',
    nationalite: 'Staatsangehörigkeit', email: 'Email',
    majeurLabel: 'Ich erkläre, 18 Jahre oder älter zu sein',
    mineurLabel: 'Ich bin minderjährig — Elterliche Zustimmung liegt vor',
    contraTitle: 'Bitte ankreuzen, falls zutreffend:',
    contras: {
      diabetes: 'Diabetes', coagulation: 'Gerinnungsstörungen', cardio: 'Herzerkrankungen',
      vih: 'HIV / Hepatitis B oder C', grossesse: 'Schwangerschaft oder Stillzeit',
      epilepsie: 'Epilepsie', dermato: 'Psoriasis / Ekzem / Dermatitis (Tätowierbereich)',
      keloide: 'Neigung zu Keloiden', anticoag: 'Blutverdünner (Aspirin, Warfarin…)',
      isotret: 'Isotretinoin (Roaccutane) — letzte 12 Monate',
      allergie: 'Allergie gegen Tinten, Metalle oder topische Anästhetika', autoimmun: 'Autoimmunkrankheiten',
      autre: 'Andere relevante Erkrankung',
    },
    consentTitle: 'Ich bestätige und stimme zu:',
    consents: [
      'Über Risiken informiert worden zu sein: Infektion, Allergie, Keloid, Verblassen',
      'Dass Tätowierungen dauerhaft sind',
      'Alle relevanten Vorerkrankungen mitgeteilt zu haben',
      'Nicht unter Alkohol- oder Drogeneinfluss zu stehen',
      'Design, Größe und Platzierung genehmigt zu haben',
      'Die Nachsorge-Anweisungen zu befolgen',
      'Die Datenschutzrichtlinie (DSGVO) zu akzeptieren',
    ],
    photoOk: 'Ich erlaube die Veröffentlichung des Tattoos auf Social Media des Studios',
    photoNo: 'Ich untersage jede Veröffentlichung in sozialen Netzwerken',
    sigTitle: 'Digitale Unterschrift', sigClear: 'Löschen', sigHint: 'Hier mit dem Finger unterschreiben',
    required: 'Bitte alle Pflichtfelder (*) ausfüllen und alle Einverständnisse ankreuzen.',
    requiredSig: 'Bitte vor dem Absenden unterschreiben.',
    submit: 'Unterschreiben & Absenden',
    saving: 'Speichern…', done: 'Formular gespeichert ✅', doneSub: 'Ihre Einverständniserklärung wurde an Blackthorn Tattoo übermittelt.',
    next: 'Weiter →', back: '← Zurück', none: 'Keine dieser Bedingungen',
  },
  ca: {
    title: 'Fitxa de consentiment', subtitle: 'Blackthorn Tattoo · Campos, Mallorca',
    step1: 'Les teves dades', step2: 'Salut', step3: 'Consentiments', step4: 'Signatura',
    nom: 'Nom complet *', dni: 'DNI / NIE / Passaport *', dateNaissance: 'Data de naixement *',
    nationalite: 'Nacionalitat', email: 'Email',
    majeurLabel: 'Declaro tenir 18 anys o més',
    mineurLabel: 'Sóc menor d\'edat — autorització parental adjunta',
    contraTitle: 'Marca si tens o has tingut alguna d\'aquestes condicions:',
    contras: {
      diabetes: 'Diabetis', coagulation: 'Trastorns de coagulació', cardio: 'Cardiopaties',
      vih: 'VIH / Hepatitis B o C', grossesse: 'Embaràs o lactància',
      epilepsie: 'Epilèpsia', dermato: 'Psoriasi / Èczema / Dermatitis (zona a tatuar)',
      keloide: 'Tendència a queloide', anticoag: 'Anticoagulants (Aspirina, Warfarina…)',
      isotret: 'Isotretinoïna (Roaccutane) — darrers 12 mesos',
      allergie: 'Al·lèrgia a tintes, metalls o anestèsics tòpics', autoimmun: 'Malalties autoimmunes',
      autre: 'Altra condició mèdica important',
    },
    consentTitle: 'Confirmo i accepto:',
    consents: [
      'Haver estat informat/da dels riscos: infecció, al·lèrgia, queloide, decoloració',
      'Entendre que el tatuatge és permanent',
      'Haver comunicat tots els meus antecedents mèdics',
      'No estar sota els efectes de l\'alcohol o drogues',
      'Haver aprovat el disseny, mida i ubicació',
      'Comprometre\'m a seguir les instruccions d\'aftercare',
      'Acceptar la política de protecció de dades (RGPD)',
    ],
    photoOk: 'Autoritzo la publicació del tatuatge a les xarxes de l\'estudi',
    photoNo: 'No autoritzo cap publicació a les xarxes socials',
    sigTitle: 'Signatura digital', sigClear: 'Esborrar', sigHint: 'Signa aquí amb el teu dit',
    required: 'Si us plau, omple tots els camps obligatoris (*) i marca tots els consentiments.',
    requiredSig: 'Si us plau, signa abans d\'enviar.',
    submit: 'Signar i enviar',
    saving: 'Desant…', done: 'Fitxa registrada ✅', doneSub: 'El teu consentiment ha estat enviat a Blackthorn Tattoo.',
    next: 'Següent →', back: '← Tornar', none: 'Cap d\'aquestes condicions',
  },
}

// Canvas de signature
function SignatureCanvas({ onSign, cleared }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)

  useEffect(() => {
    if (cleared) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        hasDrawn.current = false
        onSign(null)
      }
    }
  }, [cleared])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1A1A1A'
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y); ctx.stroke()
    hasDrawn.current = true
  }

  const stop = (e) => {
    e.preventDefault()
    drawing.current = false
    if (hasDrawn.current) {
      onSign(canvasRef.current.toDataURL())
    }
  }

  return (
    <canvas ref={canvasRef} width={340} height={150}
      style={{ border: '2px solid #1A1A1A', borderRadius: '8px', background: '#FAFAFA', touchAction: 'none', width: '100%', maxWidth: 340 }}
      onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
    />
  )
}

export default function Consent() {
  const sessionId = window.location.pathname.split('/consent/')[1]?.split('/')[0] || ''
  const [lang, setLang] = useState('fr')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ nom: '', dni: '', dateNaissance: '', nationalite: '', email: '', telephone: '', majeur: true })
  const [contras, setContras] = useState({})
  const [autreDetail, setAutreDetail] = useState('')
  const [consents, setConsents] = useState({})
  const [photo, setPhoto] = useState(null)
  const [sig, setSig] = useState(null)
  const [sigCleared, setSigCleared] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('ca')) setLang('ca')
    else if (nav.startsWith('es')) setLang('es')
    else if (nav.startsWith('de')) setLang('de')
    else if (nav.startsWith('en')) setLang('en')
    else setLang('fr')
  }, [])

  const t = LANGS[lang] || LANGS.fr
  const allContraKeys = Object.keys(t.contras)

  const toggleContra = (k) => setContras(p => ({ ...p, [k]: !p[k] }))
  const toggleConsent = (i) => setConsents(p => ({ ...p, [i]: !p[i] }))

  const validateStep = () => {
    if (step === 1) {
      if (!form.nom.trim() || !form.dni.trim() || !form.dateNaissance) {
        setError(t.required); return false
      }
    }
    if (step === 3) {
      const allChecked = t.consents.every((_, i) => consents[i])
      if (!allChecked || photo === null) { setError(t.required); return false }
    }
    if (step === 4 && !sig) { setError(t.requiredSig); return false }
    setError(''); return true
  }

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const t2 = LANGS[lang] || LANGS.fr
    const now = new Date().toLocaleString('fr-FR')
    let y = 20

    // En-tête
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('BLACKTHORN TATTOO', 105, y, { align: 'center' })
    y += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text('Carrer de Santanyí 19 · 07630 Campos, Mallorca · España', 105, y, { align: 'center' })
    y += 5
    doc.text(t2.title + ' — ' + now, 105, y, { align: 'center' })
    doc.setTextColor(0)
    y += 10

    // Données client
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text('1. ' + t2.step1, 15, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    ;[
      [t2.nom, form.nom],
      [t2.dni, form.dni],
      [t2.dateNaissance, form.dateNaissance],
      [t2.nationalite, form.nationalite],
      [t2.email, form.email],
      ['Majeur(e) / Adult', form.majeur ? 'OUI / YES' : 'NON / NO'],
    ].forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold'); doc.text(label + ' :', 15, y)
      doc.setFont('helvetica', 'normal'); doc.text(val || '—', 80, y)
      y += 5
    })
    y += 4

    // Contre-indications
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text('2. ' + t2.step2, 15, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const checkedContras = Object.keys(t2.contras).filter(k => contras[k])
    if (checkedContras.length === 0) {
      doc.text('Aucune condition déclarée / No conditions declared', 15, y); y += 5
    } else {
      checkedContras.forEach(k => {
        const lines = doc.splitTextToSize('✓ ' + t2.contras[k], 180)
        doc.text(lines, 15, y); y += lines.length * 5
      })
      if (contras['autre'] && autreDetail) {
        doc.setFont('helvetica', 'bold')
        const lines = doc.splitTextToSize('⚠ Précision : ' + autreDetail, 180)
        doc.text(lines, 15, y); y += lines.length * 5
        doc.setFont('helvetica', 'normal')
      }
    }
    y += 4

    // Consentements
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text('3. ' + t2.step3, 15, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    t2.consents.forEach((c, i) => {
      const lines = doc.splitTextToSize((consents[i] ? '✓ ' : '✗ ') + c, 180)
      doc.text(lines, 15, y); y += lines.length * 5
    })
    doc.text((photo === true ? '✓ ' : '✗ ') + (photo ? t2.photoOk : t2.photoNo), 15, y); y += 8

    // Signature
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text('4. ' + t2.step4, 15, y); y += 6
    if (sig) {
      doc.addImage(sig, 'PNG', 15, y, 80, 30)
      y += 34
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('Signé électroniquement le ' + now, 15, y); y += 5
    doc.text('Blackthorn Tattoo · Campos, Mallorca · Decreto 28/2003 · RGPD (UE) 2016/679', 15, y)
    doc.setTextColor(0)

    return doc.output('datauristring')
  }

  const submit = async () => {
    if (!validateStep()) return
    setSaving(true)
    try {
      // Générer le PDF
      const pdfData = generatePDF()
      await fetch('/api/consent-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          lang,
          signature: sig,
          pdfData,
          data: { ...form, contras, autreDetail, photoOk: photo === true }
        })
      })
      setDone(true)
      // Proposer téléchargement PDF au client
      const link = document.createElement('a')
      link.href = pdfData
      link.download = 'consentement-blackthorn.pdf'
      link.click()
    } catch(e) { setError('Erreur : ' + e.message) }
    setSaving(false)
  }

  // Styles
  const bg = '#FAFAF7', card = '#FFFFFF', txt = '#1A1A1A', muted = '#888'
  const accent = '#1A1A1A', gold = '#C9893A'

  const s = {
    page: { minHeight: '100dvh', background: bg, fontFamily: 'Inter, sans-serif', color: txt, paddingBottom: 80 },
    nav: { background: '#1A1A1A', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 },
    inner: { maxWidth: 480, margin: '0 auto', padding: '24px 16px' },
    card: { background: card, borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
    label: { display: 'block', fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 },
    input: { width: '100%', padding: '12px 14px', border: '1.5px solid #E0E0E0', borderRadius: 10, fontSize: 15, fontFamily: 'Inter, sans-serif', background: '#FAFAFA', color: txt, boxSizing: 'border-box' },
    checkRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' },
    btnPrim: { width: '100%', padding: 16, background: accent, color: 'white', border: 'none', borderRadius: 50, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    btnGhost: { background: 'transparent', border: '1.5px solid #DDD', borderRadius: 50, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: muted },
  }

  if (done) return (
    <div style={s.page}>
      <nav style={s.nav}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>BLACKTHORN</span>
      </nav>
      <div style={{ ...s.inner, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{t.done}</h1>
        <p style={{ color: muted, fontSize: 14 }}>{t.doneSub}</p>
      </div>
    </div>
  )

  // Barre de progression
  const steps = [t.step1, t.step2, t.step3, t.step4]

  return (
    <div style={s.page}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>BLACKTHORN TATTOO</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', textTransform: 'uppercase',
              background: lang === l ? '#C9893A' : 'rgba(255,255,255,.15)', color: 'white'
            }}>{l}</button>
          ))}
        </div>
      </nav>

      {/* Barre de progression */}
      <div style={{ background: 'white', borderBottom: '1px solid #EEE', padding: '12px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 6 }}>
          {steps.map((s_, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 4, background: i + 1 <= step ? accent : '#E0E0E0', marginBottom: 4 }} />
              <span style={{ fontSize: 10, color: i + 1 <= step ? accent : muted, fontWeight: i + 1 === step ? 700 : 400 }}>{s_}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.inner}>

        {/* ÉTAPE 1 — Données personnelles */}
        {step === 1 && (
          <div style={s.card}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>{t.step1}</h2>

            {[['nom', t.nom], ['dni', t.dni], ['dateNaissance', t.dateNaissance, 'date'],
              ['nationalite', t.nationalite], ['email', t.email, 'email'], ['telephone', t.telephone, 'tel']
            ].map(([key, label, type]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={s.label}>{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={s.input} />
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
              <label style={s.label}>Âge / Age</label>
              {[true, false].map(v => (
                <div key={String(v)} style={s.checkRow} onClick={() => setForm(p => ({ ...p, majeur: v }))}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${form.majeur === v ? accent : '#CCC'}`, background: form.majeur === v ? accent : 'white', flexShrink: 0, marginTop: 1 }}>
                    {form.majeur === v && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', margin: '5px auto' }} />}
                  </div>
                  <span style={{ fontSize: 14 }}>{v ? t.majeurLabel : t.mineurLabel}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉTAPE 2 — Contre-indications */}
        {step === 2 && (
          <div style={s.card}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{t.step2}</h2>
            <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>{t.contraTitle}</p>
            {allContraKeys.map(k => (
              <div key={k} style={s.checkRow} onClick={() => toggleContra(k)}>
                <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${contras[k] ? '#C0392B' : '#CCC'}`, background: contras[k] ? '#C0392B' : 'white', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {contras[k] && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 14, lineHeight: 1.4 }}>{t.contras[k]}</span>
              </div>
            ))}
            {contras['autre'] && (
              <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(192,57,43,.05)', border: '1.5px solid rgba(192,57,43,.25)', borderRadius: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                  ⚠️ Précisez / Please specify / Por favor especifique
                </label>
                <textarea
                  value={autreDetail}
                  onChange={e => setAutreDetail(e.target.value)}
                  placeholder="Décrivez votre condition / Describe your condition / Describa su condición..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(192,57,43,.3)', borderRadius: 8,
                    fontSize: 13, fontFamily: 'Inter, sans-serif', background: 'white', color: txt,
                    resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9F9F9', borderRadius: 10, fontSize: 13, color: muted }}>
              ℹ️ {t.none} — laissez tout décoché / Leave all unchecked
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Consentements */}
        {step === 3 && (
          <div style={s.card}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{t.step3}</h2>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t.consentTitle}</p>
            {t.consents.map((text, i) => (
              <div key={i} style={s.checkRow} onClick={() => toggleConsent(i)}>
                <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${consents[i] ? '#1A8C5A' : '#CCC'}`, background: consents[i] ? '#1A8C5A' : 'white', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {consents[i] && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, borderTop: '1px solid #EEE', paddingTop: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📸 Photos / Réseaux sociaux</p>
              {[true, false].map(v => (
                <div key={String(v)} style={s.checkRow} onClick={() => setPhoto(v)}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${photo === v ? accent : '#CCC'}`, background: photo === v ? accent : 'white', flexShrink: 0, marginTop: 1 }}>
                    {photo === v && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', margin: '5px auto' }} />}
                  </div>
                  <span style={{ fontSize: 13 }}>{v ? t.photoOk : t.photoNo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ÉTAPE 4 — Signature */}
        {step === 4 && (
          <div style={s.card}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{t.sigTitle}</h2>
            <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>{t.sigHint}</p>
            <SignatureCanvas onSign={setSig} cleared={sigCleared} />
            <button onClick={() => { setSigCleared(c => !c); setSig(null) }}
              style={{ ...s.btnGhost, marginTop: 10, width: '100%' }}>
              ↺ {t.sigClear}
            </button>
            {sig && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(26,140,90,.06)', border: '1px solid rgba(26,140,90,.2)', borderRadius: 10, fontSize: 13, color: '#1A8C5A', fontWeight: 700 }}>
                ✅ Signature enregistrée / Signature recorded
              </div>
            )}
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.2)', borderRadius: 12, fontSize: 13, color: '#C0392B', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && (
            <button onClick={() => { setStep(s => s - 1); setError('') }} style={{ ...s.btnGhost, flex: 1 }}>
              {t.back}
            </button>
          )}
          {step < 4 ? (
            <button onClick={() => { if (validateStep()) setStep(s => s + 1) }} style={{ ...s.btnPrim, flex: 2 }}>
              {t.next}
            </button>
          ) : (
            <button onClick={submit} disabled={saving} style={{ ...s.btnPrim, flex: 2, background: saving ? '#888' : accent }}>
              {saving ? t.saving : t.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
