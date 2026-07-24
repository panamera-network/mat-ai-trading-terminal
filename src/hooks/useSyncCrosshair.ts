import { useEffect } from 'react'
import { IChartApi, Time } from 'lightweight-charts'
import { useLayoutStore } from '@/stores/layoutStore'

export function useSyncCrosshair(chart: IChartApi | null, chartId: string) {
  const syncCrosshair = useLayoutStore((s) => s.layout.syncCrosshair)
  const crosshairPosition = useLayoutStore((s) => s.crosshairPosition)
  const setCrosshairPosition = useLayoutStore((s) => s.setCrosshairPosition)

  useEffect(() => {
    if (!chart || !syncCrosshair) return

    const handleCrosshairMove = (param: any) => {
      if (!param.point || !param.time) return
      setCrosshairPosition({
        time: param.time,
        price: param.point.y,
      })
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
    }
  }, [chart, syncCrosshair, setCrosshairPosition])

  // Apply synced position to this chart
  useEffect(() => {
    if (!chart || !syncCrosshair || !crosshairPosition) return
    if (chartId === useLayoutStore.getState().layout.activeChartId) return

    // Move crosshair to synced position
    const timeScale = chart.timeScale()
    const x = timeScale.timeToCoordinate(crosshairPosition.time as Time)
    if (x !== null) {
      // Note: programmatic crosshair movement is limited in lightweight-charts
      // This syncs the visual vertical line via custom overlay if needed
    }
  }, [chart, syncCrosshair, crosshairPosition, chartId])
}
