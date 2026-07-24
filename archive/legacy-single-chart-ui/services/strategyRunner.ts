import { CandleData } from '@/types'
import { StrategyRule, StrategyCondition } from '@/types/strategy'
import { orderService } from '@/services/orderService'
import { Symbol } from '@/types/market'

export class StrategyRunner {
  private rules: StrategyRule[] = []
  private isRunning = false
  private history: { time: number; signal: string; price: number }[] = []
  private candleHistory: CandleData[] = []
  private onSignal: ((signal: string, price: number) => void) | null = null

  addRule(rule: StrategyRule) {
    this.rules.push(rule)
  }

  removeRule(ruleId: string) {
    this.rules = this.rules.filter((r) => r.id !== ruleId)
  }

  setRules(rules: StrategyRule[]) {
    this.rules = rules
  }

  start() {
    this.isRunning = true
  }

  stop() {
    this.isRunning = false
  }

  onCandle(candle: CandleData, symbol: Symbol, bid: number, ask: number, spread: number) {
    if (!this.isRunning) return

    this.candleHistory.push(candle)
    if (this.candleHistory.length > 200) {
      this.candleHistory = this.candleHistory.slice(-200)
    }

    for (const rule of this.rules) {
      if (!rule.enabled) continue
      if (this.checkConditions(rule.conditions, candle)) {
        this.executeAction(rule, symbol, bid, ask, spread)
      }
    }
  }

  private checkConditions(conditions: StrategyCondition[], candle: CandleData): boolean {
    return conditions.every((cond) => this.evaluateCondition(cond, candle))
  }

  private evaluateCondition(cond: StrategyCondition, candle: CandleData): boolean {
    const value = this.getIndicatorValue(cond.indicator, cond.period)
    const target = typeof cond.target === 'string'
      ? this.getIndicatorValue(cond.target as any, cond.period)
      : cond.target

    if (value === null || target === null) return false

    switch (cond.comparison) {
      case 'greater_than': return value > target
      case 'less_than': return value < target
      case 'equals': return Math.abs(value - target) < 0.0001
      case 'crosses_above':
        return this.checkCross(cond.indicator, cond.period, target, 'above')
      case 'crosses_below':
        return this.checkCross(cond.indicator, cond.period, target, 'below')
      default: return false
    }
  }

  private getIndicatorValue(indicator: string, period: number): number | null {
    const data = this.candleHistory
    if (data.length < period) return null

    switch (indicator) {
      case 'sma':
        return this.calculateSMA(data.slice(-period))
      case 'ema':
        return this.calculateEMA(data, period)
      case 'rsi':
        return this.calculateRSI(data, period)
      case 'price':
        return data[data.length - 1].close
      default:
        return null
    }
  }

  private calculateSMA(candles: CandleData[]): number {
    return candles.reduce((sum, c) => sum + c.close, 0) / candles.length
  }

  private calculateEMA(data: CandleData[], period: number): number {
    const k = 2 / (period + 1)
    let ema = data[0].close
    for (let i = 1; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k)
    }
    return ema
  }

  private calculateRSI(data: CandleData[], period: number): number {
    let gains = 0
    let losses = 0
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }
    const avgGain = gains / period
    const avgLoss = losses / period
    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }

  private checkCross(indicator: string, period: number, target: number, direction: 'above' | 'below'): boolean {
    const data = this.candleHistory
    if (data.length < period + 1) return false

    const current = this.getIndicatorValue(indicator, period)
    const prevData = data.slice(0, -1)
    // Recalculate for previous candle (simplified)
    const prev = this.calculateSMA(prevData.slice(-period))

    if (current === null || prev === null) return false

    if (direction === 'above') {
      return prev <= target && current > target
    } else {
      return prev >= target && current < target
    }
  }

  private executeAction(rule: StrategyRule, symbol: Symbol, bid: number, ask: number, spread: number) {
    const currentPrice = (bid + ask) / 2

    if (rule.action === 'close') {
      const pos = orderService.getPosition(symbol.id)
      if (pos) {
        orderService.placeOrder({
          symbol,
          side: pos.side === 'buy' ? 'sell' : 'buy',
          type: 'market',
          size: pos.size,
          currentPrice,
          spread,
          bid,
          ask,
        })
      }
      return
    }

    const slPrice = rule.slPips
      ? (rule.action === 'buy' ? currentPrice - rule.slPips * symbol.pipSize : currentPrice + rule.slPips * symbol.pipSize)
      : undefined
    const tpPrice = rule.tpPips
      ? (rule.action === 'buy' ? currentPrice + rule.tpPips * symbol.pipSize : currentPrice - rule.tpPips * symbol.pipSize)
      : undefined

    orderService.placeOrder({
      symbol,
      side: rule.action,
      type: 'market',
      size: rule.size,
      currentPrice,
      spread,
      bid,
      ask,
      slPrice,
      tpPrice,
    })

    const signal = `${rule.name}: ${rule.action.toUpperCase()} @ ${currentPrice.toFixed(5)}`
    this.history.push({ time: Date.now(), signal, price: currentPrice })
    this.onSignal?.(signal, currentPrice)
  }

  getHistory() {
    return [...this.history]
  }

  getRules() {
    return [...this.rules]
  }

  subscribe(callback: (signal: string, price: number) => void) {
    this.onSignal = callback
  }
}

export const strategyRunner = new StrategyRunner()
