import { useState } from 'react'
import { useBacktestStore } from '@/stores/backtestStore'
import { generateMockData } from '@/services/dataLoader'
import { ALL_SYMBOLS } from '@/types/market'

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D']
const DURATION_OPTIONS = [
  { label: '1 Week', days: 7 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
]

interface BacktestSetupProps {
  variant?: 'modal' | 'panel'
  onClose?: () => void
}

export default function BacktestSetup({ variant = 'modal', onClose }: BacktestSetupProps) {
  const { enterBacktestMode, loadData } = useBacktestStore()
  const [symbolId, setSymbolId] = useState('EURUSD')
  const [timeframe, setTimeframe] = useState('1H')
  const [duration, setDuration] = useState(30)
  const [initialBalance, setInitialBalance] = useState(10000)
  const [spread, setSpread] = useState<'variable' | 'fixed'>('variable')
  const [fixedSpread, setFixedSpread] = useState(0.00015)
  const [isLoading, setIsLoading] = useState(false)

  const symbol = ALL_SYMBOLS.find((s) => s.id === symbolId)!

  const handleStart = async () => {
    setIsLoading(true)

    // Generate mock data (or load from CSV in production)
    const data = generateMockData(symbol, timeframe, duration)

    const config = {
      symbol,
      timeframe,
      startDate: new Date(data[0].time * 1000),
      endDate: new Date(data[data.length - 1].time * 1000),
      initialBalance,
      spread: spread === 'variable' ? 'variable' as const : fixedSpread,
      commission: 0.0003,
      slippage: 1,
    }

    enterBacktestMode()
    loadData(data, config)
    setIsLoading(false)
    onClose?.()
  }

  const handleCancel = () => {
    useBacktestStore.getState().exitBacktestMode()
    onClose?.()
  }

  const content = (
    <div className={variant === 'modal' ? 'bg-[#161a25] border border-gray-700 rounded-lg w-[400px] p-5' : 'h-full min-h-0 text-xs text-gray-400 flex flex-col'}>
      <h2 className={variant === 'modal' ? 'text-white text-lg font-semibold mb-4' : 'text-white text-xs font-semibold uppercase tracking-wide mb-3 flex-shrink-0'}>
        Backtest Setup
      </h2>

      <div className={variant === 'modal' ? 'space-y-3' : 'grid grid-cols-2 lg:grid-cols-3 gap-3 min-h-0 overflow-y-auto pr-1'}>
          {/* Symbol */}
          <div>
            <label className="text-gray-500 text-xs uppercase block mb-1">Symbol</label>
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(e.target.value)}
              className="w-full bg-[#1e222d] text-white text-sm px-3 py-2 rounded border border-gray-700 outline-none"
            >
              {ALL_SYMBOLS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-gray-500 text-xs uppercase block mb-1">Timeframe</label>
            <div className="grid grid-cols-6 gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`py-1.5 text-xs rounded border transition-colors ${
                    timeframe === tf
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#1e222d] border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-gray-500 text-xs uppercase block mb-1">Duration</label>
            <div className="grid grid-cols-5 gap-1">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.days}
                  onClick={() => setDuration(d.days)}
                  className={`py-1.5 text-xs rounded border transition-colors ${
                    duration === d.days
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#1e222d] border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Balance */}
          <div>
            <label className="text-gray-500 text-xs uppercase block mb-1">Initial Balance ($)</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              className="w-full bg-[#1e222d] text-white text-sm px-3 py-2 rounded border border-gray-700 outline-none"
              min={100}
              step={100}
            />
          </div>

          {/* Spread */}
          <div>
            <label className="text-gray-500 text-xs uppercase block mb-1">Spread</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSpread('variable')}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  spread === 'variable'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#1e222d] border-gray-700 text-gray-400'
                }`}
              >
                Variable
              </button>
              <button
                onClick={() => setSpread('fixed')}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  spread === 'fixed'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#1e222d] border-gray-700 text-gray-400'
                }`}
              >
                Fixed
              </button>
            </div>
            {spread === 'fixed' && (
              <input
                type="number"
                value={fixedSpread}
                onChange={(e) => setFixedSpread(Number(e.target.value))}
                className="w-full mt-2 bg-[#1e222d] text-white text-sm px-3 py-2 rounded border border-gray-700 outline-none"
                step={0.00001}
              />
            )}
          </div>
      </div>

      {/* Actions */}
      <div className={variant === 'modal' ? 'flex gap-2 mt-5' : 'flex gap-2 mt-3 justify-end flex-shrink-0'}>
        <button
          onClick={handleCancel}
          className={variant === 'modal' ? 'flex-1 py-2 text-sm rounded border border-gray-700 text-gray-400 hover:text-white transition-colors' : 'px-4 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white transition-colors'}
        >
          Cancel
        </button>
        <button
          onClick={handleStart}
          disabled={isLoading}
          className={variant === 'modal' ? 'flex-1 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50' : 'px-4 py-1.5 text-xs rounded bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50'}
        >
          {isLoading ? 'Loading...' : 'Start Backtest'}
        </button>
      </div>
    </div>
  )

  if (variant === 'panel') return content

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      {content}
    </div>
  )
}
