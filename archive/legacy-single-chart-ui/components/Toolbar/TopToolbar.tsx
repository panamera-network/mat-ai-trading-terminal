import { useState } from 'react'
import { 
  Search, Clock, BarChart3, Layers, Maximize2, 
  Crosshair, Undo2, Redo2, Trash2, Settings,
  ChevronDown, CandlestickChart, TrendingUp, Minus, Activity
} from 'lucide-react'
import { useChartStore } from '@/stores/chartStore'
import { Timeframe, ChartType } from '@/types'
import IndicatorsModal from './IndicatorsModal'

const TIMEFRAMES: Timeframe[] = [
  '1m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M'
]

const SYMBOLS = [
  'BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD',
  'EURUSD=X', 'GBPUSD=X', 'USDJPY=X',
  'AAPL', 'TSLA', 'NVDA'
]

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: 'candlestick', label: 'Candlestick', icon: <CandlestickChart size={14} /> },
  { type: 'bar', label: 'Bar', icon: <BarChart3 size={14} /> },
  { type: 'line', label: 'Line', icon: <TrendingUp size={14} /> },
  { type: 'area', label: 'Area', icon: <Activity size={14} /> },
]

export default function TopToolbar() {
  const { 
    symbol, timeframe, setSymbol, setTimeframe, 
    settings, updateSettings, setChartType, undo, redo, canUndo, canRedo
  } = useChartStore()

  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false)
  const [showTfDropdown, setShowTfDropdown] = useState(false)
  const [showChartTypeDropdown, setShowChartTypeDropdown] = useState(false)
  const [showIndicatorsModal, setShowIndicatorsModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSymbols = SYMBOLS.filter(s => 
    s.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const currentChartType = CHART_TYPES.find(c => c.type === settings.chartType)

  return (
    <div className="relative">
      <div className="h-10 bg-chart-panel border-b border-chart-border flex items-center px-2 gap-1">
        {/* Symbol Selector */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-chart-border transition-colors text-sm font-medium min-w-[100px]"
            onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
          >
            <Search size={14} className="text-gray-400" />
            <span>{symbol}</span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>

          {showSymbolDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-chart-panel border border-chart-border rounded-lg shadow-xl z-50">
              <div className="p-2">
                <input
                  type="text"
                  placeholder="Search symbol..."
                  className="w-full px-3 py-1.5 bg-chart-bg border border-chart-border rounded text-sm focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSymbols.map(s => (
                  <button
                    key={s}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-chart-border transition-colors"
                    onClick={() => { setSymbol(s); setShowSymbolDropdown(false); setSearchQuery('') }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-chart-border mx-1" />

        {/* Timeframe Selector */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-chart-border transition-colors text-sm"
            onClick={() => setShowTfDropdown(!showTfDropdown)}
          >
            <Clock size={14} className="text-gray-400" />
            <span>{timeframe}</span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>

          {showTfDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-chart-panel border border-chart-border rounded-lg shadow-xl z-50">
              <div className="grid grid-cols-4 gap-px p-2">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    className={`px-2 py-1.5 text-xs rounded hover:bg-chart-border transition-colors ${
                      tf === timeframe ? 'bg-blue-600 text-white' : ''
                    }`}
                    onClick={() => { setTimeframe(tf); setShowTfDropdown(false) }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-chart-border mx-1" />

        {/* Chart Type */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 px-3 py-1.5 rounded hover:bg-chart-border transition-colors text-sm"
            onClick={() => setShowChartTypeDropdown(!showChartTypeDropdown)}
          >
            {currentChartType?.icon}
            <span className="hidden sm:inline">{currentChartType?.label}</span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>

          {showChartTypeDropdown && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-chart-panel border border-chart-border rounded-lg shadow-xl z-50">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.type}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-chart-border transition-colors ${
                    ct.type === settings.chartType ? 'text-blue-400' : ''
                  }`}
                  onClick={() => { setChartType(ct.type); setShowChartTypeDropdown(false) }}
                >
                  {ct.icon}
                  {ct.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Indicators */}
        <button 
          className={`p-1.5 rounded transition-colors ${showIndicatorsModal ? 'bg-blue-600 text-white' : 'hover:bg-chart-border'}`}
          title="Indicators"
          onClick={() => setShowIndicatorsModal(!showIndicatorsModal)}
        >
          <Layers size={16} />
        </button>

        {/* Layout */}
        <button className="p-1.5 rounded hover:bg-chart-border transition-colors" title="Layout">
          <Maximize2 size={16} />
        </button>

        {/* Crosshair Mode */}
        <button 
          className={`p-1.5 rounded transition-colors ${settings.showCrosshair ? 'bg-chart-border' : 'hover:bg-chart-border'}`}
          title="Crosshair"
          onClick={() => updateSettings({ showCrosshair: !settings.showCrosshair })}
        >
          <Crosshair size={16} />
        </button>

        <div className="flex-1" />

        {/* Undo */}
        <button 
          className={`p-1.5 rounded transition-colors ${canUndo() ? 'hover:bg-chart-border text-gray-300' : 'text-gray-600 cursor-not-allowed'}`}
          title="Undo"
          onClick={undo}
          disabled={!canUndo()}
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button 
          className={`p-1.5 rounded transition-colors ${canRedo() ? 'hover:bg-chart-border text-gray-300' : 'text-gray-600 cursor-not-allowed'}`}
          title="Redo"
          onClick={redo}
          disabled={!canRedo()}
        >
          <Redo2 size={16} />
        </button>

        {/* Delete */}
        <button className="p-1.5 rounded hover:bg-chart-border transition-colors text-red-400" title="Delete">
          <Trash2 size={16} />
        </button>

        <div className="w-px h-5 bg-chart-border mx-1" />

        {/* Settings */}
        <button className="p-1.5 rounded hover:bg-chart-border transition-colors" title="Settings">
          <Settings size={16} />
        </button>
      </div>

      {/* Indicators Modal */}
      <IndicatorsModal 
        isOpen={showIndicatorsModal} 
        onClose={() => setShowIndicatorsModal(false)} 
      />
    </div>
  )
}