import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { TradingChartController } from '@/core/chart/TradingChartController'
import {
  DrawingSelectionInfo,
  DrawingRuntimePlugin,
  isDrawingRuntimeTool,
} from '@/core/drawing/DrawingRuntimePlugin'
import { DrawingModel, DrawingPersistenceScope } from '@/core/drawing/DrawingModel'
import { DrawingType, Timeframe } from '@/types'

interface PluginDrawingLayerProps {
  controller: TradingChartController
  container: HTMLElement | null
  activeTool: DrawingType
  onToolSelect: (tool: string) => void
  onDrawingInteractionChange?: (isInteracting: boolean) => void
  onSelectedDrawingChange?: (selection: DrawingSelectionInfo | null) => void
  persistenceScope: DrawingPersistenceScope
  timeframe: Timeframe
  magnetEnabled: boolean
}

export interface PluginDrawingLayerHandle {
  deleteSelected: () => void
  exportDrawings: () => DrawingModel[]
  updateSelectedStyle: (style: { lineColor?: string; lineWidth?: number }) => void
}

export function isPluginDrawingTool(tool: DrawingType | string): boolean {
  return isDrawingRuntimeTool(tool)
}

const PluginDrawingLayer = forwardRef<PluginDrawingLayerHandle, PluginDrawingLayerProps>(function PluginDrawingLayer({
  controller,
  container,
  activeTool,
  onToolSelect,
  onDrawingInteractionChange,
  onSelectedDrawingChange,
  persistenceScope,
  timeframe,
  magnetEnabled,
}, ref) {
  const pluginRef = useRef<DrawingRuntimePlugin | null>(null)

  useImperativeHandle(ref, () => ({
    deleteSelected: () => pluginRef.current?.deleteSelected(),
    exportDrawings: () => pluginRef.current?.exportDrawings() ?? [],
    updateSelectedStyle: (style) => pluginRef.current?.updateSelectedStyle(style),
  }), [])

  useEffect(() => {
    if (!container) return
    const plugin = new DrawingRuntimePlugin({
      container,
      onToolSelect,
      onDrawingInteractionChange,
      onSelectedDrawingChange,
      persistenceScope,
      magnetEnabled,
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
      onSelectedDrawingChange,
    })
  }, [onToolSelect, onDrawingInteractionChange, onSelectedDrawingChange])

  useEffect(() => {
    pluginRef.current?.setActiveTool(activeTool)
  }, [activeTool])

  useEffect(() => {
    pluginRef.current?.setPersistenceScope(persistenceScope)
  }, [persistenceScope])

  useEffect(() => {
    pluginRef.current?.setTimeframe(timeframe)
  }, [timeframe])

  useEffect(() => {
    pluginRef.current?.setMagnetEnabled(magnetEnabled)
  }, [magnetEnabled])

  return null
})

export default PluginDrawingLayer
