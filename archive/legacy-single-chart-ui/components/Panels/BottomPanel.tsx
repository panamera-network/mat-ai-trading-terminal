import { useState } from 'react'
import { Activity, List, TrendingUp, Settings } from 'lucide-react'

type PanelTab = 'trades' | 'orders' | 'positions' | 'settings'

export default function BottomPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('trades')
  const [isExpanded, setIsExpanded] = useState(false)

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: 'trades', label: 'Trades', icon: <Activity size={14} /> },
    { id: 'orders', label: 'Orders', icon: <List size={14} /> },
    { id: 'positions', label: 'Positions', icon: <TrendingUp size={14} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={14} /> },
  ]

  return (
    <div 
      className={`bg-chart-panel border-t border-chart-border transition-all duration-200 ${
        isExpanded ? 'h-64' : 'h-8'
      }`}
    >
      {/* Tab Bar */}
      <div className="flex items-center h-8 border-b border-chart-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 h-full text-xs transition-colors ${
              activeTab === tab.id 
                ? 'bg-chart-bg text-white border-t-2 border-blue-500' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-chart-border'
            }`}
            onClick={() => {
              setActiveTab(tab.id)
              setIsExpanded(true)
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        <div className="flex-1" />

        <button 
          className="px-3 text-gray-400 hover:text-white text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Panel Content */}
      {isExpanded && (
        <div className="p-3 h-[calc(100%-2rem)] overflow-auto">
          {activeTab === 'trades' && (
            <div className="text-sm text-gray-400">
              <div className="flex items-center justify-center h-32">
                No trades yet. Place an order to see trades here.
              </div>
            </div>
          )}
          {activeTab === 'orders' && (
            <div className="text-sm text-gray-400">
              <div className="flex items-center justify-center h-32">
                No open orders.
              </div>
            </div>
          )}
          {activeTab === 'positions' && (
            <div className="text-sm text-gray-400">
              <div className="flex items-center justify-center h-32">
                No open positions.
              </div>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="text-sm text-gray-400 space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-chart-border">
                <span>Chart Type</span>
                <select className="bg-chart-bg border border-chart-border rounded px-2 py-1 text-xs">
                  <option>Candlestick</option>
                  <option>Bar</option>
                  <option>Line</option>
                  <option>Area</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-chart-border">
                <span>Show Volume</span>
                <input type="checkbox" defaultChecked className="accent-blue-500" />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-chart-border">
                <span>Show Grid</span>
                <input type="checkbox" defaultChecked className="accent-blue-500" />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-chart-border">
                <span>Magnet Mode</span>
                <input type="checkbox" className="accent-blue-500" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}