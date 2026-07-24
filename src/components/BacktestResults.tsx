import { useBacktestStore } from '@/stores/backtestStore'
import { exportResultsToCSV } from '@/services/dataLoader'

export default function BacktestResults() {
  const { result, config } = useBacktestStore()

  if (!result) {
    return (
      <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex items-center justify-center">
        <span className="text-gray-600 text-xs">Run backtest to see results</span>
      </div>
    )
  }

  const handleExport = () => {
    const csv = exportResultsToCSV(result)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backtest-${config?.symbol.id}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = [
    { label: 'Final Balance', value: `$${result.finalBalance.toFixed(2)}`, color: result.finalBalance >= (config?.initialBalance || 0) ? 'text-green-400' : 'text-red-400' },
    { label: 'Total Return', value: `${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`, color: result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Total Trades', value: result.totalTrades.toString(), color: 'text-white' },
    { label: 'Win Rate', value: `${result.winRate.toFixed(1)}%`, color: result.winRate >= 50 ? 'text-green-400' : 'text-yellow-400' },
    { label: 'Profit Factor', value: result.profitFactor.toFixed(2), color: result.profitFactor >= 1.5 ? 'text-green-400' : 'text-yellow-400' },
    { label: 'Max Drawdown', value: `${result.maxDrawdown.toFixed(2)} (${result.maxDrawdownPercent.toFixed(2)}%)`, color: 'text-red-400' },
    { label: 'Sharpe Ratio', value: result.sharpeRatio.toFixed(2), color: result.sharpeRatio >= 1 ? 'text-green-400' : 'text-yellow-400' },
  ]

  return (
    <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full overflow-auto">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold">Backtest Results</h3>
        <button
          onClick={handleExport}
          className="text-[10px] text-blue-400 hover:text-blue-300"
        >
          Export CSV
        </button>
      </div>

      <div className="p-3 space-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">{stat.label}</span>
            <span className={`text-xs font-mono font-medium ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Equity curve mini chart */}
      {result.equityCurve.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800">
          <h4 className="text-gray-400 text-[10px] uppercase mb-2">Equity Curve</h4>
          <EquityMiniChart data={result.equityCurve} />
        </div>
      )}

      {/* Trade list */}
      {result.trades.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800 flex-1 overflow-auto">
          <h4 className="text-gray-400 text-[10px] uppercase mb-2">Trades</h4>
          <div className="space-y-1">
            {result.trades.slice(0, 20).map((trade) => (
              <div
                key={trade.id}
                className="flex justify-between text-xs bg-[#1e222d] rounded px-2 py-1"
              >
                <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                  {trade.side.toUpperCase()}
                </span>
                <span className="text-white font-mono">{trade.price.toFixed(5)}</span>
                <span className="text-gray-500">{trade.size.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EquityMiniChart({ data }: { data: { time: number; equity: number }[] }) {
  if (data.length < 2) return null

  const width = 240
  const height = 80
  const padding = 4

  const minEquity = Math.min(...data.map((d) => d.equity))
  const maxEquity = Math.max(...data.map((d) => d.equity))
  const range = maxEquity - minEquity || 1

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.equity - minEquity) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const startEquity = data[0].equity
  const endEquity = data[data.length - 1].equity
  const isPositive = endEquity >= startEquity

  return (
    <svg width={width} height={height} className="bg-[#1e222d] rounded">
      <polyline
        fill="none"
        stroke={isPositive ? '#26a69a' : '#ef5350'}
        strokeWidth="1.5"
        points={points.join(' ')}
      />
      {/* Area fill */}
      <polygon
        fill={isPositive ? 'rgba(38, 166, 154, 0.1)' : 'rgba(239, 83, 80, 0.1)'}
        points={`${points[0]} ${points.join(' ')} ${points[points.length - 1].split(',')[0]},${height}`}
      />
    </svg>
  )
}
