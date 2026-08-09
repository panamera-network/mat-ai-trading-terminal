import { useState } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'
import { ALL_SYMBOLS } from '@/types/market'
import { ChartType, Timeframe } from '@/types'
import MultiChartLayout from '@/components/MultiChartLayout'
import BacktestControlBar from '@/components/BacktestControlBar'
import BacktestResults from '@/components/BacktestResults'
import BottomPanel from '@/components/BottomPanel'
import LeftSidebar from '@/components/LeftSidebar'

export interface ChartPanelToggles {
  indicators: boolean
  alerts: boolean
  strategy: boolean
  dom: boolean
  order: boolean
  pnl: boolean
  journal: boolean
  mtf: boolean
}

const DEFAULT_CHART_PANELS: ChartPanelToggles = {
  indicators: false,
  alerts: false,
  strategy: false,
  dom: false,
  order: false,
  pnl: false,
  journal: false,
  mtf: false,
}

export default function TradingTerminal() {
  const { layout, updateChart } = useLayoutStore()
  const { isBacktestMode, state: btState } = useBacktestStore()
  const [activeTool, setActiveTool] = useState('cursor')
  const [chartPanels, setChartPanels] = useState<ChartPanelToggles>(DEFAULT_CHART_PANELS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backtestSetupOpen, setBacktestSetupOpen] = useState(false)
  const activeChart = layout.charts.find((c) => c.id === layout.activeChartId)
  const panelChart = activeChart ?? layout.charts[0]

  const handleSymbolChange = (symbolId: string) => {
    if (!panelChart) return
    const symbol = ALL_SYMBOLS.find((s) => s.id === symbolId)
    if (symbol) updateChart(panelChart.id, { symbol, data: [] })
  }

  const handleTimeframeChange = (timeframe: Timeframe) => {
    if (panelChart) updateChart(panelChart.id, { timeframe, data: [] })
  }

  const handleChartTypeChange = (chartType: ChartType) => {
    if (panelChart) updateChart(panelChart.id, { chartType })
  }

  const toggleChartPanel = (panel: keyof ChartPanelToggles) => {
    setChartPanels((prev) => ({ ...prev, [panel]: !prev[panel] }))
  }

  const closeChartPanel = (panel: keyof ChartPanelToggles) => {
    setChartPanels((prev) => ({ ...prev, [panel]: false }))
  }

  return (
    <div className="h-screen w-screen bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Terminal bar */}
      <div className="h-10 bg-[#161a25] border-b border-gray-800 flex items-center px-3 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">MAT.ai Terminal</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${isBacktestMode ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-emerald-900/40 text-emerald-300 border-emerald-800'}`}>
            {isBacktestMode ? 'BACKTEST' : 'LIVE'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
            <span className={`h-2 w-2 rounded-full ${panelChart ? 'bg-emerald-500' : 'bg-red-500'}`} />
            MT5 {panelChart ? 'Ready' : 'Offline'}
          </span>
          <span className="text-gray-600 text-xs">Account: local bridge</span>
        </div>
        <div className="flex items-center gap-2">
          {!isBacktestMode && (
            <button
              onClick={() => {
                setSettingsOpen(false)
                setBacktestSetupOpen((prev) => !prev)
              }}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                backtestSetupOpen
                  ? 'bg-violet-900/60 border border-violet-600 text-violet-200'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              Backtest
            </button>
          )}
          {isBacktestMode && (
            <button
              onClick={() => {
                useBacktestStore.getState().exitBacktestMode()
                setBacktestSetupOpen(false)
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
            >
              Exit Backtest
            </button>
          )}
          <button
            onClick={() => {
              setBacktestSetupOpen(false)
              setSettingsOpen((prev) => !prev)
            }}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              settingsOpen
                ? 'bg-violet-900/60 border-violet-600 text-violet-200'
                : 'bg-[#1e222d] hover:bg-gray-700 text-gray-300 border-gray-700'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Chart toolbar */}
      {panelChart && (
        <div className="h-9 bg-[#111827] border-b border-gray-800 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <select value={panelChart.symbol.id} onChange={(e) => handleSymbolChange(e.target.value)} disabled={isBacktestMode} className="bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none disabled:opacity-50">
              {ALL_SYMBOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={panelChart.timeframe} onChange={(e) => handleTimeframeChange(e.target.value as Timeframe)} disabled={isBacktestMode} className="bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none disabled:opacity-50">
              {['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'].map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
            <select value={panelChart.chartType} onChange={(e) => handleChartTypeChange(e.target.value as ChartType)} className="bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none">
              <option value="candlestick">Candles</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="heikin-ashi">Heikin</option>
            </select>
            <button
              onClick={() => toggleChartPanel('indicators')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                chartPanels.indicators
                  ? 'bg-violet-900/60 border-violet-600 text-violet-200'
                  : 'border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              Indicators
            </button>
          </div>

          <div className="flex items-center gap-2">
            {([
              ['alerts', 'Alerts'],
              ['strategy', 'Strategy'],
              ['dom', 'DOM'],
              ['order', 'Order'],
              ['pnl', 'P&L'],
              ['journal', 'Journal'],
              ['mtf', 'MTF'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleChartPanel(key)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  chartPanels[key]
                    ? 'bg-violet-900/60 border-violet-600 text-violet-200'
                    : 'border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backtest control bar */}
      {isBacktestMode && <BacktestControlBar />}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {panelChart && (
          <LeftSidebar
            activeTool={activeTool}
            onToolSelect={setActiveTool}
          />
        )}

        {/* Charts */}
        <div className="flex-1 min-w-0">
          <MultiChartLayout
            activeTool={activeTool}
            onToolSelect={setActiveTool}
            chartPanels={chartPanels}
            onChartPanelClose={closeChartPanel}
          />
        </div>

        {/* Backtest results panel */}
        {isBacktestMode && <BacktestResults />}
      </div>

      {panelChart && (
        <BottomPanel
          chartId={panelChart.id}
          symbol={panelChart.symbol}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          backtestOpen={backtestSetupOpen}
          onBacktestOpenChange={setBacktestSetupOpen}
        />
      )}

      {/* Bottom status bar */}
      <div className="h-6 bg-[#161a25] border-t border-gray-800 flex items-center px-3 justify-between text-[10px] text-gray-500">
        <div className="flex gap-3">
          <span>Charts: {layout.charts.length}</span>
          <span>Layout: {layout.type}</span>
          {isBacktestMode && btState && (
            <>
              <span>Cursor: {btState.cursor}/{btState.totalCandles}</span>
              <span>Speed: {btState.speed}x</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          {!isBacktestMode && (
            <span>Sync: Crosshair={layout.syncCrosshair ? 'ON' : 'OFF'}</span>
          )}
        </div>
      </div>
    </div>
  )
}
