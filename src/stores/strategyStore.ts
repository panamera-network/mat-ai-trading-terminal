import { create } from 'zustand'
import { StrategyScript, StrategyResult } from '@/types/strategy'
import { strategyEngine } from '@/services/strategyEngine'
import { nanoid } from 'nanoid'

interface StrategyStore {
  scripts: StrategyScript[]
  activeScriptId: string | null
  lastResult: StrategyResult | null
  isRunning: boolean
  logs: string[]

  createScript: (name: string, code: string, symbol: string, timeframe: string) => string
  updateScript: (id: string, updates: Partial<StrategyScript>) => void
  deleteScript: (id: string) => void
  setActiveScript: (id: string | null) => void
  toggleScript: (id: string) => void
  addLog: (message: string) => void
  clearLogs: () => void
  setLastResult: (result: StrategyResult) => void
  setIsRunning: (running: boolean) => void
}

export const useStrategyStore = create<StrategyStore>((set, get) => ({
  scripts: [],
  activeScriptId: null,
  lastResult: null,
  isRunning: false,
  logs: [],

  createScript: (name, code, symbol, timeframe) => {
    const id = nanoid(8)
    const script: StrategyScript = {
      id,
      name,
      code,
      symbol,
      timeframe,
      isActive: false,
      createdAt: new Date(),
    }
    strategyEngine.registerScript(script)
    set((state) => ({ scripts: [...state.scripts, script] }))
    return id
  },

  updateScript: (id, updates) => {
    set((state) => ({
      scripts: state.scripts.map((s) => {
        if (s.id !== id) return s
        const updated = { ...s, ...updates }
        strategyEngine.registerScript(updated)
        return updated
      }),
    }))
  },

  deleteScript: (id) => {
    strategyEngine.unregisterScript(id)
    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== id),
      activeScriptId: state.activeScriptId === id ? null : state.activeScriptId,
    }))
  },

  setActiveScript: (id) => set({ activeScriptId: id }),

  toggleScript: (id) => {
    set((state) => ({
      scripts: state.scripts.map((s) => {
        if (s.id !== id) return s
        const updated = { ...s, isActive: !s.isActive }
        strategyEngine.registerScript(updated)
        return updated
      }),
    }))
  },

  addLog: (message) => {
    set((state) => ({ logs: [...state.logs.slice(-99), `[${new Date().toLocaleTimeString()}] ${message}`] }))
  },

  clearLogs: () => set({ logs: [] }),
  setLastResult: (result) => set({ lastResult: result }),
  setIsRunning: (running) => set({ isRunning: running }),
}))

// Preset strategies
export const PRESET_STRATEGIES = {
  'RSI Oversold': `// Buy when RSI < 30, sell when RSI > 70
const rsi = indicators.rsi(14);
if (rsi < 30 && !position) {
  buy(0.1, { slPips: 20, tpPips: 40 });
  log('RSI oversold buy: ' + rsi.toFixed(2));
}
if (rsi > 70 && position) {
  close();
  log('RSI overbought close: ' + rsi.toFixed(2));
}`,

  'EMA Crossover': `// Buy when price crosses above EMA 200
const ema20 = indicators.ema(20);
const ema50 = indicators.ema(50);
if (ema20 > ema50 && !position) {
  buy(0.1, { slPips: 30, tpPips: 60 });
  log('EMA golden cross buy');
}
if (ema20 < ema50 && position) {
  close();
  log('EMA death cross close');
}`,

  'Bollinger Bounce': `// Buy at lower band, sell at upper band
const bb = indicators.bb(20, 2);
if (candle.close < bb.lower && !position) {
  buy(0.1, { slPips: 15, tpPips: bb.middle - candle.close });
  log('BB bounce buy at lower band');
}
if (candle.close > bb.upper && position) {
  close();
  log('BB bounce close at upper band');
}`,

  'MACD Momentum': `// Buy when MACD histogram turns positive
const macd = indicators.macd(12, 26, 9);
const prevMacd = getVar('prevMacd') || 0;
if (macd.histogram > 0 && prevMacd <= 0 && !position) {
  buy(0.1, { slPips: 25, tpPips: 50 });
  log('MACD momentum buy');
}
if (macd.histogram < 0 && prevMacd >= 0 && position) {
  close();
  log('MACD momentum close');
}
setVar('prevMacd', macd.histogram);`,
}
