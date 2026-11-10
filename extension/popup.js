const app = 'https://mi-gestoria-amely.vercel.app'
const button = document.querySelector('#read')
const feedback = document.querySelector('#feedback')
const allowedHosts = new Set([
  'portal.seg-social.gob.es', 'sede.seg-social.gob.es', 'sede-tu.seg-social.gob.es', 'w6.seg-social.es',
  'sede.agenciatributaria.gob.es', 'www1.agenciatributaria.gob.es',
  'www2.agenciatributaria.gob.es', 'www3.agenciatributaria.gob.es',
])

button.addEventListener('click', async () => {
  button.disabled = true
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    const page = active?.url && new URL(active.url)
    if (!page || page.protocol !== 'https:' || !allowedHosts.has(page.hostname)) {
      feedback.textContent = 'Ouvre une page de résultats Hacienda ou Importass, puis réessaie depuis cet onglet.'
      return
    }
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: active.id }, func: readPortalPage })
    if (!result) {
      feedback.textContent = 'Aucun tableau reconnu. Affiche les résultats en espagnol après avoir lancé la recherche.'
      return
    }
    const tabs = await chrome.tabs.query({ url: app + '/*', currentWindow: true })
    const target = tabs.find(tab => new URL(tab.url).pathname === '/') ||
      await chrome.tabs.create({ url: app, active: false })
    const deliver = () => chrome.scripting.executeScript({
      target: { tabId: target.id }, args: [result],
      func: capture => {
        if (location.origin !== 'https://mi-gestoria-amely.vercel.app') return false
        sessionStorage.setItem('mi-gestoria-portal-capture-v1', JSON.stringify(capture))
        window.dispatchEvent(new Event('mi-gestoria-portal-capture'))
        return true
      },
    })
    let sent = false
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const [delivery] = await deliver()
        if (delivery.result) { sent = true; break }
      } catch {
        // A newly opened tab may still be loading the application origin.
      }
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    if (!sent) throw new Error('Capture delivery failed')
    await chrome.tabs.update(target.id, { active: true })
  } catch {
    feedback.textContent = 'La lecture a échoué. Ouvre Mi Gestoría dans cette fenêtre et réessaie.'
  } finally {
    button.disabled = false
  }
})
