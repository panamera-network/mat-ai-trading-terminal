import { StrategyScript, StrategyState, StrategyContext, StrategyResult, StrategyAction } from '@/types/strategy'
import { orderService } from '@/services/orderService'
import { Symbol, ALL_SYMBOLS } from '@/types/market'

/**
 * Strategy Engine — executes user-provided JavaScript trading strategies
 * 
 * API available in strategy scripts:
 * - buy(size, options) — place buy market order
 * - sell(size, options) — place sell market order  
 * - close() — close current position
 * - setVar(name, value) — set persistent variable
 * - getVar(name) — get persistent variable
 * - log(message) — log message
 * - indicators.rsi(period) — calculate RSI
 * - indicators.ema(period) — calculate EMA
 * - indicators.sma(period) — calculate SMA
 * - indicators.macd(fast, slow, signal) — calculate MACD
 * - indicators.bb(period, stdDev) — calculate Bollinger Bands
 * - indicators.atr(period) — calculate ATR
 * - indicators.vwap() — calculate VWAP
 * 
 * Context variables:
 * - candle — current candle {time, open, high, low, close, volume}
 * - bid, ask, spread — current prices
 * - position — current position or null
 * - balance, equity — account info
 */

export class StrategyEngine {
  private scripts: Map<string, StrategyScript> = new Map()
  private states: Map<string, StrategyState> = new Map()
  private candleHistory: Map<string, any[]> = new Map() // symbol -> candles
  private onAction: ((scriptId: string, actions: StrategyAction[]) => void) | null = null

  registerScript(script: StrategyScript) {
    this.scripts.set(script.id, script)
    if (!this.states.has(script.id)) {
      this.states.set(script.id, {
        variables: {},
        lastCandle: null,
        indicators: {},
      })
    }
    if (!this.candleHistory.has(script.symbol)) {
      this.candleHistory.set(script.symbol, [])
    }
  }

  unregisterScript(scriptId: string) {
    this.scripts.delete(scriptId)
    this.states.delete(scriptId)
  }

  updateCandle(symbol: string, candle: any) {
    const history = this.candleHistory.get(symbol) || []
    history.push(candle)
    // Keep last 500 candles for indicator calculation
    if (history.length > 500) history.shift()
    this.candleHistory.set(symbol, history)
  }

  async runScript(scriptId: string, context: StrategyContext): Promise<StrategyResult> {
    const script = this.scripts.get(scriptId)
    if (!script || !script.isActive) {
      return { actions: [], logs: [], errors: [], state: this.getState(scriptId) }
    }

    const state = this.getState(scriptId)
    const history = this.candleHistory.get(script.symbol) || []
    const result: StrategyResult = {
      actions: [],
      logs: [],
      errors: [],
      state,
    }

    try {
      // Build the strategy function
      const strategyFn = this.compileScript(script.code)

      // Execute with sandboxed context
      strategyFn(context, state, history, result)

      // Update state
      this.states.set(script.id, state)
      state.lastCandle = context.candle

    } catch (err) {
      result.errors.push(`Runtime error: ${err}`)
    }

    return result
  }

  private compileScript(code: string): Function {
    // Wrap user code in a function with controlled API
    const wrapped = `
      return function(context, state, history, result) {
        const { candle, bid, ask, spread, position, balance, equity } = context;

        // Indicator helpers
        const indicators = {
          rsi: (period = 14) => calculateRSI(history, period),
          ema: (period = 20) => calculateEMA(history.map(c => c.close), period),
          sma: (period = 20) => calculateSMA(history.map(c => c.close), period),
          macd: (fast = 12, slow = 26, signal = 9) => calculateMACD(history.map(c => c.close), fast, slow, signal),
          bb: (period = 20, stdDev = 2) => calculateBB(history.map(c => c.close), period, stdDev),
          atr: (period = 14) => calculateATR(history, period),
          vwap: () => calculateVWAP(history),
        };

        // Trading API
        const buy = (size, options = {}) => {
          result.actions.push({ type: 'buy', size, ...options });
        };
        const sell = (size, options = {}) => {
          result.actions.push({ type: 'sell', size, ...options });
        };
        const close = () => {
          result.actions.push({ type: 'close' });
        };
        const setSL = (pips) => {
          result.actions.push({ type: 'modify_sl', slPips: pips });
        };
        const setTP = (pips) => {
          result.actions.push({ type: 'modify_tp', tpPips: pips });
        };
        const log = (msg) => {
          result.logs.push(String(msg));
        };
        const setVar = (name, value) => {
          state.variables[name] = value;
        };
        const getVar = (name) => {
          return state.variables[name];
        };

        // Execute user code
        ${code}
      }
    `;

    // Compile with indicator functions in scope
    const fn = new Function('calculateRSI', 'calculateEMA', 'calculateSMA', 'calculateMACD', 'calculateBB', 'calculateATR', 'calculateVWAP', wrapped)
    return fn(
      calculateRSI, calculateEMA, calculateSMA, calculateMACD, calculateBB, calculateATR, calculateVWAP
    )
  }

  private getState(scriptId: string): StrategyState {
    return this.states.get(scriptId) || { variables: {}, lastCandle: null, indicators: {} }
  }

  getScripts(): StrategyScript[] {
    return Array.from(this.scripts.values())
  }

  getScript(id: string): StrategyScript | undefined {
    return this.scripts.get(id)
  }
}

// ─── Indicator Calculations ───

function calculateRSI(candles: any[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const closes = candles.map((c) => c.close)
  let gains = 0
  let losses = 0

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - i] - closes[closes.length - i - 1]
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  // Smooth
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null
  const sum = values.slice(-period).reduce((a, b) => a + b, 0)
  return sum / period
}

function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null
  const k = 2 / (period + 1)
  let ema = values[0]
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
  }
  return ema
}

function calculateMACD(values: number[], fast = 12, slow = 26, signal = 9): { macd: number; signal: number; histogram: number } | null {
  if (values.length < slow + signal) return null
  const fastEMA = calculateEMA(values, fast)!
  const slowEMA = calculateEMA(values, slow)!
  const macdLine = fastEMA - slowEMA
  // Simplified signal line
  const signalLine = calculateEMA(values.slice(-signal), signal) || macdLine
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  }
}

function calculateBB(values: number[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number } | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - middle, 2), 0) / period
  const std = Math.sqrt(variance)
  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
  }
}

function calculateATR(candles: any[], period = 14): number | null {
  if (candles.length < period + 1) return null
  let atr = 0
  for (let i = 1; i <= period; i++) {
    const c = candles[candles.length - i]
    const p = candles[candles.length - i - 1]
    const tr1 = c.high - c.low
    const tr2 = Math.abs(c.high - p.close)
    const tr3 = Math.abs(c.low - p.close)
    atr += Math.max(tr1, tr2, tr3)
  }
  return atr / period
}

function calculateVWAP(candles: any[]): number | null {
  if (candles.length === 0) return null
  let tpVol = 0
  let vol = 0
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3
    tpVol += tp * c.volume
    vol += c.volume
  }
  return vol > 0 ? tpVol / vol : null
}

export const strategyEngine = new StrategyEngine()
