import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import { Focus, Maximize, Minus, Move, Plus, RotateCcw } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import { Button } from '../common/UI'
import { useCatalog } from '../../app/useCatalog'
import { OrganizationNode } from './OrganizationNode'
import type { ChartNode, OrganizationNodeData } from './OrganizationNode'
import type { OrganizationIndex } from './organizationModel'
import { layoutOrganizationGraph, NODE_HEIGHT, NODE_WIDTH } from './organizationGraph'
import type { VisibleOrganizationGraph } from './organizationGraph'
import { useAnimatedGraphNodes } from './useAnimatedGraphNodes'

const NODE_TYPES = { organization: OrganizationNode }
export interface OrganizationViewRequest { id: string; sequence: number; mode: 'center' | 'overview' | 'anchor' }
export interface OrganizationCanvasProps {
  index: OrganizationIndex; graph: VisibleOrganizationGraph; selectedId: string; expanded: ReadonlySet<string>; scope: string
  request: OrganizationViewRequest; reducedMotion: boolean
  onActivate: (id: string) => void; onToggle: (id: string) => void; onDetail: (id: string) => void; onMore: (id: string) => void
}

function GraphControls({ selectedId, positions, reducedMotion, onReset }: { selectedId: string; positions: Map<string, { x: number; y: number }>; reducedMotion: boolean; onReset: () => void }) {
  const { zoom } = useViewport()
  const flow = useReactFlow()
  const duration = reducedMotion ? 0 : 210
  return <div className="organization-zoom-controls" aria-label="Controles del gráfico">
    <div><button type="button" aria-label="Alejar organigrama" onClick={() => { void flow.zoomOut({ duration }) }}><Minus size={17} /></button><output aria-label="Porcentaje de zoom">{Math.round(zoom * 100)}%</output><button type="button" aria-label="Acercar organigrama" onClick={() => { void flow.zoomIn({ duration }) }}><Plus size={17} /></button></div>
    <Button title="Ajustar todas las unidades visibles a pantalla" aria-label="Ajustar a pantalla" onClick={() => { void flow.fitView({ padding: .12, minZoom: .01, maxZoom: 1, duration }) }}><Maximize size={17} /></Button>
    <Button disabled={!positions.has(selectedId)} title="Centrar selección" aria-label="Centrar selección" onClick={() => { const point = positions.get(selectedId); if (point) void flow.setCenter(point.x + NODE_WIDTH / 2, point.y + NODE_HEIGHT / 2, { zoom: Math.max(.8, Math.min(1.15, zoom)), duration }) }}><Focus size={18} /></Button>
    <Button title="Restablecer vista" aria-label="Restablecer vista" onClick={onReset}><RotateCcw size={17} /></Button>
  </div>
}

function CanvasContent(props: OrganizationCanvasProps) {
  const { index, graph, selectedId, expanded, request, reducedMotion, onActivate, onToggle, onDetail, onMore } = props
  const { people } = useCatalog()
  const peopleById = useMemo(() => new Map(people.map(person => [person.id, person])), [people])
  const container = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(4)
  const [ready, setReady] = useState(false)
  const flow = useReactFlow<ChartNode>()
  const path = useMemo(() => new Set((index.path.get(selectedId) ?? []).map(unit => unit.id)), [index, selectedId])
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 1200
      setColumns(Math.max(2, Math.min(5, Math.floor((width - 40) / (NODE_WIDTH + 20)))))
    })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const positions = useMemo(() => layoutOrganizationGraph(graph, columns), [graph, columns])
  const keyboardFocus = useCallback((id: string) => {
    const point = positions.get(id)
    if (point) void flow.setCenter(point.x + NODE_WIDTH / 2, point.y + NODE_HEIGHT / 2, { zoom: Math.max(.85, flow.getZoom()), duration: reducedMotion ? 0 : 180 })
  }, [flow, positions, reducedMotion])
  const targetNodes = useMemo<ChartNode[]>(() => graph.nodes.map(unit => {
    const assignment = index.assignments.get(unit.id)?.[0]
    const data: OrganizationNodeData = { unit, assignment, person: assignment?.membership === 'member' && assignment.personId ? peopleById.get(assignment.personId) : undefined,
      childCount: index.children.get(unit.id)?.length ?? 0, hiddenCount: graph.hidden.get(unit.id) ?? 0, expanded: expanded.has(unit.id), highlighted: path.has(unit.id), onActivate, onToggle, onDetail, onMore, onFocus: keyboardFocus }
    return { id: unit.id, type: 'organization', data, position: positions.get(unit.id)!, width: NODE_WIDTH, height: NODE_HEIGHT, style: { width: NODE_WIDTH, height: NODE_HEIGHT, pointerEvents: 'all' }, selected: unit.id === selectedId, draggable: false, connectable: false, selectable: false, focusable: false }
  }), [graph, index, peopleById, expanded, path, positions, selectedId, onActivate, onToggle, onDetail, onMore, keyboardFocus])
  const nodes = useAnimatedGraphNodes(targetNodes, reducedMotion)
  const edges = useMemo(() => graph.edges.map(edge => ({ ...edge, type: 'smoothstep', selectable: false, focusable: false, pathOptions: { borderRadius: 5 }, style: { stroke: path.has(edge.source) && path.has(edge.target) ? '#1683c6' : '#95afc4', strokeWidth: path.has(edge.target) ? 2 : 1.4 } })), [graph, path])
  const positionsRef = useRef(positions)
  const previousPositions = useRef(positions)
  const applied = useRef(-1)
  useEffect(() => { positionsRef.current = positions }, [positions])
  const duration = reducedMotion ? 0 : 210
  const resetViewport = () => {
    const points = [...positionsRef.current.values()]
    if (!points.length) return
    const width = container.current?.clientWidth ?? 1200
    const chartWidth = Math.max(...points.map(point => point.x)) + NODE_WIDTH
    const zoom = Math.max(.8, Math.min(1, (width - 70) / Math.min(chartWidth, columns * (NODE_WIDTH + 36))))
    void flow.setViewport({ x: (width - chartWidth * zoom) / 2, y: 70, zoom }, { duration })
  }
  useEffect(() => {
    if (!ready) return
    const currentPoint = positions.get(request.id)
    const oldPoint = previousPositions.current.get(request.id)
    previousPositions.current = positions
    if (request.mode === 'anchor' && currentPoint && oldPoint) {
      const viewport = flow.getViewport()
      void flow.setViewport({ ...viewport, x: viewport.x - (currentPoint.x - oldPoint.x) * viewport.zoom, y: viewport.y - (currentPoint.y - oldPoint.y) * viewport.zoom }, { duration: reducedMotion ? 0 : 210 })
      applied.current = request.sequence
      return
    }
    if (applied.current === request.sequence && request.mode !== 'overview') return
    const timer = setTimeout(() => {
      const point = positionsRef.current.get(request.id)
      if (request.mode === 'overview') {
        const points = [...positionsRef.current.values()]
        const chartWidth = Math.max(...points.map(item => item.x)) + NODE_WIDTH
        const width = container.current?.clientWidth ?? 1200
        const zoom = Math.max(.8, Math.min(1, (width - 60) / chartWidth))
        void flow.setViewport({ x: (width - chartWidth * zoom) / 2, y: 70, zoom }, { duration: reducedMotion ? 0 : 210 })
      } else if (point) {
        const width = container.current?.clientWidth ?? 1200
        const height = container.current?.clientHeight ?? 620
        const zoom = Math.max(.85, Math.min(1.1, flow.getZoom()))
        void flow.setViewport({ x: width / 2 - (point.x + NODE_WIDTH / 2) * zoom, y: Math.min(height / 2, 170) - (point.y + NODE_HEIGHT / 2) * zoom, zoom }, { duration: reducedMotion ? 0 : 210 })
      }
      applied.current = request.sequence
    }, reducedMotion ? 0 : 40)
    return () => clearTimeout(timer)
  }, [ready, positions, request, flow, reducedMotion])
  return <div className="organization-canvas" ref={container}>
    <ReactFlow<ChartNode> nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} onInit={() => setReady(true)} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false} deleteKeyCode={null} disableKeyboardA11y
      onlyRenderVisibleElements={false} minZoom={.01} maxZoom={1.6} zoomOnScroll={false} zoomOnDoubleClick={false} panOnScroll={false} preventScrolling={false} zoomActivationKeyCode="Control" panOnDrag zoomOnPinch
      role="region" aria-label="Organigrama institucional interactivo">
      <Background color="#dce9f2" gap={22} size={1} variant={BackgroundVariant.Dots} />
      {graph.nodes.length > 24 && <MiniMap pannable zoomable nodeColor="#c7e5f4" maskColor="#edf8ffc9" ariaLabel="Vista general del gráfico" />}
    </ReactFlow>
    <GraphControls selectedId={selectedId} positions={positions} reducedMotion={reducedMotion} onReset={resetViewport} />
    <p className="organization-pan-help"><Move size={14} /> Arrastrá para explorar · Ctrl + rueda para zoom</p>
  </div>
}

export function OrganizationCanvas(props: OrganizationCanvasProps) {
  return <ReactFlowProvider><CanvasContent {...props} /></ReactFlowProvider>
}
