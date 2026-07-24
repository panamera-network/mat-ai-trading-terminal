import { useEffect, useCallback, useRef } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'

export type ShortcutContext = 'global' | 'chart' | 'order' | 'drawing'

export interface ShortcutConfig {
  key: string
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[]
  context: ShortcutContext
  action: string
  description: string
}

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Global
  { key: '1', context: 'global', action: 'tool_cursor', description: 'Select cursor tool' },
  { key: '2', context: 'global', action: 'tool_trendline', description: 'Select trendline tool' },
  { key: '3', context: 'global', action: 'tool_horizontal', description: 'Select horizontal line' },
  { key: '4', context: 'global', action: 'tool_vertical', description: 'Select vertical line' },
  { key: '5', context: 'global', action: 'tool_ray', description: 'Select ray tool' },
  { key: '6', context: 'global', action: 'tool_extended', description: 'Select extended line' },
  { key: '7', context: 'global', action: 'tool_fibonacci', description: 'Select Fibonacci retracement' },
  { key: '8', context: 'global', action: 'tool_rectangle', description: 'Select rectangle' },
  { key: '9', context: 'global', action: 'tool_text', description: 'Select text tool' },
  { key: '0', context: 'global', action: 'tool_measure', description: 'Select measure tool' },

  // Drawing
  { key: 'Escape', context: 'drawing', action: 'cancel_drawing', description: 'Cancel drawing / deselect' },
  { key: 'Delete', context: 'drawing', action: 'delete_selected', description: 'Delete selected drawing' },
  { key: 'Backspace', context: 'drawing', action: 'delete_selected', description: 'Delete selected drawing' },
  { key: 'm', modifiers: ['ctrl'], context: 'drawing', action: 'toggle_magnet', description: 'Toggle magnet mode' },
  { key: 'l', modifiers: ['ctrl'], context: 'drawing', action: 'toggle_lock', description: 'Toggle lock drawings' },

  // Undo/Redo
  { key: 'z', modifiers: ['ctrl'], context: 'global', action: 'undo', description: 'Undo last action' },
  { key: 'y', modifiers: ['ctrl'], context: 'global', action: 'redo', description: 'Redo last action' },
  { key: 'z', modifiers: ['ctrl', 'shift'], context: 'global', action: 'redo', description: 'Redo last action' },

  // Chart navigation
  { key: '+', modifiers: ['ctrl'], context: 'chart', action: 'zoom_in', description: 'Zoom in' },
  { key: '-', modifiers: ['ctrl'], context: 'chart', action: 'zoom_out', description: 'Zoom out' },
  { key: '0', modifiers: ['ctrl'], context: 'chart', action: 'reset_zoom', description: 'Reset zoom' },
  { key: 'ArrowUp', context: 'chart', action: 'pan_up', description: 'Pan chart up' },
  { key: 'ArrowDown', context: 'chart', action: 'pan_down', description: 'Pan chart down' },
  { key: 'ArrowLeft', context: 'chart', action: 'pan_left', description: 'Pan chart left' },
  { key: 'ArrowRight', context: 'chart', action: 'pan_right', description: 'Pan chart right' },

  // Backtest
  { key: ' ', context: 'global', action: 'bt_play_pause', description: 'Play/Pause backtest' },
  { key: '.', context: 'global', action: 'bt_step', description: 'Step forward' },
  { key: ',', context: 'global', action: 'bt_step_back', description: 'Step back' },

  // Order quick actions
  { key: 'b', context: 'order', action: 'quick_buy', description: 'Quick buy market' },
  { key: 's', context: 'order', action: 'quick_sell', description: 'Quick sell market' },
  { key: 'c', context: 'order', action: 'close_position', description: 'Close position' },

  // Layout
  { key: 'Tab', context: 'global', action: 'cycle_chart', description: 'Cycle chart focus' },
  { key: '?', context: 'global', action: 'show_help', description: 'Show keyboard shortcuts' },
]

export function useKeyboardShortcuts(
  chartId: string,
  chartRef: React.RefObject<any>,
  activeTool: string,
  setActiveTool: (tool: string) => void,
  onQuickBuy?: () => void,
  onQuickSell?: () => void,
  onClosePosition?: () => void
) {
  const undoDrawing = useLayoutStore((s) => s.undoDrawing)
  const redoDrawing = useLayoutStore((s) => s.redoDrawing)
  const toggleMagnetMode = useLayoutStore((s) => s.toggleMagnetMode)
  const toggleLockAllDrawings = useLayoutStore((s) => s.toggleLockAllDrawings)
  const selectDrawingRaw = useLayoutStore((s) => s.selectDrawing)
  const undo = useCallback(() => undoDrawing(chartId), [undoDrawing, chartId])
  const redo = useCallback(() => redoDrawing(chartId), [redoDrawing, chartId])
  const toggleLockAll = useCallback(() => toggleLockAllDrawings(chartId), [toggleLockAllDrawings, chartId])
  const selectDrawing = useCallback((id: string | null) => selectDrawingRaw(chartId, id), [selectDrawingRaw, chartId])
  const { layout, setActiveChart } = useLayoutStore()
  const { isBacktestMode, play, pause, step, stepBack } = useBacktestStore()
  const btState = useBacktestStore((s) => s.state)
  const inputRef = useRef(false)

  // Track if user is typing in an input
  useEffect(() => {
    const handleFocus = () => { inputRef.current = true }
    const handleBlur = () => { inputRef.current = false }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)
    return () => {
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [])

  const executeAction = useCallback((action: string) => {
    switch (action) {
      // Tool selection
      case 'tool_cursor': setActiveTool('cursor'); break
      case 'tool_trendline': setActiveTool('trendline'); break
      case 'tool_horizontal': setActiveTool('horizontal'); break
      case 'tool_vertical': setActiveTool('vertical'); break
      case 'tool_ray': setActiveTool('ray'); break
      case 'tool_extended': setActiveTool('extended'); break
      case 'tool_fibonacci': setActiveTool('fibonacci'); break
      case 'tool_rectangle': setActiveTool('rectangle'); break
      case 'tool_text': setActiveTool('text'); break
      case 'tool_measure': setActiveTool('measure'); break

      // Drawing
      case 'cancel_drawing':
        setActiveTool('cursor')
        selectDrawing(null)
        break
      case 'delete_selected':
        // Handled in DrawingOverlay
        break
      case 'toggle_magnet':
        toggleMagnetMode()
        break
      case 'toggle_lock':
        toggleLockAll()
        break

      // Undo/Redo
      case 'undo':
        undo()
        break
      case 'redo':
        redo()
        break

      // Chart navigation
      case 'zoom_in':
        if (chartRef.current) {
          const timeScale = chartRef.current.timeScale()
          const visibleRange = timeScale.getVisibleLogicalRange()
          if (visibleRange) {
            const center = (visibleRange.from + visibleRange.to) / 2
            const range = (visibleRange.to - visibleRange.from) * 0.8
            timeScale.setVisibleLogicalRange({ from: center - range / 2, to: center + range / 2 })
          }
        }
        break
      case 'zoom_out':
        if (chartRef.current) {
          const timeScale = chartRef.current.timeScale()
          const visibleRange = timeScale.getVisibleLogicalRange()
          if (visibleRange) {
            const center = (visibleRange.from + visibleRange.to) / 2
            const range = (visibleRange.to - visibleRange.from) * 1.25
            timeScale.setVisibleLogicalRange({ from: center - range / 2, to: center + range / 2 })
          }
        }
        break
      case 'reset_zoom':
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent()
        }
        break
      case 'pan_up':
        if (chartRef.current) {
          const priceScale = chartRef.current.priceScale('right')
          // Panning implementation depends on lightweight-charts API
        }
        break
      case 'pan_down':
        if (chartRef.current) {
          const priceScale = chartRef.current.priceScale('right')
        }
        break
      case 'pan_left':
        if (chartRef.current) {
          const timeScale = chartRef.current.timeScale()
          const visibleRange = timeScale.getVisibleLogicalRange()
          if (visibleRange) {
            timeScale.setVisibleLogicalRange({
              from: visibleRange.from - 5,
              to: visibleRange.to - 5,
            })
          }
        }
        break
      case 'pan_right':
        if (chartRef.current) {
          const timeScale = chartRef.current.timeScale()
          const visibleRange = timeScale.getVisibleLogicalRange()
          if (visibleRange) {
            timeScale.setVisibleLogicalRange({
              from: visibleRange.from + 5,
              to: visibleRange.to + 5,
            })
          }
        }
        break

      // Backtest
      case 'bt_play_pause':
        if (isBacktestMode) {
          if (btState?.isPlaying) pause()
          else play()
        }
        break
      case 'bt_step':
        if (isBacktestMode) step()
        break
      case 'bt_step_back':
        if (isBacktestMode) stepBack()
        break

      // Orders
      case 'quick_buy':
        onQuickBuy?.()
        break
      case 'quick_sell':
        onQuickSell?.()
        break
      case 'close_position':
        onClosePosition?.()
        break

      // Layout
      case 'cycle_chart':
        const charts = layout.charts
        const currentIdx = charts.findIndex((c) => c.id === layout.activeChartId)
        const nextIdx = (currentIdx + 1) % charts.length
        setActiveChart(charts[nextIdx]?.id || null)
        break
      case 'show_help':
        // Show help modal - handled by parent
        break
    }
  }, [setActiveTool, undo, redo, toggleMagnetMode, toggleLockAll, selectDrawing, chartRef, isBacktestMode, btState, play, pause, step, stepBack, layout, setActiveChart, onQuickBuy, onQuickSell, onClosePosition])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      if (inputRef.current) return

      // Skip if modifier keys only
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

      const modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[] = []
      if (e.ctrlKey) modifiers.push('ctrl')
      if (e.shiftKey) modifiers.push('shift')
      if (e.altKey) modifiers.push('alt')
      if (e.metaKey) modifiers.push('meta')

      const shortcut = DEFAULT_SHORTCUTS.find((s) => {
        const keyMatch = s.key.toLowerCase() === e.key.toLowerCase()
        const modMatch = JSON.stringify((s.modifiers || []).sort()) === JSON.stringify(modifiers.sort())
        return keyMatch && modMatch
      })

      if (shortcut) {
        e.preventDefault()
        executeAction(shortcut.action)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [executeAction])

  return { shortcuts: DEFAULT_SHORTCUTS }
}

export function getShortcutDisplay(shortcut: ShortcutConfig): string {
  const mods = shortcut.modifiers?.map((m) => {
    if (m === 'ctrl') return 'Ctrl'
    if (m === 'shift') return 'Shift'
    if (m === 'alt') return 'Alt'
    if (m === 'meta') return 'Cmd'
    return m
  }) || []
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key
  return [...mods, key].join('+')
}
