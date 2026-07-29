import { useEffect, useRef } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import type { ChartPanelToggles } from '@/components/TradingTerminal'
import ChartTile from './ChartTile'
import { TradingChartSyncEngine } from '@/core/sync/TradingChartSyncEngine'

const LAYOUT_GRID: Record<string, string> = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '1x2': 'grid-cols-2 grid-rows-1',
  '1x3': 'grid-cols-3 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '2x3': 'grid-cols-3 grid-rows-2',
}

interface MultiChartLayoutProps {
  activeTool: string
  onToolSelect: (tool: string) => void
  chartPanels: ChartPanelToggles
  onChartPanelClose: (panel: keyof ChartPanelToggles) => void
}

export default function MultiChartLayout({ activeTool, onToolSelect, chartPanels, onChartPanelClose }: MultiChartLayoutProps) {
  const { layout } = useLayoutStore()
  const gridClass = LAYOUT_GRID[layout.type] || LAYOUT_GRID['1x1']
  const syncEngineRef = useRef<TradingChartSyncEngine | null>(null)

  if (!syncEngineRef.current) {
    syncEngineRef.current = new TradingChartSyncEngine({
      syncCrosshair: layout.syncCrosshair,
      syncSymbol: layout.syncSymbol,
      syncTimeframe: layout.syncTimeframe,
    })
  }

  useEffect(() => {
    syncEngineRef.current?.setGroupOptions({
      syncCrosshair: layout.syncCrosshair,
      syncSymbol: layout.syncSymbol,
      syncTimeframe: layout.syncTimeframe,
    })
  }, [layout.syncCrosshair, layout.syncSymbol, layout.syncTimeframe])

  useEffect(() => {
    const syncEngine = syncEngineRef.current
    return () => syncEngine?.destroy()
  }, [])

  return (
    <div className={`h-full w-full grid ${gridClass} gap-1 bg-chart-bg`}>
      {layout.charts.map((chart) => (
        <ChartTile
          key={chart.id}
          chartId={chart.id}
          isActive={layout.activeChartId === chart.id}
          activeTool={activeTool}
          onToolSelect={onToolSelect}
          chartPanels={chartPanels}
          onChartPanelClose={onChartPanelClose}
          syncEngine={syncEngineRef.current}
        />
      ))}
    </div>
  )
}
