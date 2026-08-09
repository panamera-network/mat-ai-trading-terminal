import { Symbol, Timeframe } from '@/types'
import {
  MTFContextFeed,
  mtfContextFeedAdapter,
} from '@/core/mtf/MTFContextFeedAdapter'
import { MTFContextPlugin } from '@/core/mtf/MTFContextPlugin'

export interface MTFContextCoordinatorOptions {
  chartId: string
  plugin: MTFContextPlugin
  feed?: MTFContextFeed
  defaultTimeframes?: readonly Timeframe[]
}

export interface MTFContextCoordinatorContext {
  symbol: Symbol
  mainTimeframe: Timeframe
  replayActive?: boolean
}

const DEFAULT_CONTEXT_TIMEFRAMES: readonly Timeframe[] = ['1H', '4H', '1D']
const MAX_CONTEXT_TIMEFRAMES = 3

const TIMEFRAME_RANK: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1H': 60,
  '4H': 240,
  '1D': 1440,
  '1W': 10080,
}

export class MTFContextCoordinator {
  private feed: MTFContextFeed
  private configuredTimeframes: readonly Timeframe[]
  private unsubscribe: (() => void) | null = null
  private generation = 0
  private currentKey: string | null = null

  constructor(private readonly options: MTFContextCoordinatorOptions) {
    this.feed = options.feed ?? mtfContextFeedAdapter
    this.configuredTimeframes = options.defaultTimeframes ?? DEFAULT_CONTEXT_TIMEFRAMES
  }

  update(context: MTFContextCoordinatorContext) {
    const requestedTimeframes = filterContextTimeframes(
      context.mainTimeframe,
      this.configuredTimeframes
    )
    const key = `${context.symbol.exchange}:${context.symbol.id}:${context.mainTimeframe}:${requestedTimeframes.join(',')}:${Boolean(context.replayActive)}`
    if (key === this.currentKey) return

    this.unsubscribeCurrent()
    this.currentKey = key
    this.generation += 1
    const generation = this.generation

    this.options.plugin.setTimeframes(requestedTimeframes)

    if (context.replayActive || requestedTimeframes.length === 0) {
      return
    }

    this.unsubscribe = this.feed.subscribe({
      chartId: this.options.chartId,
      symbol: context.symbol,
      timeframes: requestedTimeframes,
    }, {
      onHistorical: (timeframe, candles) => {
        if (this.generation !== generation) return
        this.options.plugin.setContextData(timeframe, candles)
      },
      onLiveCandle: (timeframe, candle) => {
        if (this.generation !== generation) return
        this.options.plugin.updateContextBar(timeframe, candle)
      },
      onStatus: (timeframe, status) => {
        if (this.generation !== generation) return
        this.options.plugin.setStatus(timeframe, status)
      },
      onError: (timeframe) => {
        if (this.generation !== generation || timeframe === null) return
        this.options.plugin.setStatus(timeframe, 'stale')
      },
    })
  }

  destroy() {
    this.unsubscribeCurrent()
    this.options.plugin.setTimeframes([])
    this.currentKey = null
  }

  private unsubscribeCurrent() {
    this.generation += 1
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}

export function filterContextTimeframes(
  mainTimeframe: Timeframe,
  configuredTimeframes: readonly Timeframe[] = DEFAULT_CONTEXT_TIMEFRAMES
): Timeframe[] {
  const mainRank = TIMEFRAME_RANK[mainTimeframe]
  const seen = new Set<Timeframe>()
  const result: Timeframe[] = []

  for (const timeframe of configuredTimeframes) {
    if (seen.has(timeframe)) continue
    seen.add(timeframe)
    if (TIMEFRAME_RANK[timeframe] <= mainRank) continue
    result.push(timeframe)
    if (result.length >= MAX_CONTEXT_TIMEFRAMES) break
  }

  return result
}
