import { useLayoutStore } from '@/stores/layoutStore'
import ChartTile from './ChartTile'

const LAYOUT_GRID: Record<string, string> = {
  '1x1': 'grid-cols-1 grid-rows-1',
  '1x2': 'grid-cols-2 grid-rows-1',
  '1x3': 'grid-cols-3 grid-rows-1',
  '2x2': 'grid-cols-2 grid-rows-2',
  '2x3': 'grid-cols-3 grid-rows-2',
}

export default function MultiChartLayout() {
  const { layout } = useLayoutStore()
  const gridClass = LAYOUT_GRID[layout.type] || LAYOUT_GRID['1x1']

  return (
    <div className={`h-full w-full grid ${gridClass} gap-1 bg-chart-bg`}>
      {layout.charts.map((chart) => (
        <ChartTile
          key={chart.id}
          chartId={chart.id}
          isActive={layout.activeChartId === chart.id}
        />
      ))}
    </div>
  )
}
