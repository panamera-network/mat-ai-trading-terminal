import { useEffect, useRef } from 'react'
import { OHLCV, Indicator } from '@/types'
import { IndicatorPanelRuntime } from '@/core/indicators/IndicatorPanelRuntime'

interface IndicatorPanelProps {
  data: OHLCV[]
  indicator: Indicator
}

export default function IndicatorPanel({ data, indicator }: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<IndicatorPanelRuntime | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const runtime = new IndicatorPanelRuntime(containerRef.current)
    runtimeRef.current = runtime
    return () => {
      runtime.destroy()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    runtimeRef.current?.setIndicator(data, indicator)
  }, [data, indicator])

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-0.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
        {indicator.name}
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}
