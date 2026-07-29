import { useEffect, useRef } from 'react'
import { IChartApi, ISeriesApi } from 'lightweight-charts'
import { OHLCV } from '@/types'
import { VolumeProfileRuntime } from '@/core/indicators/VolumeProfileRuntime'

interface VolumeProfileIndicatorProps {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'> | null
  data: OHLCV[]
  visible: boolean
  bins?: number
}

export default function VolumeProfileIndicator({
  chart, data, visible, bins = 50,
}: VolumeProfileIndicatorProps) {
  const runtimeRef = useRef<VolumeProfileRuntime | null>(null)

  useEffect(() => {
    runtimeRef.current = new VolumeProfileRuntime(chart)
    return () => {
      runtimeRef.current?.cleanup()
      runtimeRef.current = null
    }
  }, [chart])

  useEffect(() => {
    runtimeRef.current?.setVolumeProfile(data, visible, bins)
  }, [data, visible, bins])

  return null
}
