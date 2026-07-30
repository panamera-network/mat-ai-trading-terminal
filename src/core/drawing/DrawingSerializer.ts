import { DrawingType } from '@/types'
import {
  DRAWING_SCHEMA_VERSION,
  DrawingAnchorModel,
  DrawingModel,
  DrawingPersistenceScope,
  DrawingStyleModel,
  SerializedDrawingSet,
} from '@/core/drawing/DrawingModel'

interface RuntimeSerializedDrawing {
  id: string
  type: string
  anchors: Array<{ time: unknown; price: unknown }>
  style?: Record<string, unknown>
  options?: Record<string, unknown>
}

const RUNTIME_TO_MAT_TOOL: Record<string, DrawingType> = {
  'trend-line': 'trendline',
  'horizontal-line': 'horizontal',
  'vertical-line': 'vertical',
  ray: 'ray',
  arrow: 'arrow',
  'extended-line': 'extended',
  'cross-line': 'crossLine',
  'info-line': 'infoLine',
  'trend-angle': 'trendAngle',
  'horizontal-ray': 'horizontalRay',
  rectangle: 'rectangle',
  circle: 'circle',
  'price-range': 'priceRange',
  'regression-trend': 'regressionTrend',
  'fib-retracement': 'fibonacci',
  'fib-time-zone': 'fibTimeZone',
  'fib-speed-fan': 'fibSpeedFan',
  'fib-circles': 'fibCircles',
  'fib-spiral': 'fibSpiral',
  'fib-arcs': 'fibArcs',
  'gann-box': 'gannBox',
  'gann-fan': 'gannFan',
  'gann-square-fixed': 'gannSquareFixed',
  'gann-square': 'gannSquare',
  'date-range': 'dateRange',
  'date-price-range': 'datePriceRange',
  'fib-extension': 'fibonacciExtension',
  'parallel-channel': 'parallel',
  callout: 'callout',
  brush: 'brush',
  highlighter: 'highlighter',
  'arrow-marker': 'arrowMarker',
  'arrow-mark-up': 'arrowMarkUp',
  'arrow-mark-down': 'arrowMarkDown',
  note: 'note',
  'price-note': 'priceNote',
  'price-label': 'priceLabel',
  'flag-mark': 'flagMark',
  pin: 'pin',
  comment: 'comment',
  signpost: 'signpost',
  table: 'table',
  forecast: 'forecast',
  ellipse: 'ellipse',
  path: 'path',
  polyline: 'polyline',
  'text-annotation': 'text',
}

export const MAT_TO_RUNTIME_TOOL: Partial<Record<DrawingType, string>> = Object.fromEntries(
  Object.entries(RUNTIME_TO_MAT_TOOL).map(([runtimeType, matType]) => [matType, runtimeType])
) as Partial<Record<DrawingType, string>>

export function serializeRuntimeDrawings(rawDrawings: unknown[], now = Date.now()): DrawingModel[] {
  return rawDrawings
    .map((raw) => serializeRuntimeDrawing(raw, now))
    .filter((drawing): drawing is DrawingModel => drawing !== null)
}

export function serializeDrawingSet(
  scope: DrawingPersistenceScope,
  drawings: readonly DrawingModel[],
  savedAt = Date.now()
): SerializedDrawingSet {
  return {
    schemaVersion: DRAWING_SCHEMA_VERSION,
    savedAt,
    scope,
    drawings: drawings.map((drawing) => ({ ...drawing, anchors: drawing.anchors.map((anchor) => ({ ...anchor })) })),
  }
}

export function parseDrawingSet(payload: string, expectedScope: DrawingPersistenceScope): SerializedDrawingSet | null {
  try {
    return migrateDrawingPayload(JSON.parse(payload), expectedScope)
  } catch (error) {
    console.warn('DrawingPersistence: failed to parse drawing payload', error)
    return null
  }
}

export function migrateDrawingPayload(payload: unknown, expectedScope: DrawingPersistenceScope): SerializedDrawingSet | null {
  if (!isRecord(payload)) return null
  if (payload.schemaVersion !== DRAWING_SCHEMA_VERSION) return null

  const savedAt = toFiniteNumber(payload.savedAt)
  const scope = validateScope(payload.scope)
  if (!scope || !scopesMatch(scope, expectedScope)) return null
  if (!Array.isArray(payload.drawings)) return null

  const drawings = payload.drawings
    .map((drawing) => validateDrawingModel(drawing))
    .filter((drawing): drawing is DrawingModel => drawing !== null)

  return {
    schemaVersion: DRAWING_SCHEMA_VERSION,
    savedAt: savedAt ?? Date.now(),
    scope,
    drawings,
  }
}

export function drawingModelToRuntimeDrawing(drawing: DrawingModel) {
  const runtimeType = drawing.metadata?.runtimeType || MAT_TO_RUNTIME_TOOL[drawing.type]
  if (!runtimeType) return null
  return {
    id: drawing.id,
    type: runtimeType,
    anchors: drawing.anchors.map((anchor) => ({ time: anchor.time, price: anchor.price })),
    style: drawing.style,
    options: {
      visible: drawing.visible,
      locked: drawing.locked,
      zIndex: drawing.zIndex,
    },
  }
}

export function createDrawingScopeKey(scope: DrawingPersistenceScope): string {
  return [
    scope.workspaceId || 'terminal',
    scope.layoutId,
    scope.chartId,
    scope.symbol,
    scope.timeframe,
  ].map(encodeURIComponent).join(':')
}

function serializeRuntimeDrawing(raw: unknown, now: number): DrawingModel | null {
  const drawing = raw as RuntimeSerializedDrawing
  if (!isRecord(drawing) || typeof drawing.id !== 'string' || typeof drawing.type !== 'string') return null
  if (drawing.id.startsWith('__preview_')) return null

  const matType = RUNTIME_TO_MAT_TOOL[drawing.type]
  if (!matType || !Array.isArray(drawing.anchors)) return null

  const anchors = drawing.anchors.map(normalizeAnchor).filter((anchor): anchor is DrawingAnchorModel => anchor !== null)
  if (anchors.length === 0) return null

  const options = isRecord(drawing.options) ? drawing.options : {}
  return {
    id: drawing.id,
    type: matType,
    anchors,
    style: normalizeStyle(drawing.style),
    visible: typeof options.visible === 'boolean' ? options.visible : true,
    locked: typeof options.locked === 'boolean' ? options.locked : false,
    zIndex: toFiniteNumber(options.zIndex) ?? undefined,
    metadata: { runtimeType: drawing.type },
    createdAt: now,
    updatedAt: now,
  }
}

function validateDrawingModel(raw: unknown): DrawingModel | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null
  if (typeof raw.type !== 'string' || !MAT_TO_RUNTIME_TOOL[raw.type as DrawingType]) return null
  if (!Array.isArray(raw.anchors)) return null

  const anchors = raw.anchors.map(normalizeAnchor).filter((anchor): anchor is DrawingAnchorModel => anchor !== null)
  if (anchors.length === 0) return null

  const createdAt = toFiniteNumber(raw.createdAt) ?? Date.now()
  const updatedAt = toFiniteNumber(raw.updatedAt) ?? createdAt
  const metadata = isRecord(raw.metadata) && typeof raw.metadata.runtimeType === 'string'
    ? { runtimeType: raw.metadata.runtimeType }
    : undefined

  return {
    id: raw.id,
    type: raw.type as DrawingType,
    anchors,
    style: normalizeStyle(raw.style),
    visible: typeof raw.visible === 'boolean' ? raw.visible : true,
    locked: typeof raw.locked === 'boolean' ? raw.locked : false,
    zIndex: toFiniteNumber(raw.zIndex) ?? undefined,
    metadata,
    createdAt,
    updatedAt,
  }
}

function normalizeAnchor(raw: unknown): DrawingAnchorModel | null {
  if (!isRecord(raw)) return null
  const time = normalizeTime(raw.time)
  const price = toFiniteNumber(raw.price)
  if (time === null || price === null) return null
  return { time, price }
}

function normalizeTime(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const numeric = Number(raw)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
  }
  if (isRecord(raw)) {
    const year = toFiniteNumber(raw.year)
    const month = toFiniteNumber(raw.month)
    const day = toFiniteNumber(raw.day)
    if (year !== null && month !== null && day !== null) {
      return Math.floor(Date.UTC(year, month - 1, day) / 1000)
    }
  }
  return null
}

function normalizeStyle(raw: unknown): DrawingStyleModel {
  if (!isRecord(raw)) return {}
  const style: DrawingStyleModel = {}
  if (typeof raw.lineColor === 'string') style.lineColor = raw.lineColor
  const lineWidth = toFiniteNumber(raw.lineWidth)
  if (lineWidth !== null) style.lineWidth = lineWidth
  if (Array.isArray(raw.lineDash) && raw.lineDash.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    style.lineDash = [...raw.lineDash]
  }
  if (typeof raw.fillColor === 'string') style.fillColor = raw.fillColor
  const fillOpacity = toFiniteNumber(raw.fillOpacity)
  if (fillOpacity !== null) style.fillOpacity = fillOpacity
  if (typeof raw.showLabels === 'boolean') style.showLabels = raw.showLabels
  if (typeof raw.labelFont === 'string') style.labelFont = raw.labelFont
  if (typeof raw.labelColor === 'string') style.labelColor = raw.labelColor
  return style
}

function validateScope(raw: unknown): DrawingPersistenceScope | null {
  if (!isRecord(raw)) return null
  if (
    typeof raw.layoutId !== 'string' ||
    typeof raw.chartId !== 'string' ||
    typeof raw.symbol !== 'string' ||
    typeof raw.timeframe !== 'string'
  ) {
    return null
  }
  return {
    workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : undefined,
    layoutId: raw.layoutId,
    chartId: raw.chartId,
    symbol: raw.symbol,
    timeframe: raw.timeframe as DrawingPersistenceScope['timeframe'],
  }
}

function scopesMatch(a: DrawingPersistenceScope, b: DrawingPersistenceScope): boolean {
  return (
    (a.workspaceId || 'terminal') === (b.workspaceId || 'terminal') &&
    a.layoutId === b.layoutId &&
    a.chartId === b.chartId &&
    a.symbol === b.symbol &&
    a.timeframe === b.timeframe
  )
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

