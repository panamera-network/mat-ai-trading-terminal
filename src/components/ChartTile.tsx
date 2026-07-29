import { useRef, useEffect, useState, useCallback } from 'react'
import {
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts'
import { X } from 'lucide-react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'
import { useRealtimeFeed } from '@/hooks/useRealtimeFeed'
import { useSyncCrosshair } from '@/hooks/useSyncCrosshair'
import { useStrategyRunner } from '@/hooks/useStrategyRunner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useOrderStore } from '@/stores/orderStore'
import { alertsService } from '@/services/alertsService'
import type { ChartPanelToggles } from '@/components/TradingTerminal'
import OrderPanel from './OrderPanel'
import DOMPanel from './DOMPanel'
import StrategyPanel from './StrategyPanel'
import PositionLines from './PositionLines'
import ChartContextMenu from './ChartContextMenu'
import AlertsPanel from './AlertsPanel'
import PnLDashboard from './PnLDashboard'
import TradeJournal from './TradeJournal'
import MultiTimeframePanel from './MultiTimeframePanel'
import KeyboardHelpModal from './KeyboardHelpModal'
import IndicatorsModal from './IndicatorsModal'
import IndicatorOverlay from './IndicatorOverlay'
import IndicatorPanel from './IndicatorPanel'
import VolumeProfileIndicator from './VolumeProfileIndicator'
import PluginDrawingLayer from './PluginDrawingLayer'
import { TradingChartController } from '@/core/chart/TradingChartController'

interface ChartTileProps {
  chartId: string
  isActive: boolean
  activeTool: string
  onToolSelect: (tool: string) => void
  chartPanels: ChartPanelToggles
  onChartPanelClose: (panel: keyof ChartPanelToggles) => void
}

export default function ChartTile({ chartId, isActive, activeTool, onToolSelect, chartPanels, onChartPanelClose }: ChartTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const controllerRef = useRef<TradingChartController | null>(null)
  const isDrawingInteractionRef = useRef(false)
  const followRealtimeRef = useRef(true)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const [mainSeries, setMainSeries] = useState<ISeriesApi<any> | null>(null)
  const [chartContainer, setChartContainer] = useState<HTMLDivElement | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const chart = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)!)
  const updateChart = useLayoutStore((s) => s.updateChart)
  const setActiveChart = useLayoutStore((s) => s.setActiveChart)
  const removeChart = useLayoutStore((s) => s.removeChart)

  const isBacktestMode = useBacktestStore((s) => s.isBacktestMode)
  const backtestState = useBacktestStore((s) => s.state)
  const backtestData = useBacktestStore((s) => s.data)

  const { isConnected, getPrices } = useRealtimeFeed(chartId, chart.symbol, chart.timeframe)
  const prices = getPrices()

  const placeOrder = useOrderStore((s) => s.placeOrder)

  useSyncCrosshair(chartRef.current, chartId)

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    setChartContainer(node)
  }, [])

  const btCandle = isBacktestMode && backtestState?.currentCandle ? backtestState.currentCandle : null
  const bid = btCandle ? btCandle.bid.close : (prices?.bid || chart.lastPrice || 0)
  const ask = btCandle ? btCandle.ask.close : (prices?.ask || chart.lastPrice || 0)
  const spread = btCandle ? btCandle.spread : (prices?.spread || 0.00015)

  // Quick buy/sell for keyboard shortcuts
  const handleQuickBuy = useCallback(async () => {
    const currentPrice = (bid + ask) / 2
    await placeOrder({ symbol: chart.symbol, side: 'buy', type: 'market', size: 0.1, currentPrice, spread, bid, ask })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  const handleQuickSell = useCallback(async () => {
    const currentPrice = (bid + ask) / 2
    await placeOrder({ symbol: chart.symbol, side: 'sell', type: 'market', size: 0.1, currentPrice, spread, bid, ask })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  const handleClosePosition = useCallback(async () => {
    const position = useOrderStore.getState().positions.find((p) => p.symbol === chart.symbol.id)
    if (!position) return
    const currentPrice = (bid + ask) / 2
    await placeOrder({
      symbol: chart.symbol,
      side: position.side === 'buy' ? 'sell' : 'buy',
      type: 'market',
      size: position.size,
      currentPrice,
      spread,
      bid,
      ask,
    })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  // Keyboard shortcuts
  useKeyboardShortcuts(
    chartId,
    chartRef,
    activeTool,
    onToolSelect,
    handleQuickBuy,
    handleQuickSell,
    handleClosePosition
  )

  // Show help on ? key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowHelp((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return
    const controller = new TradingChartController(containerRef.current, { chartType: chart.chartType })
    controller.initialize()
    const runtime = controller.getUnsafeLightweightRuntime()
    if (!runtime) return
    const chartApi = runtime.chart
    const series = runtime.mainSeries
    chartRef.current = chartApi
    seriesRef.current = series
    volumeSeriesRef.current = runtime.volumeSeries
    controllerRef.current = controller
    setChartApi(chartApi)
    setMainSeries(series)

    const updateFollowRealtime = () => {
      const scrollPosition = chartApi.timeScale().scrollPosition()
      followRealtimeRef.current = scrollPosition <= 1
    }
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(updateFollowRealtime)

    return () => {
      chartApi.timeScale().unsubscribeVisibleLogicalRangeChange(updateFollowRealtime)
      controller.destroy()
      controllerRef.current = null
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      setChartApi(null)
      setMainSeries(null)
    }
  }, [chartId])

  // Handle chart type change
  useEffect(() => {
    if (!controllerRef.current) return
    controllerRef.current.setSeriesType(chart.chartType)
    const runtime = controllerRef.current.getUnsafeLightweightRuntime()
    if (!runtime) return
    const series = runtime.mainSeries
    seriesRef.current = series
    setMainSeries(series)
  }, [chart.chartType])

  // Live mode: update from store
  useEffect(() => {
    const controller = controllerRef.current
    if (isBacktestMode || !controller) return
    if (chart.data.length === 0) {
      controller.clearData()
      return
    }

    const runtimeDataLength = controller.getData().length
    if (runtimeDataLength === 0 || chart.data.length > runtimeDataLength + 1 || chart.data.length < runtimeDataLength) {
      controller.setData(chart.data, 'replace')
    } else {
      controller.updateBar(chart.data[chart.data.length - 1], 'live')
    }

    const runtimeData = controller.getData()
    const lastCandle = runtimeData[runtimeData.length - 1]
    if (!lastCandle) return

    if (chartRef.current && followRealtimeRef.current && !isDrawingInteractionRef.current) {
      chartRef.current.timeScale().scrollToRealTime()
    }

    // Check alerts on price update
    const bid = lastCandle.close - 0.0001
    const ask = lastCandle.close + 0.0001
    alertsService.checkAlerts(chart.symbol.id, bid, ask)
  }, [chart.data, isBacktestMode, chart.symbol.id])

  // Backtest mode: display historical data
  useEffect(() => {
    const controller = controllerRef.current
    if (!isBacktestMode || !controller || !backtestState) return
    const cursor = backtestState.cursor
    const dataToShow = backtestData.slice(0, cursor + 1)
    if (dataToShow.length === 0) {
      controller.clearData()
      return
    }
    if (cursor < 5 || cursor % 10 === 0) {
      controller.setData(dataToShow as any, 'replace')
    } else {
      controller.updateBar(dataToShow[dataToShow.length - 1] as any, 'backtest')
    }

    // Check alerts in backtest
    if (backtestState.currentCandle) {
      const bc = backtestState.currentCandle
      alertsService.checkAlerts(chart.symbol.id, bc.bid.close, bc.ask.close)
    }
  }, [isBacktestMode, backtestState?.cursor, backtestData, chart.chartType, chart.symbol.id])

  // Volume / grid visibility toggles
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: chart.showVolume })
  }, [chart.showVolume])

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        vertLines: { visible: chart.showGrid },
        horzLines: { visible: chart.showGrid },
      },
    })
  }, [chart.showGrid])

  const currentCandle = btCandle || (chart.data.length > 0 ? chart.data[chart.data.length - 1] : null)
  useStrategyRunner(chart.symbol, bid, ask, spread, currentCandle)

  const overlayIndicators = chart.indicators.filter((i) => i.type === 'overlay')
  const panelIndicators = chart.indicators.filter((i) => i.type === 'panel' && i.visible)
  const volumeProfileIndicator = chart.indicators.find((i) => i.type === 'volume-profile' && i.visible)

  return (
    <div className={`relative flex flex-col border ${isActive ? 'border-blue-500' : 'border-gray-800'} bg-chart-bg overflow-hidden`} onClick={() => setActiveChart(chartId)}>
      {/* Chart panel header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#161a25] border-b border-gray-800 min-h-[30px]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-200">{chart.symbol.name}</span>
          <span className="text-[10px] text-gray-500">{chart.timeframe}</span>
          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-blue-400' : 'bg-gray-700'}`} />
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isBacktestMode ? 'bg-purple-900/40 text-purple-300 border-purple-800' : 'bg-emerald-900/30 text-emerald-300 border-emerald-800'}`}>
            {isBacktestMode ? 'BT' : 'LIVE'}
          </span>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          {!isBacktestMode && <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />}
          {bid > 0 && ask > 0 && (
            <span className="text-[11px] font-mono whitespace-nowrap">
              <span className="text-emerald-400">{bid.toFixed(chart.symbol.digits)}</span>
              <span className="text-gray-600 mx-1">|</span>
              <span className="text-red-400">{ask.toFixed(chart.symbol.digits)}</span>
            </span>
          )}
          {currentCandle && (
            <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
              O <span className="text-gray-200">{currentCandle.open.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              H <span className="text-emerald-300">{currentCandle.high.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              L <span className="text-red-300">{currentCandle.low.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              C <span className="text-gray-200">{currentCandle.close.toFixed(chart.symbol.digits)}</span>
            </span>
          )}
          {!isBacktestMode && (
            <button onClick={() => removeChart(chartId)} className="h-6 w-6 text-gray-500 hover:text-red-400 inline-flex items-center justify-center" title="Close chart">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chart + side panels */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="relative bg-chart-bg"
            style={{ height: panelIndicators.length > 0 ? `calc(100% - ${panelIndicators.length * 120}px)` : '100%' }}
          >
            <div ref={setContainerRef} className="absolute inset-0" />
            {chartApi && mainSeries && (
              <PluginDrawingLayer
                chart={chartApi}
                series={mainSeries as any}
                container={chartContainer}
                activeTool={activeTool as any}
                onToolSelect={onToolSelect}
                onDrawingInteractionChange={(isInteracting) => {
                  isDrawingInteractionRef.current = isInteracting
                }}
              />
            )}
            {chartApi && mainSeries && <PositionLines chart={chartApi} series={mainSeries as any} symbol={chart.symbol} />}
            <ChartContextMenu chart={chartApi} series={mainSeries} symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />
            {chartApi && mainSeries && (
              <IndicatorOverlay
                chart={chartApi}
                candleSeries={mainSeries as any}
                data={chart.data}
                indicators={overlayIndicators}
              />
            )}
            {chartApi && mainSeries && volumeProfileIndicator && (
              <VolumeProfileIndicator
                chart={chartApi}
                candleSeries={mainSeries as any}
                data={chart.data}
                visible={true}
                bins={(volumeProfileIndicator.params.bins as number) || 50}
              />
            )}
            {isActive && chartPanels.indicators && (
              <IndicatorsModal chartId={chartId} onClose={() => onChartPanelClose('indicators')} />
            )}
          </div>

          {panelIndicators.length > 0 && (
            <div className="border-t border-gray-800 flex-shrink-0">
              {panelIndicators.map((ind) => (
                <div key={ind.id} className="h-[120px] border-b border-gray-800 last:border-b-0">
                  <IndicatorPanel data={chart.data} indicator={ind} />
                </div>
              ))}
            </div>
          )}

        </div>

        {isActive && chartPanels.alerts && <AlertsPanel symbol={chart.symbol.id} />}
        {isActive && chartPanels.strategy && <StrategyPanel />}
        {isActive && chartPanels.dom && <DOMPanel symbol={chart.symbol} />}
        {isActive && chartPanels.order && <OrderPanel symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />}
        {isActive && chartPanels.pnl && <PnLDashboard symbol={chart.symbol.id} />}
        {isActive && chartPanels.journal && <TradeJournal />}
        {isActive && chartPanels.mtf && <MultiTimeframePanel symbol={chart.symbol} primaryTimeframe={chart.timeframe} />}
      </div>

      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
