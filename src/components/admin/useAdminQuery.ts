import { useCallback, useEffect, useRef, useState } from 'react'

export function useAdminQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [revision, setRevision] = useState(0)
  const lifecycle = useRef({ sequence: 0 })
  useEffect(() => {
    const active = lifecycle.current
    const request = ++active.sequence
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null)
      void load().then(result => { if (request === active.sequence) setData(result) })
        .catch(cause => { if (request === active.sequence) { setData(null); setError(cause instanceof Error ? cause : new Error('No pudimos cargar los datos.')) } })
        .finally(() => { if (request === active.sequence) setLoading(false) })
    }, 220)
    return () => { window.clearTimeout(timer); active.sequence++ }
  }, [load, revision])
  const reload = useCallback(() => setRevision(value => value + 1), [])
  return { data, loading, error, reload }
}
