import { useState, useEffect } from 'react'
import { DEFAULT_SHORTCUTS, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts'

interface KeyboardHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const groups = {
    'Drawing Tools': DEFAULT_SHORTCUTS.filter((s) => s.action.startsWith('tool_')),
    'Drawing Actions': DEFAULT_SHORTCUTS.filter((s) => ['cancel_drawing', 'delete_selected', 'toggle_magnet', 'toggle_lock'].includes(s.action)),
    'Navigation': DEFAULT_SHORTCUTS.filter((s) => ['zoom_in', 'zoom_out', 'reset_zoom', 'pan_up', 'pan_down', 'pan_left', 'pan_right', 'cycle_chart'].includes(s.action)),
    'Undo/Redo': DEFAULT_SHORTCUTS.filter((s) => ['undo', 'redo'].includes(s.action)),
    'Backtest': DEFAULT_SHORTCUTS.filter((s) => s.action.startsWith('bt_')),
    'Orders': DEFAULT_SHORTCUTS.filter((s) => ['quick_buy', 'quick_sell', 'close_position'].includes(s.action)),
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#161a25] border border-gray-700 rounded-lg w-[500px] max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <h3 className="text-gray-500 text-[10px] uppercase font-semibold mb-2">{group}</h3>
              <div className="space-y-1">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{s.description}</span>
                    <kbd className="bg-[#1e222d] border border-gray-700 rounded px-2 py-0.5 text-gray-400 font-mono text-[10px]">
                      {getShortcutDisplay(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 text-center">
          <span className="text-gray-500 text-[10px]">Press ? anytime to show this help</span>
        </div>
      </div>
    </div>
  )
}
