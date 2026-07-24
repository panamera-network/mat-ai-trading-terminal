import { create } from 'zustand'
import { BacktestConfig, BacktestState, BacktestResult, HistoricalCandle } from '@/types/backtest'
import { backtestEngine } from '@/services/backtestEngine'
import { orderService } from '@/services/orderService'

interface BacktestStore {
  isBacktestMode: boolean
  config: BacktestConfig | null
  state: BacktestState | null
  result: BacktestResult | null
  data: HistoricalCandle[]

  // Actions
  enterBacktestMode: () => void
  exitBacktestMode: () => void
  loadData: (data: HistoricalCandle[], config: BacktestConfig) => void
  play: () => void
  pause: () => void
  stop: () => void
  step: () => void
  stepBack: () => void
  seekTo: (cursor: number) => void
  setSpeed: (speed: number) => void
  setState: (state: BacktestState) => void
  setResult: (result: BacktestResult) => void
  reset: () => void
}

export const useBacktestStore = create<BacktestStore>((set, get) => ({
  isBacktestMode: false,
  config: null,
  state: null,
  result: null,
  data: [],

  enterBacktestMode: () => {
    set({ isBacktestMode: true })
  },

  exitBacktestMode: () => {
    backtestEngine.stop()
    set({ isBacktestMode: false, config: null, state: null, result: null, data: [] })
  },

  loadData: (data, config) => {
    backtestEngine.loadData(data, config)
    set({ data, config, state: backtestEngine.getState() })
  },

  play: () => {
    backtestEngine.play()
    set({ state: backtestEngine.getState() })
  },

  pause: () => {
    backtestEngine.pause()
    set({ state: backtestEngine.getState() })
  },

  stop: () => {
    backtestEngine.stop()
    set({ state: backtestEngine.getState(), result: null })
  },

  step: () => {
    backtestEngine.step()
    set({ state: backtestEngine.getState() })
  },

  stepBack: () => {
    backtestEngine.stepBack()
    set({ state: backtestEngine.getState() })
  },

  seekTo: (cursor) => {
    backtestEngine.seekTo(cursor)
    set({ state: backtestEngine.getState() })
  },

  setSpeed: (speed) => {
    backtestEngine.setSpeed(speed)
    set({ state: backtestEngine.getState() })
  },

  setState: (state) => set({ state }),
  setResult: (result) => set({ result }),

  reset: () => {
    backtestEngine.stop()
    orderService.reset()
    set({ config: null, state: null, result: null, data: [] })
  },
}))
