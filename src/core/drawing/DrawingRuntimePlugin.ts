import { Time } from 'lightweight-charts'
import {
  DrawingManager,
  getToolRegistry,
  type Anchor,
  type IDrawing,
} from 'lightweight-charts-drawing'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import { DrawingType } from '@/types'

interface DrawingRuntimePluginOptions {
  container: HTMLElement
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

export function isDrawingRuntimeTool(tool: DrawingType | string): boolean {
  return Boolean(TOOL_MAP[tool as DrawingType])
}

export class DrawingRuntimePlugin implements ChartPlugin {
  readonly id = 'drawing-runtime'

  private context: ChartPluginContext | null = null
  private manager: DrawingManager | null = null
  private pendingAnchors: Anchor[] = []
  private previewDrawing: IDrawing | null = null
  private dragStart: { x: number; y: number } | null = null
  private idCounter = 0
  private activeTool: DrawingType | string = 'cursor'
  private releaseInteractionLock: (() => void) | null = null
  private readonly previewId = `__preview_${Math.random().toString(36).slice(2)}__`
  private readonly registry = getToolRegistry()
  private cleanupListeners: (() => void) | null = null
  private onToolSelect: (tool: string) => void
  private onDrawingInteractionChange?: (isInteracting: boolean) => void

  constructor(private readonly options: DrawingRuntimePluginOptions) {
    this.onToolSelect = options.onToolSelect
    this.onDrawingInteractionChange = options.onDrawingInteractionChange
  }

  initialize(context: ChartPluginContext) {
    this.context = context
    this.manager = new DrawingManager()
    this.manager.attach(context.chart as any, context.mainSeries as any, this.options.container)
    this.attachListeners()
  }

  setCallbacks(callbacks: Pick<DrawingRuntimePluginOptions, 'onToolSelect' | 'onDrawingInteractionChange'>) {
    this.onToolSelect = callbacks.onToolSelect
    this.onDrawingInteractionChange = callbacks.onDrawingInteractionChange
  }

  setActiveTool(tool: DrawingType | string) {
    this.activeTool = tool
    const toolType = TOOL_MAP[tool as DrawingType]
    this.manager?.setActiveTool(toolType || null)
    this.setInteractionLocked(Boolean(toolType) || this.pendingAnchors.length > 0)
  }

  setMagnetEnabled(_enabled: boolean) {
    // Magnet state is intentionally left at the current runtime behavior for this boundary slice.
  }

  deleteSelected() {
    const selectedDrawing = this.manager?.getSelectedDrawing()
    if (!this.manager || !selectedDrawing) return
    this.manager.removeDrawing(selectedDrawing.id)
  }

  clearDrawings() {
    this.cancelActiveOperation()
    this.manager?.clearAll()
  }

  cancelActiveOperation() {
    this.removePreview()
    this.pendingAnchors = []
    this.dragStart = null
    this.onDrawingInteractionChange?.(false)
    this.setInteractionLocked(false)
  }

  getSelectedDrawingId(): string | null {
    return this.manager?.getSelectedDrawing()?.id || null
  }

  destroy() {
    this.cleanupListeners?.()
    this.cleanupListeners = null
    this.cancelActiveOperation()
    this.manager?.detach()
    this.manager = null
    this.context = null
  }

  private attachListeners() {
    const container = this.options.container

    const handleSelectionMouseDownCapture = (event: MouseEvent) => {
      const manager = this.manager
      if (!manager || TOOL_MAP[this.activeTool as DrawingType]) return
      if (!manager.getSelectedDrawing()) return

      const anchorIndex = manager.hitTestAnchor(this.getLocalPoint(event))
      if (anchorIndex === null) return

      this.setInteractionLocked(true)
      this.onDrawingInteractionChange?.(true)
    }

    const handleMouseDown = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType) return

      const tool = this.registry.get(toolType)
      const anchor = this.pointToAnchor(event)
      if (!tool || !anchor) return

      event.preventDefault()
      event.stopPropagation()

      if (tool.requiredAnchors > 1 && this.pendingAnchors.length > 0) {
        this.dragStart = this.getLocalPoint(event)
        return
      }

      this.pendingAnchors = [anchor]
      this.dragStart = this.getLocalPoint(event)
      this.onDrawingInteractionChange?.(true)
      this.setInteractionLocked(true)

      if (tool.requiredAnchors === 1) {
        this.removePreview()
        this.createDrawing(toolType, [anchor])
        this.pendingAnchors = []
        this.onToolSelect('cursor')
      } else {
        this.updatePreview(toolType, anchor)
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType || this.pendingAnchors.length === 0) return

      const anchor = this.pointToAnchor(event)
      if (!anchor) return
      event.preventDefault()
      event.stopPropagation()
      this.updatePreview(toolType, anchor)
    }

    const handleMouseUp = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType || this.pendingAnchors.length === 0) return

      const anchor = this.pointToAnchor(event)
      if (!anchor) return

      event.preventDefault()
      event.stopPropagation()
      if (this.hasDragged(event)) {
        this.finishDrawing(toolType, anchor)
      }
    }

    const handleClick = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType) return

      const tool = this.registry.get(toolType)
      const anchor = this.pointToAnchor(event)
      if (!tool || !anchor || tool.requiredAnchors === 1) return

      event.preventDefault()
      event.stopPropagation()

      if (this.pendingAnchors.length === 0) {
        this.pendingAnchors = [anchor]
        this.dragStart = this.getLocalPoint(event)
        this.updatePreview(toolType, anchor)
        this.onDrawingInteractionChange?.(true)
        this.setInteractionLocked(true)
        return
      }

      const first = this.pendingAnchors[0]
      if (first.time === anchor.time && Math.abs(first.price - anchor.price) < 0.0000001) return
      this.finishDrawing(toolType, anchor)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelActiveOperation()
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const selectedDrawing = this.manager?.getSelectedDrawing()
      if (!this.manager || !selectedDrawing) return

      event.preventDefault()
      this.manager.removeDrawing(selectedDrawing.id)
    }

    const handleWindowMouseUp = () => {
      if (this.pendingAnchors.length > 0) return
      this.restoreChartInteraction()
      this.onDrawingInteractionChange?.(false)
    }

    container.addEventListener('mousedown', handleSelectionMouseDownCapture, true)
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mouseup', handleWindowMouseUp)

    this.cleanupListeners = () => {
      container.removeEventListener('mousedown', handleSelectionMouseDownCapture, true)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }

  private pointToAnchor(event: MouseEvent): Anchor | null {
    if (!this.context) return null
    const rect = this.options.container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const time = this.context.chart.timeScale().coordinateToTime(x)
    const price = this.context.mainSeries.coordinateToPrice(y)
    if (time === null || price === null) return null
    return { time: time as Time, price }
  }

  private getLocalPoint(event: MouseEvent) {
    const rect = this.options.container.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private restoreChartInteraction() {
    const toolType = TOOL_MAP[this.activeTool as DrawingType]
    this.setInteractionLocked(Boolean(toolType) || this.pendingAnchors.length > 0)
  }

  private hasDragged(event: MouseEvent) {
    if (!this.dragStart) return false
    const point = this.getLocalPoint(event)
    return Math.hypot(point.x - this.dragStart.x, point.y - this.dragStart.y) > 4
  }

  private removePreview() {
    if (this.manager && this.previewDrawing) {
      this.manager.removeDrawing(this.previewId)
    }
    this.previewDrawing = null
  }

  private createDrawing(toolType: string, anchors: Anchor[], preview = false) {
    if (!this.manager) return null

    const color = TOOL_COLORS[toolType] || '#8b5cf6'
    const drawing = this.registry.createDrawing(
      toolType,
      preview ? this.previewId : `drawing-${++this.idCounter}`,
      anchors,
      {
        lineColor: color,
        lineWidth: 2,
        fillColor: `${color}33`,
      }
    )

    if (!drawing) return null
    this.manager.addDrawing(drawing)
    if (!preview) this.manager.selectDrawing(drawing.id)
    return drawing
  }

  private updatePreview(toolType: string, anchor: Anchor) {
    const tool = this.registry.get(toolType)
    if (!tool) return

    const previewAnchors = [...this.pendingAnchors]
    while (previewAnchors.length < tool.requiredAnchors) {
      previewAnchors.push({ ...anchor })
    }

    if (!this.previewDrawing) {
      this.previewDrawing = this.createDrawing(toolType, previewAnchors, true)
      return
    }

    const updateIndex = Math.min(this.pendingAnchors.length, tool.requiredAnchors - 1)
    this.previewDrawing.updateAnchor(updateIndex, anchor)
  }

  private finishDrawing(toolType: string, anchor: Anchor) {
    const tool = this.registry.get(toolType)
    if (!tool) return

    const anchors = [...this.pendingAnchors]
    if (anchors.length < tool.requiredAnchors) {
      anchors.push(anchor)
    }

    this.removePreview()
    if (anchors.length >= tool.requiredAnchors) {
      this.createDrawing(toolType, anchors)
      this.pendingAnchors = []
      this.dragStart = null
      this.onToolSelect('cursor')
      this.onDrawingInteractionChange?.(false)
      this.setInteractionLocked(false)
    }
  }

  private setInteractionLocked(enabled: boolean) {
    if (enabled) {
      if (!this.releaseInteractionLock) {
        this.releaseInteractionLock = this.context?.requestInteractionLock('drawing') || null
      }
      return
    }

    this.releaseInteractionLock?.()
    this.releaseInteractionLock = null
  }
}
