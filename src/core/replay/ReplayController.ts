import { CandleData } from '@/types'

export interface ReplayState<TCandle extends CandleData = CandleData> {
  isPlaying: boolean
  isComplete: boolean
  cursor: number
  totalCandles: number
  speed: number
  currentCandle: TCandle | null
}

export type ReplayEvent<TCandle extends CandleData = CandleData> =
  | { type: 'loaded'; state: ReplayState<TCandle> }
  | { type: 'started'; state: ReplayState<TCandle> }
  | { type: 'paused'; state: ReplayState<TCandle> }
  | { type: 'reset'; state: ReplayState<TCandle> }
  | { type: 'step'; state: ReplayState<TCandle>; candle: TCandle; previousCursor: number; reason: 'forward' | 'backward' | 'seek' }
  | { type: 'completed'; state: ReplayState<TCandle> }
  | { type: 'speedChanged'; state: ReplayState<TCandle> }

export class ReplayController<TCandle extends CandleData = CandleData> {
  private candles: readonly TCandle[] = []
  private state: ReplayState<TCandle> = {
    isPlaying: false,
    isComplete: false,
    cursor: 0,
    totalCandles: 0,
    speed: 1,
    currentCandle: null,
  }
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<(event: ReplayEvent<TCandle>) => void>()

  load(candles: readonly TCandle[]) {
    this.clearTimer()
    this.candles = normalizeReplayCandles(candles)
    this.state = {
      isPlaying: false,
      isComplete: false,
      cursor: 0,
      totalCandles: this.candles.length,
      speed: 1,
      currentCandle: this.candles[0] || null,
    }
    this.emit({ type: 'loaded', state: this.getState() })
  }

  play() {
    if (this.state.isPlaying || this.state.isComplete) return
    this.state = { ...this.state, isPlaying: true }
    this.emit({ type: 'started', state: this.getState() })
    this.startTimer()
  }

  pause() {
    if (!this.state.isPlaying) return
    this.clearTimer()
    this.state = { ...this.state, isPlaying: false }
    this.emit({ type: 'paused', state: this.getState() })
  }

  toggle() {
    if (this.state.isPlaying) this.pause()
    else this.play()
  }

  reset() {
    this.clearTimer()
    this.state = {
      ...this.state,
      isPlaying: false,
      isComplete: false,
      cursor: 0,
      currentCandle: this.candles[0] || null,
    }
    this.emit({ type: 'reset', state: this.getState() })
  }

  stepForward() {
    if (this.state.cursor >= this.candles.length - 1) {
      this.complete()
      return null
    }

    const previousCursor = this.state.cursor
    const cursor = this.state.cursor + 1
    const candle = this.candles[cursor]
    this.state = {
      ...this.state,
      cursor,
      currentCandle: candle,
    }
    const state = this.getState()
    this.emit({ type: 'step', state, candle, previousCursor, reason: 'forward' })
    return { state, candle }
  }

  stepBackward() {
    if (this.state.cursor <= 0) return null
    this.pause()

    const previousCursor = this.state.cursor
    const cursor = previousCursor - 1
    const candle = this.candles[cursor]
    this.state = {
      ...this.state,
      isComplete: false,
      cursor,
      currentCandle: candle,
    }
    const state = this.getState()
    this.emit({ type: 'step', state, candle, previousCursor, reason: 'backward' })
    return { state, candle }
  }

  seekTo(cursor: number) {
    if (cursor < 0 || cursor >= this.candles.length) return null
    this.pause()

    const previousCursor = this.state.cursor
    const candle = this.candles[cursor]
    this.state = {
      ...this.state,
      isComplete: false,
      cursor,
      currentCandle: candle,
    }
    const state = this.getState()
    this.emit({ type: 'step', state, candle, previousCursor, reason: 'seek' })
    return { state, candle }
  }

  setSpeed(speed: number) {
    const wasPlaying = this.state.isPlaying
    if (wasPlaying) this.clearTimer()
    this.state = { ...this.state, speed }
    this.emit({ type: 'speedChanged', state: this.getState() })
    if (wasPlaying) this.startTimer()
  }

  getState(): ReplayState<TCandle> {
    return { ...this.state }
  }

  getData(): readonly TCandle[] {
    return this.candles
  }

  subscribe(listener: (event: ReplayEvent<TCandle>) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy() {
    this.clearTimer()
    this.listeners.clear()
    this.candles = []
    this.state = {
      isPlaying: false,
      isComplete: false,
      cursor: 0,
      totalCandles: 0,
      speed: 1,
      currentCandle: null,
    }
  }

  private startTimer() {
    if (this.timer) return
    const tickMs = Math.max(16, 1000 / this.state.speed / 60)
    this.timer = setInterval(() => {
      this.stepForward()
    }, tickMs)
  }

  private clearTimer() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private complete() {
    this.clearTimer()
    if (this.state.isComplete) return
    this.state = {
      ...this.state,
      isPlaying: false,
      isComplete: true,
    }
    this.emit({ type: 'completed', state: this.getState() })
  }

  private emit(event: ReplayEvent<TCandle>) {
    this.listeners.forEach((listener) => listener(event))
  }
}

function normalizeReplayCandles<TCandle extends CandleData>(candles: readonly TCandle[]): readonly TCandle[] {
  const byTime = new Map<number, TCandle>()
  for (const candle of candles) {
    if (!Number.isFinite(candle.time)) continue
    byTime.set(candle.time, candle)
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, candle]) => candle)
}
