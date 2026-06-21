const BREVO_KEY = process.env.BREVO_API_KEY

const HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;background:#ffffff;border-collapse:collapse;">
<tr><td style="height:4px;background:#C9893A;font-size:0;line-height:4px;"></td></tr>
<tr><td align="center" style="padding:48px 60px 40px;text-align:center;">
  <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#1A1A1A;letter-spacing:5px;text-transform:uppercase;">BLACKTHORN TATTOO</p>
  <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:11px;color:#aaa;letter-spacing:3px;text-transform:uppercase;">CAMPOS · MALLORCA</p>
  <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:#1A1A1A;letter-spacing:3px;text-transform:uppercase;">PRENDS SOIN DE TON TATOUAGE</p>
</td></tr>
<tr><td style="height:1px;background:#C9893A;font-size:0;"></td></tr>
<tr><td style="padding:36px 60px 28px;">
  <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#333;line-height:1.9;text-align:center;font-style:italic;">Merci pour ta confiance. Voici nos conseils pour une cicatrisation parfaite.</p>
</td></tr>
<tr><td style="padding:0 60px 36px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">1</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">🎬 Film protecteur</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Retirer après <strong>2 heures</strong></p></td></tr>
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">2</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">🚿 Nettoyage</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Eau tiède + savon neutre, 2x/jour — tamponner sans frotter</p></td></tr>
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">3</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">💧 Hydratation</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Cicatryl / Cicalphate · Couche fine, 2–3x/jour · <strong>2 semaines</strong></p></td></tr>
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">4</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">☀️ Soleil / mer / piscine</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Éviter <strong>3 semaines</strong> minimum</p></td></tr>
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">5</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">🚫 Ne pas gratter</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Ne pas arracher les croûtes</p></td></tr>
    <tr><td width="44" valign="top" style="padding-bottom:18px;"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">6</div></td>
    <td valign="top" style="padding-bottom:18px;"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">👕 Vêtements</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">Éviter les vêtements serrés sur la zone</p></td></tr>
    <tr><td width="44" valign="top"><div style="width:32px;height:32px;background:#C9893A;border-radius:50%;text-align:center;line-height:32px;font-family:Georgia,serif;font-size:12px;font-weight:bold;color:#fff;">7</div></td>
    <td valign="top"><p style="margin:0 0 3px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#1A1A1A;">✅ Après cicatrisation</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#555;line-height:1.6;">SPF 50+ au soleil pour garder les couleurs</p></td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 60px 36px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#fff5f5;border-left:3px solid #C0392B;padding:16px 20px 16px 22px;"><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#8b0000;line-height:1.7;"><strong>⚠️ Consulter un médecin si :</strong> rougeur excessive, gonflement, chaleur persistante, écoulement ou fièvre.</p></td></tr></table></td></tr>
<tr><td style="height:4px;background:#C9893A;font-size:0;"></td></tr>
<tr><td align="center" style="padding:32px 60px 40px;text-align:center;background:#fafaf8;">
  <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#1A1A1A;">@blackthorntattoo_campos</p>
  <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;color:#C9893A;">blackthorntattoocampos.ink</p>
  <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:13px;color:#555;">WhatsApp : +34 601 571 142</p>
  <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#bbb;font-style:italic;">Email automatique — merci de ne pas répondre</p>
</td></tr>
</table>
</body></html>`

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, client, lang, date, style } = req.body
  if (!email) return res.status(400).json({ error: 'email requis' })

  const subjects = {
    fr: '🖤 Prends soin de ton tatouage — Blackthorn Tattoo',
    en: '🖤 Take care of your tattoo — Blackthorn Tattoo',
    es: '🖤 Cuida tu tatuaje — Blackthorn Tattoo',
    de: '🖤 Pflege dein Tattoo — Blackthorn Tattoo',
    ca: '🖤 Cuida el teu tatuatge — Blackthorn Tattoo',
  }
  const subject = subjects[lang] || subjects.fr

  const payload = {
    to: [{ email, name: client || 'Client' }],
    sender: { name: 'Blackthorn Tattoo', email: 'amely.attias@gmail.com' },
    subject,
    htmlContent: HTML,
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await resp.json()
    if (!resp.ok) return res.status(500).json({ error: data.message || 'Erreur Brevo' })
    return res.json({ ok: true, messageId: data.messageId })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
// redeploy
