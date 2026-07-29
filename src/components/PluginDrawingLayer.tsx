import { useEffect, useRef } from 'react'
import { TradingChartController } from '@/core/chart/TradingChartController'
import {
  DrawingRuntimePlugin,
  isDrawingRuntimeTool,
} from '@/core/drawing/DrawingRuntimePlugin'
import { DrawingType } from '@/types'

interface PluginDrawingLayerProps {
  controller: TradingChartController
  container: HTMLElement | null
  activeTool: DrawingType
  onToolSelect: (tool: string) => void
  onDrawingInteractionChange?: (isInteracting: boolean) => void
}

export function isPluginDrawingTool(tool: DrawingType | string): boolean {
  return isDrawingRuntimeTool(tool)
}

export default function PluginDrawingLayer({
  controller,
  container,
  activeTool,
  onToolSelect,
  onDrawingInteractionChange,
}: PluginDrawingLayerProps) {
  const pluginRef = useRef<DrawingRuntimePlugin | null>(null)

  useEffect(() => {
    if (!container) return
    const plugin = new DrawingRuntimePlugin({
      container,
      onToolSelect,
      onDrawingInteractionChange,
    })
    pluginRef.current = plugin
    controller.use(plugin)

    return () => {
      controller.removePlugin(plugin.id)
      if (pluginRef.current === plugin) pluginRef.current = null
    }
  }, [controller, container])

  useEffect(() => {
    pluginRef.current?.setCallbacks({
      onToolSelect,
      onDrawingInteractionChange,
    })
  }, [onToolSelect, onDrawingInteractionChange])

  useEffect(() => {
    pluginRef.current?.setActiveTool(activeTool)
  }, [activeTool])

  return null
}
