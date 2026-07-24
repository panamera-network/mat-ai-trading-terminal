import { create } from 'zustand'
import { LayoutConfig, ChartInstance, CandleData, Symbol, Timeframe, ChartType, ALL_SYMBOLS, Drawing } from '@/types'
import { nanoid } from 'nanoid'

// Drawing command for undo/redo
interface DrawingCommand {
  id: string
  type: 'add' | 'delete' | 'update' | 'clear'
  chartId: string
  drawing: Drawing
  prevDrawing?: Drawing
  timestamp: number
}

interface LayoutStore {
  layout: LayoutConfig
  crosshairPosition: { time: number; price: number } | null
  magnetMode: boolean

  // Drawing command stacks per chart
  drawingStacks: Map<string, { undo: DrawingCommand[]; redo: DrawingCommand[] }>
  
  // Actions
  setLayout: (layout: LayoutConfig) => void
  addChart: (symbol?: Symbol, timeframe?: Timeframe, chartType?: ChartType) => string
  removeChart: (chartId: string) => void
  updateChart: (chartId: string, updates: Partial<ChartInstance>) => void
  setActiveChart: (chartId: string | null) => void
  updateChartData: (chartId: string, data: CandleData[]) => void
  appendCandle: (chartId: string, candle: CandleData) => void
  updateLastPrice: (chartId: string, price: number, change: number, changePct: number) => void
  
  // Drawing actions with undo/redo
  addDrawing: (chartId: string, drawing: Drawing) => void
  updateDrawing: (chartId: string, drawingId: string, updates: Partial<Drawing>) => void
  removeDrawing: (chartId: string, drawingId: string) => void
  selectDrawing: (chartId: string, drawingId: string | null) => void
  toggleLockDrawing: (chartId: string, drawingId: string) => void
  toggleLockAllDrawings: (chartId: string) => void
  clearDrawings: (chartId: string) => void
  undoDrawing: (chartId: string) => void
  redoDrawing: (chartId: string) => void
  canUndoDrawing: (chartId: string) => boolean
  canRedoDrawing: (chartId: string) => boolean

  // Sync toggles
  toggleSyncCrosshair: () => void
  toggleSyncSymbol: () => void
  toggleSyncTimeframe: () => void
  setLayoutType: (type: LayoutConfig['type']) => void
  setCrosshairPosition: (pos: { time: number; price: number } | null) => void
  toggleMagnetMode: () => void
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  layout: {
    type: '1x1',
    charts: [createDefaultChart()],
    activeChartId: null,
    syncCrosshair: true,
    syncSymbol: false,
    syncTimeframe: false,
  },
  crosshairPosition: null,
  magnetMode: false,
  drawingStacks: new Map(),

  setLayout: (layout) => set({ layout }),

  addChart: (symbol, timeframe, chartType) => {
    const id = nanoid(6)
    const chart = createDefaultChart(id, symbol, timeframe, chartType)
    set((state) => ({
      layout: {
        ...state.layout,
        charts: [...state.layout.charts, chart],
      },
    }))
    return id
  },

  removeChart: (chartId) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.filter((c) => c.id !== chartId),
        activeChartId: state.layout.activeChartId === chartId ? null : state.layout.activeChartId,
      },
      drawingStacks: (() => {
        const newStacks = new Map(state.drawingStacks)
        newStacks.delete(chartId)
        return newStacks
      })(),
    }))
  },

  updateChart: (chartId, updates) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId ? { ...c, ...updates } : c
        ),
      },
    }))
  },

  setActiveChart: (chartId) => {
    set((state) => ({
      layout: { ...state.layout, activeChartId: chartId },
    }))
  },

  updateChartData: (chartId, data) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId ? { ...c, data } : c
        ),
      },
    }))
  },

  appendCandle: (chartId, candle) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) => {
          if (c.id !== chartId) return c
          const last = c.data[c.data.length - 1]
          if (last && last.time === candle.time) {
            return { ...c, data: [...c.data.slice(0, -1), candle] }
          }
          return { ...c, data: [...c.data, candle] }
        }),
      },
    }))
  },

  updateLastPrice: (chartId, price, change, changePct) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId
            ? { ...c, lastPrice: price, dailyChange: change, dailyChangePercent: changePct }
            : c
        ),
      },
    }))
  },

  // Drawing actions with undo/redo
  addDrawing: (chartId, drawing) => {
    const cmd: DrawingCommand = {
      id: `cmd-${Date.now()}`,
      type: 'add',
      chartId,
      drawing: { ...drawing },
      timestamp: Date.now(),
    }
    
    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      const stack = newStacks.get(chartId) || { undo: [], redo: [] }
      newStacks.set(chartId, { undo: [...stack.undo, cmd], redo: [] })
      
      return {
        layout: {
          ...state.layout,
          charts: state.layout.charts.map((c) =>
            c.id === chartId ? { ...c, drawings: [...c.drawings, drawing] } : c
          ),
        },
        drawingStacks: newStacks,
      }
    })
  },

  updateDrawing: (chartId, drawingId, updates) => {
    const chart = get().layout.charts.find((c) => c.id === chartId)
    if (!chart) return
    
    const prev = chart.drawings.find((d) => d.id === drawingId)
    if (!prev) return

    const cmd: DrawingCommand = {
      id: `cmd-${Date.now()}`,
      type: 'update',
      chartId,
      drawing: { ...prev, ...updates },
      prevDrawing: { ...prev },
      timestamp: Date.now(),
    }

    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      const stack = newStacks.get(chartId) || { undo: [], redo: [] }
      newStacks.set(chartId, { undo: [...stack.undo, cmd], redo: [] })

      return {
        layout: {
          ...state.layout,
          charts: state.layout.charts.map((c) =>
            c.id === chartId
              ? { ...c, drawings: c.drawings.map((d) => (d.id === drawingId ? { ...d, ...updates } : d)) }
              : c
          ),
        },
        drawingStacks: newStacks,
      }
    })
  },

  removeDrawing: (chartId, drawingId) => {
    const chart = get().layout.charts.find((c) => c.id === chartId)
    if (!chart) return
    
    const drawing = chart.drawings.find((d) => d.id === drawingId)
    if (!drawing) return

    const cmd: DrawingCommand = {
      id: `cmd-${Date.now()}`,
      type: 'delete',
      chartId,
      drawing: { ...drawing },
      timestamp: Date.now(),
    }

    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      const stack = newStacks.get(chartId) || { undo: [], redo: [] }
      newStacks.set(chartId, { undo: [...stack.undo, cmd], redo: [] })

      return {
        layout: {
          ...state.layout,
          charts: state.layout.charts.map((c) =>
            c.id === chartId
              ? { ...c, drawings: c.drawings.filter((d) => d.id !== drawingId) }
              : c
          ),
        },
        drawingStacks: newStacks,
      }
    })
  },

  selectDrawing: (chartId, drawingId) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId ? { ...c, selectedDrawing: drawingId } : c
        ),
      },
    }))
  },

  toggleLockDrawing: (chartId, drawingId) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId
            ? { ...c, drawings: c.drawings.map((d) => (d.id === drawingId ? { ...d, locked: !d.locked } : d)) }
            : c
        ),
      },
    }))
  },

  toggleLockAllDrawings: (chartId) => {
    set((state) => ({
      layout: {
        ...state.layout,
        charts: state.layout.charts.map((c) =>
          c.id === chartId
            ? { ...c, drawings: c.drawings.map((d) => ({ ...d, locked: !d.locked })) }
            : c
        ),
      },
    }))
  },

  clearDrawings: (chartId) => {
    const chart = get().layout.charts.find((c) => c.id === chartId)
    if (!chart || chart.drawings.length === 0) return

    const cmd: DrawingCommand = {
      id: `cmd-${Date.now()}`,
      type: 'clear',
      chartId,
      drawing: chart.drawings[0],
      timestamp: Date.now(),
    }

    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      const stack = newStacks.get(chartId) || { undo: [], redo: [] }
      newStacks.set(chartId, { undo: [...stack.undo, cmd], redo: [] })

      return {
        layout: {
          ...state.layout,
          charts: state.layout.charts.map((c) =>
            c.id === chartId ? { ...c, drawings: [] } : c
          ),
        },
        drawingStacks: newStacks,
      }
    })
  },

  undoDrawing: (chartId) => {
    const { drawingStacks, layout } = get()
    const stack = drawingStacks.get(chartId)
    if (!stack || stack.undo.length === 0) return

    const cmd = stack.undo[stack.undo.length - 1]
    const newUndo = stack.undo.slice(0, -1)
    const newRedo = [...stack.redo, cmd]

    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      newStacks.set(chartId, { undo: newUndo, redo: newRedo })

      let newCharts = [...layout.charts]
      const chartIndex = newCharts.findIndex((c) => c.id === chartId)
      if (chartIndex === -1) return state

      const chart = newCharts[chartIndex]
      let newDrawings = [...chart.drawings]

      switch (cmd.type) {
        case 'add':
          newDrawings = newDrawings.filter((d) => d.id !== cmd.drawing.id)
          break
        case 'delete':
          newDrawings = [...newDrawings, cmd.drawing]
          break
        case 'update':
          if (cmd.prevDrawing) {
            newDrawings = newDrawings.map((d) => (d.id === cmd.drawing.id ? cmd.prevDrawing! : d))
          }
          break
        case 'clear':
          // Simplified: clear undo not fully supported
          break
      }

      newCharts[chartIndex] = { ...chart, drawings: newDrawings }

      return { layout: { ...layout, charts: newCharts }, drawingStacks: newStacks }
    })
  },

  redoDrawing: (chartId) => {
    const { drawingStacks, layout } = get()
    const stack = drawingStacks.get(chartId)
    if (!stack || stack.redo.length === 0) return

    const cmd = stack.redo[stack.redo.length - 1]
    const newRedo = stack.redo.slice(0, -1)
    const newUndo = [...stack.undo, cmd]

    set((state) => {
      const newStacks = new Map(state.drawingStacks)
      newStacks.set(chartId, { undo: newUndo, redo: newRedo })

      let newCharts = [...layout.charts]
      const chartIndex = newCharts.findIndex((c) => c.id === chartId)
      if (chartIndex === -1) return state

      const chart = newCharts[chartIndex]
      let newDrawings = [...chart.drawings]

      switch (cmd.type) {
        case 'add':
          newDrawings = [...newDrawings, cmd.drawing]
          break
        case 'delete':
          newDrawings = newDrawings.filter((d) => d.id !== cmd.drawing.id)
          break
        case 'update':
          newDrawings = newDrawings.map((d) => (d.id === cmd.drawing.id ? cmd.drawing : d))
          break
      }

      newCharts[chartIndex] = { ...chart, drawings: newDrawings }

      return { layout: { ...layout, charts: newCharts }, drawingStacks: newStacks }
    })
  },

  canUndoDrawing: (chartId) => {
    const stack = get().drawingStacks.get(chartId)
    return stack ? stack.undo.length > 0 : false
  },

  canRedoDrawing: (chartId) => {
    const stack = get().drawingStacks.get(chartId)
    return stack ? stack.redo.length > 0 : false
  },

  toggleSyncCrosshair: () => {
    set((state) => ({
      layout: { ...state.layout, syncCrosshair: !state.layout.syncCrosshair },
    }))
  },

  toggleSyncSymbol: () => {
    set((state) => ({
      layout: { ...state.layout, syncSymbol: !state.layout.syncSymbol },
    }))
  },

  toggleSyncTimeframe: () => {
    set((state) => ({
      layout: { ...state.layout, syncTimeframe: !state.layout.syncTimeframe },
    }))
  },

  setLayoutType: (type) => {
    set((state) => ({
      layout: { ...state.layout, type },
    }))
  },

  setCrosshairPosition: (pos) => set({ crosshairPosition: pos }),

  toggleMagnetMode: () => set((state) => ({ magnetMode: !state.magnetMode })),
}))

function createDefaultChart(
  id?: string,
  symbol?: Symbol,
  timeframe?: Timeframe,
  chartType?: ChartType
): ChartInstance {
  return {
    id: id || nanoid(6),
    symbol: symbol || ALL_SYMBOLS[0],  // ← EURUSD object
    timeframe: timeframe || '1H',
    chartType: chartType || 'candlestick',
    drawings: [],
    indicators: [],
    data: [],
    lastPrice: null,
    dailyChange: null,
    dailyChangePercent: null,
    selectedDrawing: null,
  }
}