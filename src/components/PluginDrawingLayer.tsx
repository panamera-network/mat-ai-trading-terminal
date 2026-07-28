import { useEffect, useMemo, useRef } from 'react'
import { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import {
  DrawingManager,
  getToolRegistry,
  type Anchor,
  type IDrawing,
} from 'lightweight-charts-drawing'
import { DrawingType } from '@/types'

interface PluginDrawingLayerProps {
  chart: IChartApi
  series: ISeriesApi<SeriesType>
  container: HTMLElement | null
  activeTool: DrawingType
  onToolSelect: (tool: string) => void
  onDrawingInteractionChange?: (isInteracting: boolean) => void
}

const TOOL_MAP: Partial<Record<DrawingType, string>> = {
  trendline: 'trend-line',
  horizontal: 'horizontal-line',
  vertical: 'vertical-line',
  ray: 'ray',
  arrow: 'arrow',
  extended: 'extended-line',
  crossLine: 'cross-line',
  infoLine: 'info-line',
  trendAngle: 'trend-angle',
  horizontalRay: 'horizontal-ray',
  rectangle: 'rectangle',
  circle: 'circle',
  priceRange: 'price-range',
  regressionTrend: 'regression-trend',
  fibonacci: 'fib-retracement',
  fibTimeZone: 'fib-time-zone',
  fibSpeedFan: 'fib-speed-fan',
  fibCircles: 'fib-circles',
  fibSpiral: 'fib-spiral',
  fibArcs: 'fib-arcs',
  gannBox: 'gann-box',
  gannFan: 'gann-fan',
  gannSquareFixed: 'gann-square-fixed',
  gannSquare: 'gann-square',
  dateRange: 'date-range',
  datePriceRange: 'date-price-range',
  fibonacciExtension: 'fib-extension',
  parallel: 'parallel-channel',
  callout: 'callout',
  brush: 'brush',
  highlighter: 'highlighter',
  arrowMarker: 'arrow-marker',
  arrowMarkUp: 'arrow-mark-up',
  arrowMarkDown: 'arrow-mark-down',
  note: 'note',
  priceNote: 'price-note',
  priceLabel: 'price-label',
  flagMark: 'flag-mark',
  pin: 'pin',
  comment: 'comment',
  signpost: 'signpost',
  table: 'table',
  forecast: 'forecast',
  ellipse: 'ellipse',
  path: 'path',
  polyline: 'polyline',
  text: 'text-annotation',
}

const TOOL_COLORS: Record<string, string> = {
  'horizontal-line': '#60a5fa',
  'vertical-line': '#60a5fa',
  rectangle: '#8b5cf6',
  circle: '#8b5cf6',
  'fib-retracement': '#fbbf24',
  'fib-extension': '#fbbf24',
  'parallel-channel': '#22d3ee',
  'text-annotation': '#FFFFFF',
  brush: '#60a5fa',
  highlighter: '#fbbf24',
  'arrow-marker': '#22c55e',
  'arrow-mark-up': '#22c55e',
  'arrow-mark-down': '#ef4444',
}

export function isPluginDrawingTool(tool: DrawingType | string): boolean {
  return Boolean(TOOL_MAP[tool as DrawingType])
}

export default function PluginDrawingLayer({
  chart,
  series,
  container,
  activeTool,
  onToolSelect,
  onDrawingInteractionChange,
}: PluginDrawingLayerProps) {
  const managerRef = useRef<DrawingManager | null>(null)
  const pendingAnchorsRef = useRef<Anchor[]>([])
  const previewDrawingRef = useRef<IDrawing | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const idCounterRef = useRef(0)
  const activeToolRef = useRef(activeTool)
  const onToolSelectRef = useRef(onToolSelect)
  const onDrawingInteractionChangeRef = useRef(onDrawingInteractionChange)
  const previewId = useMemo(() => `__preview_${Math.random().toString(36).slice(2)}__`, [])

  const setChartDrawingMode = (enabled: boolean) => {
    chart.applyOptions({
      handleScroll: {
        mouseWheel: !enabled,
        pressedMouseMove: !enabled,
        horzTouchDrag: !enabled,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: !enabled,
        mouseWheel: !enabled,
        pinch: !enabled,
      },
    })
  }

  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  useEffect(() => {
    onToolSelectRef.current = onToolSelect
  }, [onToolSelect])

  useEffect(() => {
    onDrawingInteractionChangeRef.current = onDrawingInteractionChange
  }, [onDrawingInteractionChange])

  useEffect(() => {
    if (!container) return

    const manager = new DrawingManager()
    manager.attach(chart as any, series as any, container)
    managerRef.current = manager

    return () => {
      manager.detach()
      managerRef.current = null
      pendingAnchorsRef.current = []
      previewDrawingRef.current = null
    }
  }, [chart, series, container])

  useEffect(() => {
    if (!container) return

    const registry = getToolRegistry()

    const pointToAnchor = (event: MouseEvent): Anchor | null => {
      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const time = chart.timeScale().coordinateToTime(x)
      const price = series.coordinateToPrice(y)
      if (time === null || price === null) return null
      return { time: time as Time, price }
    }

    const getLocalPoint = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const restoreChartInteraction = () => {
      const toolType = TOOL_MAP[activeToolRef.current as DrawingType]
      setChartDrawingMode(Boolean(toolType) || pendingAnchorsRef.current.length > 0)
    }

    const hasDragged = (event: MouseEvent) => {
      if (!dragStartRef.current) return false
      const point = getLocalPoint(event)
      return Math.hypot(point.x - dragStartRef.current.x, point.y - dragStartRef.current.y) > 4
    }

    const removePreview = () => {
      const manager = managerRef.current
      if (manager && previewDrawingRef.current) {
        manager.removeDrawing(previewId)
      }
      previewDrawingRef.current = null
    }

    const resetDrawingState = () => {
      removePreview()
      pendingAnchorsRef.current = []
      dragStartRef.current = null
      onDrawingInteractionChangeRef.current?.(false)
      setChartDrawingMode(false)
    }

    const createDrawing = (toolType: string, anchors: Anchor[], preview = false) => {
      const manager = managerRef.current
      if (!manager) return null

      const color = TOOL_COLORS[toolType] || '#8b5cf6'
      const drawing = registry.createDrawing(
        toolType,
        preview ? previewId : `drawing-${++idCounterRef.current}`,
        anchors,
        {
          lineColor: color,
          lineWidth: 2,
          fillColor: `${color}33`,
        }
      )

      if (!drawing) return null
      manager.addDrawing(drawing)
      if (!preview) manager.selectDrawing(drawing.id)
      return drawing
    }

    const updatePreview = (toolType: string, anchor: Anchor) => {
      const tool = registry.get(toolType)
      if (!tool) return

      const previewAnchors = [...pendingAnchorsRef.current]
      while (previewAnchors.length < tool.requiredAnchors) {
        previewAnchors.push({ ...anchor })
      }

      if (!previewDrawingRef.current) {
        previewDrawingRef.current = createDrawing(toolType, previewAnchors, true)
        return
      }

      const updateIndex = Math.min(pendingAnchorsRef.current.length, tool.requiredAnchors - 1)
      previewDrawingRef.current.updateAnchor(updateIndex, anchor)
    }

    const finishDrawing = (toolType: string, anchor: Anchor) => {
      const tool = registry.get(toolType)
      if (!tool) return

      const anchors = [...pendingAnchorsRef.current]
      if (anchors.length < tool.requiredAnchors) {
        anchors.push(anchor)
      }

      removePreview()
      if (anchors.length >= tool.requiredAnchors) {
        createDrawing(toolType, anchors)
        pendingAnchorsRef.current = []
        dragStartRef.current = null
        onToolSelectRef.current('cursor')
        onDrawingInteractionChangeRef.current?.(false)
        setChartDrawingMode(false)
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      const toolType = TOOL_MAP[activeToolRef.current as DrawingType]
      if (!toolType) return

      const tool = registry.get(toolType)
      const anchor = pointToAnchor(event)
      if (!tool || !anchor) return

      event.preventDefault()
      event.stopPropagation()

      if (tool.requiredAnchors > 1 && pendingAnchorsRef.current.length > 0) {
        dragStartRef.current = getLocalPoint(event)
        return
      }

      pendingAnchorsRef.current = [anchor]
      dragStartRef.current = getLocalPoint(event)
      onDrawingInteractionChangeRef.current?.(true)
      setChartDrawingMode(true)

      if (tool.requiredAnchors === 1) {
        removePreview()
        createDrawing(toolType, [anchor])
        pendingAnchorsRef.current = []
        onToolSelectRef.current('cursor')
      } else {
        updatePreview(toolType, anchor)
      }
    }

    const handleSelectionMouseDownCapture = (event: MouseEvent) => {
      const manager = managerRef.current
      if (!manager || TOOL_MAP[activeToolRef.current as DrawingType]) return
      if (!manager.getSelectedDrawing()) return

      const anchorIndex = manager.hitTestAnchor(getLocalPoint(event))
      if (anchorIndex === null) return

      setChartDrawingMode(true)
      onDrawingInteractionChangeRef.current?.(true)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const toolType = TOOL_MAP[activeToolRef.current as DrawingType]
      if (!toolType || pendingAnchorsRef.current.length === 0) return

      const anchor = pointToAnchor(event)
      if (!anchor) return
      event.preventDefault()
      event.stopPropagation()
      updatePreview(toolType, anchor)
    }

    const handleMouseUp = (event: MouseEvent) => {
      const toolType = TOOL_MAP[activeToolRef.current as DrawingType]
      if (!toolType || pendingAnchorsRef.current.length === 0) return

      const anchor = pointToAnchor(event)
      if (!anchor) return

      event.preventDefault()
      event.stopPropagation()
      if (hasDragged(event)) {
        finishDrawing(toolType, anchor)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const toolType = TOOL_MAP[activeToolRef.current as DrawingType]
      if (!toolType) return

      const tool = registry.get(toolType)
      const anchor = pointToAnchor(event)
      if (!tool || !anchor || tool.requiredAnchors === 1) return

      event.preventDefault()
      event.stopPropagation()

      if (pendingAnchorsRef.current.length === 0) {
        pendingAnchorsRef.current = [anchor]
        dragStartRef.current = getLocalPoint(event)
        updatePreview(toolType, anchor)
        onDrawingInteractionChangeRef.current?.(true)
        setChartDrawingMode(true)
        return
      }

      const first = pendingAnchorsRef.current[0]
      if (first.time === anchor.time && Math.abs(first.price - anchor.price) < 0.0000001) return
      finishDrawing(toolType, anchor)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetDrawingState()
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const manager = managerRef.current
      const selectedDrawing = manager?.getSelectedDrawing()
      if (!manager || !selectedDrawing) return

      event.preventDefault()
      manager.removeDrawing(selectedDrawing.id)
    }

    const handleWindowMouseUp = () => {
      if (pendingAnchorsRef.current.length > 0) return
      restoreChartInteraction()
      onDrawingInteractionChangeRef.current?.(false)
    }

    container.addEventListener('mousedown', handleSelectionMouseDownCapture, true)
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleSelectionMouseDownCapture, true)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      removePreview()
      pendingAnchorsRef.current = []
      dragStartRef.current = null
      setChartDrawingMode(false)
    }
  }, [chart, series, container, previewId])

  useEffect(() => {
    const isDrawingTool = isPluginDrawingTool(activeTool)
    managerRef.current?.setActiveTool(isDrawingTool ? TOOL_MAP[activeTool as DrawingType]! : null)
    setChartDrawingMode(isDrawingTool || pendingAnchorsRef.current.length > 0)
  }, [activeTool])

  return null
}
