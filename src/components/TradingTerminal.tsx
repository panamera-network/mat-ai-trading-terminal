import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'
import MultiChartLayout from '@/components/MultiChartLayout'
import LayoutSelector from '@/components/LayoutSelector'
import BacktestControlBar from '@/components/BacktestControlBar'
import BacktestResults from '@/components/BacktestResults'
import BacktestSetup from '@/components/BacktestSetup'

export default function TradingTerminal() {
  const { layout } = useLayoutStore()
  const { isBacktestMode, state: btState } = useBacktestStore()
  const activeChart = layout.charts.find((c) => c.id === layout.activeChartId)

  return (
    <div className="h-screen w-screen bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-10 bg-[#161a25] border-b border-gray-800 flex items-center px-3 justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">MAT.ai Terminal</span>
          <span className="text-gray-600 text-xs">v2.0</span>
          {isBacktestMode && (
            <span className="text-[10px] bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded border border-purple-800">
              BACKTEST MODE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isBacktestMode && (
            <button
              onClick={() => useBacktestStore.getState().enterBacktestMode()}
              className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded transition-colors"
            >
              Backtest
            </button>
          )}
          {isBacktestMode && (
            <button
              onClick={() => useBacktestStore.getState().exitBacktestMode()}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
            >
              Exit Backtest
            </button>
          )}
          <span className="text-gray-500 text-xs">
            {activeChart?.symbol?.name || 'Select chart'}
          </span>
          {activeChart?.lastPrice && !isBacktestMode && (
            <span className="text-white text-xs font-mono">
              {activeChart.lastPrice.toFixed(activeChart.symbol.digits)}
            </span>
          )}
        </div>
      </div>

      {/* Layout selector (hide in backtest) */}
      {!isBacktestMode && <LayoutSelector />}

      {/* Backtest control bar */}
      {isBacktestMode && <BacktestControlBar />}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Charts */}
        <div className="flex-1 min-w-0">
          <MultiChartLayout />
        </div>

        {/* Backtest results panel */}
        {isBacktestMode && <BacktestResults />}
      </div>

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

      {/* Backtest setup modal */}
      {isBacktestMode && !btState && <BacktestSetup />}
    </div>
  )
}