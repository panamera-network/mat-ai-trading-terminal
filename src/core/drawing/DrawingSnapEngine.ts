import { Time } from 'lightweight-charts'
import { CandleData } from '@/types'

export type SnapTarget = 'open' | 'high' | 'low' | 'close' | 'ohlc'
export type SnapMode = 'create' | 'move' | 'resize'
export type SnapAxis = 'ohlc' | 'time' | 'price'

export interface SnapRequest {
  time: number
  price: number
  pointer?: { x: number; y: number }
  target: SnapTarget
  thresholdPx: number
  mode: SnapMode
  axis?: SnapAxis
}

export interface SnapResult {
  snapped: boolean
  time: number
  price: number
  target?: Exclude<SnapTarget, 'ohlc'>
  distancePx?: number
}

export interface DrawingSnapCoordinateAdapter {
  timeToCoordinate: (time: number) => number | null
  priceToCoordinate: (price: number) => number | null
}

const TARGET_ORDER: Array<Exclude<SnapTarget, 'ohlc'>> = ['high', 'low', 'close', 'open']

export class DrawingSnapEngine {
  private candles: readonly CandleData[] = []
  private enabled = false

  constructor(private readonly coordinates: DrawingSnapCoordinateAdapter) {}

  setCandles(candles: readonly CandleData[]) {
    this.candles = [...candles].sort((a, b) => a.time - b.time)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  snap(request: SnapRequest): SnapResult {
    if (!this.enabled || this.candles.length === 0 || !request.pointer) {
      return this.original(request)
    }

    const candle = this.findNearestCandle(request.time)
    if (!candle) return this.original(request)

    const candleX = this.coordinates.timeToCoordinate(candle.time)
    if (candleX === null) return this.original(request)

    const axis = request.axis || 'ohlc'
    if (axis === 'time') {
      const distancePx = Math.abs(candleX - request.pointer.x)
      if (distancePx > request.thresholdPx) return this.original(request)
      return { snapped: true, time: candle.time, price: request.price, distancePx }
    }

    const candidates = this.getCandidates(candle, request.target)
      .map((candidate) => {
        const y = this.coordinates.priceToCoordinate(candidate.price)
        if (y === null) return null
        const dx = axis === 'price' ? 0 : candleX - request.pointer!.x
        const dy = y - request.pointer!.y
        return {
          ...candidate,
          distancePx: Math.hypot(dx, dy),
        }
      })
      .filter((candidate): candidate is { target: Exclude<SnapTarget, 'ohlc'>; price: number; distancePx: number } => candidate !== null)
      .filter((candidate) => candidate.distancePx <= request.thresholdPx)
      .sort((a, b) => {
        if (a.distancePx !== b.distancePx) return a.distancePx - b.distancePx
        return TARGET_ORDER.indexOf(a.target) - TARGET_ORDER.indexOf(b.target)
      })

    const best = candidates[0]
    if (!best) return this.original(request)

    return {
      snapped: true,
      time: axis === 'price' ? request.time : candle.time,
      price: best.price,
      target: best.target,
      distancePx: best.distancePx,
    }
  }

  destroy() {
    this.candles = []
    this.enabled = false
  }

  private original(request: SnapRequest): SnapResult {
    return { snapped: false, time: request.time, price: request.price }
  }

  private findNearestCandle(time: number): CandleData | null {
    if (!Number.isFinite(time) || this.candles.length === 0) return null
    let low = 0
    let high = this.candles.length - 1
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const value = this.candles[mid].time
      if (value === time) return this.candles[mid]
      if (value < time) low = mid + 1
      else high = mid - 1
    }

    const before = high >= 0 ? this.candles[high] : null
    const after = low < this.candles.length ? this.candles[low] : null
    if (!before) return after
    if (!after) return before
    return Math.abs(before.time - time) <= Math.abs(after.time - time) ? before : after
  }

  private getCandidates(candle: CandleData, target: SnapTarget) {
    const targets = target === 'ohlc' ? TARGET_ORDER : [target]
    return targets.map((item) => ({ target: item, price: candle[item] }))
  }
}

export function normalizeSnapTime(time: Time): number | null {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    const numeric = Number(time)
    if (Number.isFinite(numeric)) return numeric
    const parsed = Date.parse(time)
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
  }
  if (time && typeof time === 'object') {
    const date = time as { year?: unknown; month?: unknown; day?: unknown }
    if (
      typeof date.year === 'number' &&
      typeof date.month === 'number' &&
      typeof date.day === 'number'
    ) {
      return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 1000)
    }
  }
  return null
}

