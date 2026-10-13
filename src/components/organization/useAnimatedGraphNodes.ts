import { useEffect, useRef, useState } from 'react'
import type { ChartNode } from './OrganizationNode'

export function useAnimatedGraphNodes(target: ChartNode[], reducedMotion: boolean) {
  const [nodes, setNodes] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    const previous = new Map(current.current.map(node => [node.id, node]))
    const targetIds = new Set(target.map(node => node.id))
    const exiting = current.current.filter(node => !targetIds.has(node.id)).map(node => ({ ...node, className: 'organization-node-leaving' }))
    const duration = reducedMotion || target.length > 80 ? 0 : 210
    let frame = 0
    const started = performance.now()
    const animate = (now: number) => {
      const progress = duration ? Math.min(1, (now - started) / duration) : 1
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = target.map(node => {
        const old = previous.get(node.id)
        return old ? { ...node, position: { x: old.position.x + (node.position.x - old.position.x) * eased, y: old.position.y + (node.position.y - old.position.y) * eased } } : node
      })
      current.current = progress < 1 ? [...next, ...exiting] : next
      setNodes(current.current)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [target, reducedMotion])
  return nodes
}
