const fileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export async function uploadFile(file, { inbox = false } = {}) {
  const mime = inbox && /\.csv$/i.test(file.name) ? 'text/csv' : file.type
  if ((!fileTypes.includes(mime) && !(inbox && mime === 'text/csv')) || file.size > 3 * 1024 * 1024) throw new Error('Choisis un PDF, JPEG, PNG ou WebP de 3 Mo maximum.')
  const encoded = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
  const response = await fetch('/api/gestoria-file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, mime, base64: encoded, ...(inbox && { inbox: true }) }) })
  const result = await response.json()
  if (response.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired'))
  if (!response.ok) throw new Error(result.error || 'Pièce non enregistrée.')
  return result
}

export const attachmentUrl = file => '/api/gestoria-file?id=' + file.id + '&name=' + encodeURIComponent(file.name)
