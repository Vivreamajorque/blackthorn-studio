import { useEffect, useRef, useState } from 'react'

const path = '/api/gestoria-workspace'
const empty = { entries: [], records: {} }

function checkSession(response) {
  if (response.status === 401) window.dispatchEvent(new Event('gestoria-auth-expired'))
}

export function useGestoriaWorkspace() {
  const [workspace, setWorkspace] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [request, setRequest] = useState(0)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const pending = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = false
    async function load(background = false) {
      if (active || pending.current) return
      active = true
      const version = generation.current
      try {
        const response = await fetch(path, { cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        checkSession(response)
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (controller.signal.aborted || generation.current !== version || pending.current) return
        setWorkspace(data)
        setLoadState('ready')
      } catch {
        if (!background && !controller.signal.aborted) setLoadState('error')
      } finally {
        active = false
      }
    }
    load()
    const whenVisible = () => { if (!document.hidden) load(true) }
    window.addEventListener('focus', whenVisible)
    const timer = window.setInterval(whenVisible, 60000)
    return () => {
      controller.abort()
      window.removeEventListener('focus', whenVisible)
      window.clearInterval(timer)
    }
  }, [request])

  async function save(update) {
    if (!workspace || pending.current) return false
    pending.current = true
    generation.current++
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: workspace.revision, data: update(workspace.data) }),
      })
      checkSession(response)
      const result = await response.json()
      if (response.status === 409) {
        setWorkspace(result)
        throw new Error('Le dossier a changé dans une autre fenêtre. Il a été rechargé. Vérifie la dernière version avant de réessayer.')
      }
      if (!response.ok) throw new Error(result.error)
      setWorkspace(result)
      setFeedback({ text: 'Enregistré dans ton dossier.' })
      return true
    } catch (error) {
      setFeedback({ error: true, text: error instanceof TypeError || !error.message
        ? 'Enregistrement non confirmé. Recharge le dossier pour vérifier avant de réessayer.'
        : error.message })
      return false
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  function reload() {
    setLoadState('loading')
    setRequest(previous => previous + 1)
  }

  return { data: workspace?.data || empty, personalStart: workspace?.personalStart, loadState, saving, feedback, save, reload }
}
