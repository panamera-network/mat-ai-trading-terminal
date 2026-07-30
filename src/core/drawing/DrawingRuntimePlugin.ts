import { Time } from 'lightweight-charts'
import {
  DrawingManager,
  getToolRegistry,
  type Anchor,
  type IDrawing,
} from 'lightweight-charts-drawing'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import { CandleData, DrawingType } from '@/types'
import { DrawingModel, DrawingPersistenceScope } from '@/core/drawing/DrawingModel'
import { DrawingPersistenceEngine } from '@/core/drawing/DrawingPersistenceEngine'
import {
  drawingModelToRuntimeDrawing,
  serializeRuntimeDrawings,
} from '@/core/drawing/DrawingSerializer'
import {
  DrawingSnapEngine,
  normalizeSnapTime,
  SnapAxis,
  SnapMode,
} from '@/core/drawing/DrawingSnapEngine'

interface DrawingRuntimePluginOptions {
  container: HTMLElement
  onToolSelect: (tool: string) => void
  onDrawingInteractionChange?: (isInteracting: boolean) => void
  persistenceScope?: DrawingPersistenceScope
  persistenceEngine?: DrawingPersistenceEngine
  magnetEnabled?: boolean
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
  private cleanupManagerEvents: (() => void) | null = null
  private persistenceEngine: DrawingPersistenceEngine
  private persistenceScope: DrawingPersistenceScope | null = null
  private loadGeneration = 0
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private isRestoring = false
  private snapEngine: DrawingSnapEngine | null = null
  private magnetEnabled = false
  private shiftSnapEnabled = false
  private resizeAnchorIndex: number | null = null
  private onToolSelect: (tool: string) => void
  private onDrawingInteractionChange?: (isInteracting: boolean) => void

  constructor(private readonly options: DrawingRuntimePluginOptions) {
    this.onToolSelect = options.onToolSelect
    this.onDrawingInteractionChange = options.onDrawingInteractionChange
    this.persistenceEngine = options.persistenceEngine || new DrawingPersistenceEngine()
    this.persistenceScope = options.persistenceScope || null
    this.magnetEnabled = Boolean(options.magnetEnabled)
  }

  initialize(context: ChartPluginContext) {
    this.context = context
    this.snapEngine = new DrawingSnapEngine({
      timeToCoordinate: (time) => context.chart.timeScale().timeToCoordinate(time as Time),
      priceToCoordinate: (price) => context.mainSeries.priceToCoordinate(price),
    })
    this.snapEngine.setCandles(context.getData())
    this.updateSnapEnabled()
    this.manager = new DrawingManager()
    this.manager.attach(context.chart as any, context.mainSeries as any, this.options.container)
    this.attachManagerEvents()
    this.attachListeners()
    this.restorePersistedDrawings()
  }

  setCallbacks(callbacks: Pick<DrawingRuntimePluginOptions, 'onToolSelect' | 'onDrawingInteractionChange'>) {
    this.onToolSelect = callbacks.onToolSelect
    this.onDrawingInteractionChange = callbacks.onDrawingInteractionChange
  }

  setPersistenceScope(scope: DrawingPersistenceScope | null) {
    if (sameScope(this.persistenceScope, scope)) return
    this.flushPendingSave()
    this.loadGeneration++
    this.persistenceScope = scope
    this.cancelActiveOperation()
    this.replaceDrawings([])
    this.restorePersistedDrawings()
  }

  setActiveTool(tool: DrawingType | string) {
    this.activeTool = tool
    const toolType = TOOL_MAP[tool as DrawingType]
    this.manager?.setActiveTool(toolType || null)
    this.setInteractionLocked(Boolean(toolType) || this.pendingAnchors.length > 0)
  }

  setMagnetEnabled(_enabled: boolean) {
    this.magnetEnabled = _enabled
    this.updateSnapEnabled()
  }

  setData(candles: readonly CandleData[]) {
    this.snapEngine?.setCandles(candles)
  }

  onBar(_candle: CandleData, candles: readonly CandleData[]) {
    this.snapEngine?.setCandles(candles)
  }

  deleteSelected() {
    const selectedDrawing = this.manager?.getSelectedDrawing()
    if (!this.manager || !selectedDrawing) return
    this.manager.removeDrawing(selectedDrawing.id)
    this.schedulePersistedSave()
  }

  clearDrawings() {
    this.cancelActiveOperation()
    this.manager?.clearAll()
    this.schedulePersistedSave()
  }

  cancelActiveOperation() {
    this.removePreview()
    this.pendingAnchors = []
    this.dragStart = null
    this.resizeAnchorIndex = null
    this.onDrawingInteractionChange?.(false)
    this.setInteractionLocked(false)
  }

  getSelectedDrawingId(): string | null {
    return this.manager?.getSelectedDrawing()?.id || null
  }

  destroy() {
    this.flushPendingSave()
    this.cleanupListeners?.()
    this.cleanupListeners = null
    this.cleanupManagerEvents?.()
    this.cleanupManagerEvents = null
    this.cancelActiveOperation()
    this.manager?.detach()
    this.manager = null
    this.context = null
    this.shiftSnapEnabled = false
    this.updateSnapEnabled()
    this.snapEngine?.destroy()
    this.snapEngine = null
    this.persistenceEngine.destroy()
  }

  private attachListeners() {
    const container = this.options.container

    const handleSelectionMouseDownCapture = (event: MouseEvent) => {
      const manager = this.manager
      if (!manager || TOOL_MAP[this.activeTool as DrawingType]) return
      if (!manager.getSelectedDrawing()) return

      const anchorIndex = manager.hitTestAnchor(this.getLocalPoint(event))
      if (anchorIndex === null) return

      this.resizeAnchorIndex = anchorIndex
      this.setInteractionLocked(true)
      this.onDrawingInteractionChange?.(true)
    }

    const handleMouseDown = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType) return

      const tool = this.registry.get(toolType)
      const anchor = this.pointToAnchor(event, 'create', getSnapAxisForTool(toolType))
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
        this.schedulePersistedSave()
      } else {
        this.updatePreview(toolType, anchor)
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType || this.pendingAnchors.length === 0) return

      const anchor = this.pointToAnchor(event, 'create', getSnapAxisForTool(toolType))
      if (!anchor) return
      event.preventDefault()
      event.stopPropagation()
      this.updatePreview(toolType, anchor)
    }

    const handleMouseUp = (event: MouseEvent) => {
      const toolType = TOOL_MAP[this.activeTool as DrawingType]
      if (!toolType || this.pendingAnchors.length === 0) return

      const anchor = this.pointToAnchor(event, 'create', getSnapAxisForTool(toolType))
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
      const anchor = this.pointToAnchor(event, 'create', getSnapAxisForTool(toolType))
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
      if (event.key === 'Shift' && !isEditableTarget(event.target)) {
        this.shiftSnapEnabled = true
        this.updateSnapEnabled()
        return
      }

      if (event.key === 'Escape') {
        this.cancelActiveOperation()
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const selectedDrawing = this.manager?.getSelectedDrawing()
      if (!this.manager || !selectedDrawing) return

      event.preventDefault()
      this.manager.removeDrawing(selectedDrawing.id)
      this.schedulePersistedSave()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') return
      this.shiftSnapEnabled = false
      this.updateSnapEnabled()
    }

    const handleWindowMouseUp = () => {
      if (this.pendingAnchors.length > 0) return
      this.resizeAnchorIndex = null
      this.restoreChartInteraction()
      this.onDrawingInteractionChange?.(false)
    }

    const handleResizeMouseMove = (event: MouseEvent) => {
      const manager = this.manager
      const selectedDrawing = manager?.getSelectedDrawing()
      if (!manager || !selectedDrawing || this.resizeAnchorIndex === null) return
      const anchor = this.pointToAnchor(event, 'resize', getSnapAxisForTool(selectedDrawing.type))
      if (!anchor) return
      selectedDrawing.updateAnchor(this.resizeAnchorIndex, anchor)
    }

    const handleWindowBlur = () => {
      this.shiftSnapEnabled = false
      this.updateSnapEnabled()
    }

    container.addEventListener('mousedown', handleSelectionMouseDownCapture, true)
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mousemove', handleResizeMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('blur', handleWindowBlur)

    this.cleanupListeners = () => {
      container.removeEventListener('mousedown', handleSelectionMouseDownCapture, true)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mousemove', handleResizeMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }

  private pointToAnchor(event: MouseEvent, mode: SnapMode, axis: SnapAxis): Anchor | null {
    if (!this.context) return null
    const rect = this.options.container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const time = this.context.chart.timeScale().coordinateToTime(x)
    const price = this.context.mainSeries.coordinateToPrice(y)
    if (time === null || price === null) return null
    const normalizedTime = normalizeSnapTime(time as Time)
    if (normalizedTime === null) return { time: time as Time, price }
    const snapped = this.snapEngine?.snap({
      time: normalizedTime,
      price,
      pointer: { x, y },
      target: 'ohlc',
      thresholdPx: 12,
      mode,
      axis,
    })
    if (!snapped || !snapped.snapped) return { time: time as Time, price }
    return { time: snapped.time as Time, price: snapped.price }
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
      this.schedulePersistedSave()
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

  private updateSnapEnabled() {
    this.snapEngine?.setEnabled(this.magnetEnabled || this.shiftSnapEnabled)
  }

  private attachManagerEvents() {
    const manager = this.manager
    if (!manager) return
    const unsubscribers = [
      manager.on('drawing:added', (event) => {
        if (event.drawingId !== this.previewId) this.schedulePersistedSave()
      }),
      manager.on('drawing:removed', (event) => {
        if (event.drawingId !== this.previewId) this.schedulePersistedSave()
      }),
      manager.on('drawing:updated', (event) => {
        if (event.drawingId !== this.previewId) this.schedulePersistedSave()
      }),
      manager.on('drawing:cleared', () => this.schedulePersistedSave()),
    ]
    this.cleanupManagerEvents = () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }

  exportDrawings(): DrawingModel[] {
    if (!this.manager) return []
    return serializeRuntimeDrawings(this.manager.exportDrawings())
  }

  restoreDrawings(drawings: readonly DrawingModel[]) {
    this.replaceDrawings(drawings)
  }

  private async restorePersistedDrawings() {
    const scope = this.persistenceScope
    if (!scope || !this.manager) return
    const generation = ++this.loadGeneration

    try {
      const drawings = await this.persistenceEngine.load(scope)
      if (generation !== this.loadGeneration || scope !== this.persistenceScope || !this.manager) return
      this.replaceDrawings(drawings)
    } catch (error) {
      console.warn('DrawingPersistence: restore failed', error)
    }
  }

  private replaceDrawings(drawings: readonly DrawingModel[]) {
    const manager = this.manager
    if (!manager) return
    this.isRestoring = true
    try {
      manager.clearAll()
      for (const drawingModel of drawings) {
        const runtimeDrawing = drawingModelToRuntimeDrawing(drawingModel)
        if (!runtimeDrawing) continue
        const drawing = this.registry.createDrawing(
          runtimeDrawing.type,
          runtimeDrawing.id,
          runtimeDrawing.anchors as Anchor[],
          runtimeDrawing.style
        )
        if (!drawing) continue
        drawing.updateOptions(runtimeDrawing.options)
        manager.addDrawing(drawing)
      }
      this.idCounter = Math.max(this.idCounter, ...drawings.map((drawing) => getDrawingNumericId(drawing.id)))
    } finally {
      this.isRestoring = false
    }
  }

  private schedulePersistedSave() {
    if (this.isRestoring || !this.persistenceScope) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    const generation = this.loadGeneration
    const scope = this.persistenceScope
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (generation !== this.loadGeneration || scope !== this.persistenceScope) return
      this.saveNow(scope)
    }, 250)
  }

  private flushPendingSave() {
    if (!this.saveTimer) return
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (this.persistenceScope) this.saveNow(this.persistenceScope)
  }

  private saveNow(scope: DrawingPersistenceScope) {
    const drawings = this.exportDrawings()
    const operation = drawings.length === 0
      ? this.persistenceEngine.clear(scope)
      : this.persistenceEngine.save(scope, drawings)
    operation.catch((error) => {
      console.warn('DrawingPersistence: save failed', error)
    })
  }
}

function sameScope(a: DrawingPersistenceScope | null, b: DrawingPersistenceScope | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    (a.workspaceId || 'terminal') === (b.workspaceId || 'terminal') &&
    a.layoutId === b.layoutId &&
    a.chartId === b.chartId &&
    a.symbol === b.symbol &&
    a.timeframe === b.timeframe
  )
}

function getDrawingNumericId(id: string): number {
  const match = /^drawing-(\d+)$/.exec(id)
  return match ? Number(match[1]) : 0
}

function getSnapAxisForTool(runtimeToolType: string): SnapAxis {
  if (runtimeToolType === 'vertical-line') return 'time'
  if (runtimeToolType === 'horizontal-line' || runtimeToolType === 'horizontal-ray') return 'price'
  return 'ohlc'
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable
}
