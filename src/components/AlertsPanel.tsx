import { useState } from 'react'
import { useAlertsStore } from '@/stores/alertsStore'
import { ALL_SYMBOLS } from '@/types/market'

interface AlertsPanelProps {
  symbol: string
}

export default function AlertsPanel({ symbol }: AlertsPanelProps) {
  const { alerts, addAlert, removeAlert, clearTriggered } = useAlertsStore()
  const [price, setPrice] = useState('')
  const [direction, setDirection] = useState<'above' | 'below' | 'touch'>('above')
  const [message, setMessage] = useState('')
  const [sound, setSound] = useState(true)
  const [notification, setNotification] = useState(false)

  const symbolAlerts = alerts.filter((a) => a.symbol === symbol)
  const activeAlerts = symbolAlerts.filter((a) => !a.triggered)
  const triggeredAlerts = symbolAlerts.filter((a) => a.triggered)

  const handleAdd = () => {
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) return
    addAlert({
      symbol,
      price: p,
      direction,
      message: message || `Price ${direction} ${p}`,
      sound,
      notification,
    })
    setPrice('')
    setMessage('')
  }

  return (
    <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">Price Alerts</h3>
        <span className="text-gray-500 text-[10px]">{symbol}</span>
      </div>

      {/* Add alert */}
      <div className="px-3 py-2 space-y-2 border-b border-gray-800">
        <div className="flex gap-2">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className="flex-1 bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
          />
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'above' | 'below' | 'touch')}
            className="bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
            <option value="touch">Touch</option>
          </select>
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (optional)"
          className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
        />
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-[10px] text-gray-400">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-blue-500" />
            Sound
          </label>
          <label className="flex items-center gap-1 text-[10px] text-gray-400">
            <input type="checkbox" checked={notification} onChange={(e) => setNotification(e.target.checked)} className="accent-blue-500" />
            Notification
          </label>
        </div>
        <button
          onClick={handleAdd}
          disabled={!price}
          className="w-full py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
        >
          Add Alert
        </button>
      </div>

      {/* Active alerts */}
      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-500 text-[10px] uppercase">Active ({activeAlerts.length})</span>
        </div>
        {activeAlerts.length === 0 && <span className="text-gray-600 text-[10px]">No active alerts</span>}
        <div className="space-y-1">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1">
              <div className="text-xs">
                <span className={alert.direction === 'above' ? 'text-green-400' : alert.direction === 'below' ? 'text-red-400' : 'text-blue-400'}>
                  {alert.direction === 'above' ? '▲' : alert.direction === 'below' ? '▼' : '↔'}
                </span>
                <span className="text-white ml-1">{alert.price}</span>
                <span className="text-gray-500 ml-1 text-[10px]">{alert.message}</span>
              </div>
              <button onClick={() => removeAlert(alert.id)} className="text-gray-500 hover:text-red-400 text-xs">×</button>
            </div>
          ))}
        </div>

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-3 mb-1">
              <span className="text-gray-500 text-[10px] uppercase">Triggered ({triggeredAlerts.length})</span>
              <button onClick={clearTriggered} className="text-[10px] text-gray-500 hover:text-gray-300">Clear</button>
            </div>
            <div className="space-y-1">
              {triggeredAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between bg-yellow-900/20 rounded px-2 py-1 border border-yellow-900/50">
                  <div className="text-xs">
                    <span className="text-yellow-400">✓</span>
                    <span className="text-white ml-1">{alert.price}</span>
                    <span className="text-gray-500 ml-1 text-[10px]">{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
