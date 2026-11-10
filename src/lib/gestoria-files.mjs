const fileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export async function uploadFile(file) {
  if (!fileTypes.includes(file.type) || file.size > 3 * 1024 * 1024) throw new Error('Choisis un PDF, JPEG, PNG ou WebP de 3 Mo maximum.')
  const encoded = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
  const response = await fetch('/api/gestoria-file', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, mime: file.type, base64: encoded }) })
  const result = await response.json()
  if (response.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired'))
  if (!response.ok) throw new Error(result.error || 'Pièce non enregistrée.')
  return result
}

export const attachmentUrl = file => '/api/gestoria-file?id=' + file.id + '&name=' + encodeURIComponent(file.name)
