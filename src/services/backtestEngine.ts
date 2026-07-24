import { HistoricalCandle, BacktestConfig, BacktestState, BacktestResult } from '@/types/backtest'
import { CandleData } from '@/types'
import { Symbol } from '@/types/market'
import { orderService } from '@/services/orderService'
import { Order, Position, Trade } from '@/types/order'

export class BacktestEngine {
  private data: HistoricalCandle[] = []
  private config: BacktestConfig | null = null
  private state: BacktestState = {
    isPlaying: false,
    isComplete: false,
    cursor: 0,
    totalCandles: 0,
    speed: 1,
    currentCandle: null,
    currentDate: null,
  }
  private interval: ReturnType<typeof setInterval> | null = null
  private onTick: ((candle: HistoricalCandle) => void) | null = null
  private onComplete: ((result: BacktestResult) => void) | null = null
  private onStateChange: ((state: BacktestState) => void) | null = null
  private equityHistory: { time: number; equity: number }[] = []
  private balance = 0
  private peakBalance = 0
  private maxDrawdown = 0
  private maxDrawdownPercent = 0

  loadData(data: HistoricalCandle[], config: BacktestConfig) {
    this.data = data
    this.config = config
    this.balance = config.initialBalance
    this.peakBalance = config.initialBalance
    this.maxDrawdown = 0
    this.maxDrawdownPercent = 0
    this.equityHistory = []

    this.state = {
      isPlaying: false,
      isComplete: false,
      cursor: 0,
      totalCandles: data.length,
      speed: 1,
      currentCandle: data[0] || null,
      currentDate: data[0] ? new Date(data[0].time * 1000) : null,
    }

    // Reset order service
    orderService.reset()

    this.emitState()
  }

  play() {
    if (this.state.isPlaying || this.state.isComplete) return
    this.state.isPlaying = true
    this.emitState()

    const tickMs = Math.max(16, 1000 / this.state.speed / 60) // 60fps base

    this.interval = setInterval(() => {
      this.step()
    }, tickMs)
  }

  pause() {
    if (!this.state.isPlaying) return
    this.state.isPlaying = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.emitState()
  }

  stop() {
    this.pause()
    this.state.cursor = 0
    this.state.isComplete = false
    this.state.currentCandle = this.data[0] || null
    this.state.currentDate = this.data[0] ? new Date(this.data[0].time * 1000) : null
    this.balance = this.config?.initialBalance || 0
    this.equityHistory = []
    orderService.reset()
    this.emitState()
  }

  step() {
    if (this.state.cursor >= this.data.length - 1) {
      this.complete()
      return
    }

    this.state.cursor++
    const candle = this.data[this.state.cursor]
    this.state.currentCandle = candle
    this.state.currentDate = new Date(candle.time * 1000)

    // Process orders at this candle
    this.processCandle(candle)

    // Update equity
    this.updateEquity(candle)

    // Emit tick
    this.onTick?.(candle)
    this.emitState()
  }

  stepBack() {
    if (this.state.cursor <= 0) return
    this.pause()
    this.state.cursor--
    const candle = this.data[this.state.cursor]
    this.state.currentCandle = candle
    this.state.currentDate = new Date(candle.time * 1000)

    // Recalculate from scratch (simpler than reverse)
    this.recalculateFromStart()

    this.onTick?.(candle)
    this.emitState()
  }

  seekTo(cursor: number) {
    if (cursor < 0 || cursor >= this.data.length) return
    this.pause()
    this.state.cursor = cursor
    const candle = this.data[cursor]
    this.state.currentCandle = candle
    this.state.currentDate = new Date(candle.time * 1000)

    this.recalculateFromStart()

    this.onTick?.(candle)
    this.emitState()
  }

  setSpeed(speed: number) {
    this.state.speed = speed
    if (this.state.isPlaying) {
      this.pause()
      this.play()
    }
    this.emitState()
  }

  private processCandle(candle: HistoricalCandle) {
    if (!this.config) return

    const spread = this.config.spread === 'variable'
      ? candle.spread
      : (this.config.spread as number)

    const mid = (candle.bid.close + candle.ask.close) / 2
    const bid = candle.bid.close
    const ask = candle.ask.close

    // Check pending orders
    orderService.checkPendingOrders(this.config.symbol, bid, ask, spread)

    // Update positions with current price
    orderService.updatePositions(this.config.symbol, bid, ask)
  }

  private updateEquity(candle: HistoricalCandle) {
    if (!this.config) return

    const positions = orderService.getPositions()
    const position = positions.find((p) => p.symbol === this.config!.symbol.id)

    let equity = this.config.initialBalance + (position?.realizedPnL || 0)
    if (position) {
      equity += position.unrealizedPnL
    }

    this.balance = equity
    this.equityHistory.push({ time: candle.time, equity })

    // Track drawdown
    if (equity > this.peakBalance) {
      this.peakBalance = equity
    }
    const drawdown = this.peakBalance - equity
    const drawdownPct = (drawdown / this.peakBalance) * 100

    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown
      this.maxDrawdownPercent = drawdownPct
    }
  }

  private recalculateFromStart() {
    if (!this.config) return

    // Reset and replay all candles up to cursor
    orderService.reset()
    this.balance = this.config.initialBalance
    this.peakBalance = this.config.initialBalance
    this.maxDrawdown = 0
    this.maxDrawdownPercent = 0
    this.equityHistory = []

    for (let i = 0; i <= this.state.cursor; i++) {
      const candle = this.data[i]
      const spread = this.config.spread === 'variable'
        ? candle.spread
        : (this.config.spread as number)

      orderService.checkPendingOrders(
        this.config.symbol,
        candle.bid.close,
        candle.ask.close,
        spread
      )
      orderService.updatePositions(this.config.symbol, candle.bid.close, candle.ask.close)

      // Update equity
      let equity = this.config.initialBalance
      const positions = orderService.getPositions()
      const position = positions.find((p) => p.symbol === this.config!.symbol.id)
      if (position) {
        equity += position.realizedPnL + position.unrealizedPnL
      }
      this.equityHistory.push({ time: candle.time, equity })
    }
  }

  private complete() {
    this.pause()
    this.state.isComplete = true
    this.state.isPlaying = false

    const result = this.calculateResult()
    this.onComplete?.(result)
    this.emitState()
  }

  private calculateResult(): BacktestResult {
    if (!this.config) throw new Error('No config')

    const trades = orderService.getTrades()
    const orders = orderService.getOrders()
    const positions = orderService.getPositions()

    const winningTrades = trades.filter((t) => {
      // Determine if trade was profitable based on position context
      const relatedOrders = orders.filter((o) => o.id === t.orderId)
      return true // Simplified
    })

    const totalReturn = this.balance - this.config.initialBalance
    const totalReturnPercent = (totalReturn / this.config.initialBalance) * 100

    // Profit factor = gross profit / gross loss
    let grossProfit = 0
    let grossLoss = 0
    for (const trade of trades) {
      // Simplified calculation
      const pnl = trade.price * trade.size * 0.001 // rough estimate
      if (pnl > 0) grossProfit += pnl
      else grossLoss += Math.abs(pnl)
    }

    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // Sharpe ratio (simplified)
    const returns = this.equityHistory.map((e, i) => {
      if (i === 0) return 0
      return (e.equity - this.equityHistory[i - 1].equity) / this.equityHistory[i - 1].equity
    })
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    )
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0

    return {
      totalTrades: trades.length,
      winningTrades: trades.filter((t) => t.price > 0).length, // simplified
      losingTrades: trades.filter((t) => t.price <= 0).length,
      winRate: trades.length > 0 ? (trades.filter((t) => t.price > 0).length / trades.length) * 100 : 0,
      profitFactor,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: this.maxDrawdownPercent,
      totalReturn,
      totalReturnPercent,
      sharpeRatio,
      equityCurve: this.equityHistory,
      trades,
      orders,
      finalBalance: this.balance,
    }
  }

  private emitState() {
    this.onStateChange?.({ ...this.state })
  }

  subscribe(callbacks: {
    onTick?: (candle: HistoricalCandle) => void
    onComplete?: (result: BacktestResult) => void
    onStateChange?: (state: BacktestState) => void
  }) {
    this.onTick = callbacks.onTick || null
    this.onComplete = callbacks.onComplete || null
    this.onStateChange = callbacks.onStateChange || null
  }

  getState() {
    return { ...this.state }
  }

  getData() {
    return this.data
  }

  getConfig() {
    return this.config
  }
}

export const backtestEngine = new BacktestEngine()
