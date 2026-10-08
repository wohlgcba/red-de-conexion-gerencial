import { useMemo, useSyncExternalStore } from 'react'

function createObjectUrlResource(file: Blob | null) {
  let url = ''
  return {
    getSnapshot: () => url,
    subscribe: (notify: () => void) => {
      if (!file) return () => {}
      url = URL.createObjectURL(file)
      notify()
      return () => { URL.revokeObjectURL(url); url = '' }
    },
  }
}

export function useObjectUrl(file: Blob | null) {
  const resource = useMemo(() => createObjectUrlResource(file), [file])
  return useSyncExternalStore(resource.subscribe, resource.getSnapshot, () => '')
}
