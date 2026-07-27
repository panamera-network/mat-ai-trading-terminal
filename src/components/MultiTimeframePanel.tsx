import { useEffect, useState } from 'react'
import { Symbol, Timeframe, CandleData } from '@/types'
import { generateMockData } from '@/services/dataLoader'
import { mt5Feed } from '@/services/mt5Feed'
import { binanceFeed } from '@/services/binanceFeed'

const ALL_TFS: Timeframe[] = ['15m', '1H', '4H', '1D', '1W']
const HISTORY_CAP = 60
const TARGET_BARS = 30

// generateMockData's `days` param controls how much history it synthesizes,
// not bar count directly — scale it per timeframe so every mini-chart gets
// roughly the same number of bars instead of 1W producing almost none from
// a fixed day count.
const BAR_DAYS: Record<Timeframe, number> = {
  '1m': (TARGET_BARS * 1) / (24 * 60),
  '5m': (TARGET_BARS * 5) / (24 * 60),
  '15m': (TARGET_BARS * 15) / (24 * 60),
  '1H': (TARGET_BARS * 1) / 24,
  '4H': (TARGET_BARS * 4) / 24,
  '1D': TARGET_BARS * 1,
  '1W': TARGET_BARS * 7,
}

interface MultiTimeframePanelProps {
  symbol: Symbol
  primaryTimeframe: Timeframe
}

function useTimeframeCandles(symbol: Symbol, timeframe: Timeframe) {
  const [data, setData] = useState<CandleData[]>(() => generateMockData(symbol, timeframe, BAR_DAYS[timeframe]))

  useEffect(() => {
    setData(generateMockData(symbol, timeframe, BAR_DAYS[timeframe]))

    const feed = symbol.exchange === 'binance' ? binanceFeed : mt5Feed
    const id = feed.connect(symbol, timeframe, {
      onCandle: (candle: CandleData) => {
        setData((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.time === candle.time) {
            return [...prev.slice(0, -1), candle]
          }
          return [...prev.slice(-(HISTORY_CAP - 1)), candle]
        })
      },
      // This is a secondary glance subscription, not the chart actually trading
      // this symbol — must not drive position/pending-order simulation itself.
      driveOrders: false,
    })

    return () => feed.disconnect(id)
  }, [symbol.id, symbol.exchange, timeframe])

  return data
}

function MiniChart({ timeframe, data, digits }: { timeframe: Timeframe; data: CandleData[]; digits: number }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1e222d] rounded px-2 py-3 text-center text-[10px] text-gray-500">
        {timeframe} — no data
      </div>
    )
  }

  const highs = data.map((d) => d.high)
  const lows = data.map((d) => d.low)
  const max = Math.max(...highs)
  const min = Math.min(...lows)
  const range = max - min || 1
  const height = 44

  const lastClose = data[data.length - 1].close
  const firstOpen = data[0].open
  const change = ((lastClose - firstOpen) / firstOpen) * 100

  return (
    <div className="bg-[#1e222d] rounded px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-300 font-semibold">{timeframe}</span>
        <span className="text-[10px] text-white font-mono">{lastClose.toFixed(digits)}</span>
        <span className={`text-[10px] font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${data.length} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {data.map((bar, i) => {
          const yOpen = height - ((bar.open - min) / range) * height
          const yClose = height - ((bar.close - min) / range) * height
          const yHigh = height - ((bar.high - min) / range) * height
          const yLow = height - ((bar.low - min) / range) * height
          const isGreen = bar.close >= bar.open
          const color = isGreen ? '#26a69a' : '#ef5350'
          return (
            <g key={bar.time}>
              <line x1={i + 0.5} y1={yHigh} x2={i + 0.5} y2={yLow} stroke={color} strokeWidth={0.5} />
              <line x1={i + 0.5} y1={yOpen} x2={i + 0.5} y2={yClose} stroke={color} strokeWidth={2} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TimeframeRow({ symbol, timeframe }: { symbol: Symbol; timeframe: Timeframe }) {
  const data = useTimeframeCandles(symbol, timeframe)
  return <MiniChart timeframe={timeframe} data={data} digits={symbol.digits} />
}

export default function MultiTimeframePanel({ symbol, primaryTimeframe }: MultiTimeframePanelProps) {
  const secondaryTFs = ALL_TFS.filter((tf) => tf !== primaryTimeframe).slice(0, 4)

  return (
    <div className="w-56 bg-[#161a25] border-l border-gray-800 p-2 space-y-2 overflow-y-auto flex-shrink-0">
      <h4 className="text-gray-400 text-[10px] uppercase tracking-wider">Multi-Timeframe — {symbol.name}</h4>
      {secondaryTFs.map((tf) => (
        <TimeframeRow key={tf} symbol={symbol} timeframe={tf} />
      ))}
    </div>
  )
}
