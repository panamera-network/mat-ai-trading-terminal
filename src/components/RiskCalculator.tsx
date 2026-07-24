import { useState, useMemo } from 'react'
import { Symbol } from '@/types/market'

interface RiskCalculatorProps {
  symbol: Symbol
  accountBalance: number
  entryPrice: number
  onApply?: (result: { positionSize: number; stopLoss: number; takeProfit: number }) => void
}

interface RiskResult {
  positionSize: number
  riskAmount: number
  rewardAmount?: number
  rrRatio?: number
  maxLots: number
  pipDistance: number
  isValid: boolean
  warning?: string
}

export default function RiskCalculator({ symbol, accountBalance, entryPrice, onApply }: RiskCalculatorProps) {
  const [riskPercent, setRiskPercent] = useState(1)
  const [stopLoss, setStopLoss] = useState(entryPrice * 0.99)
  const [takeProfit, setTakeProfit] = useState(entryPrice * 1.02)

  const result = useMemo<RiskResult>(() => {
    const slDistance = Math.abs(entryPrice - stopLoss)
    const tpDistance = Math.abs(takeProfit - entryPrice)
    const slPips = slDistance / symbol.pipSize

    const riskAmount = (accountBalance * riskPercent) / 100
    const positionSize = slPips > 0 ? riskAmount / (slPips * symbol.pipValue) : 0
    const roundedSize = Math.floor(positionSize * 100) / 100
    const maxLots = Math.floor((accountBalance / 1000) * 100) / 100

    const rewardAmount = tpDistance > 0 ? roundedSize * (tpDistance / symbol.pipSize) * symbol.pipValue : undefined
    const rrRatio = rewardAmount && riskAmount > 0 ? rewardAmount / riskAmount : undefined

    let warning: string | undefined
    if (roundedSize > maxLots) warning = 'Position size exceeds available margin'
    if (riskPercent > 5) warning = 'Risk > 5% — high risk trade'
    if (slPips < 10) warning = 'Stop loss < 10 pips — very tight'

    return {
      positionSize: roundedSize,
      riskAmount,
      rewardAmount,
      rrRatio,
      maxLots,
      pipDistance: slPips,
      isValid: roundedSize > 0 && roundedSize <= maxLots,
      warning,
    }
  }, [symbol, accountBalance, riskPercent, entryPrice, stopLoss, takeProfit])

  return (
    <div className="px-3 py-2 space-y-2 border-t border-gray-800">
      <h4 className="text-gray-400 text-[10px] uppercase">Risk Calculator</h4>

      <div>
        <label className="text-gray-500 text-[10px] uppercase flex justify-between">
          <span>Risk</span>
          <span>{riskPercent.toFixed(1)}%</span>
        </label>
        <input
          type="range" min="0.1" max="10" step="0.1"
          value={riskPercent}
          onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-500 text-[10px] uppercase">Stop Loss</label>
          <input
            type="number" step={symbol.pipSize} value={stopLoss}
            onChange={(e) => setStopLoss(parseFloat(e.target.value))}
            className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none focus:border-red-500"
          />
          <span className="text-[10px] text-gray-500">{result.pipDistance.toFixed(1)} pips</span>
        </div>
        <div>
          <label className="text-gray-500 text-[10px] uppercase">Take Profit</label>
          <input
            type="number" step={symbol.pipSize} value={takeProfit}
            onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
            className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none focus:border-green-500"
          />
        </div>
      </div>

      <div className={`rounded px-2 py-1.5 text-xs space-y-1 ${result.isValid ? 'bg-[#1e222d]' : 'bg-red-950/40 border border-red-900'}`}>
        <div className="flex justify-between">
          <span className="text-gray-500">Position Size</span>
          <span className="text-white font-semibold">{result.positionSize.toFixed(2)} lots</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Risk Amount</span>
          <span className="text-red-400">${result.riskAmount.toFixed(2)}</span>
        </div>
        {result.rewardAmount !== undefined && (
          <>
            <div className="flex justify-between">
              <span className="text-gray-500">Reward</span>
              <span className="text-green-400">${result.rewardAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">R:R</span>
              <span className={result.rrRatio && result.rrRatio >= 2 ? 'text-green-400' : 'text-yellow-400'}>
                1:{result.rrRatio?.toFixed(2)}
              </span>
            </div>
          </>
        )}
        {result.warning && <div className="text-yellow-400 text-[10px]">⚠ {result.warning}</div>}
      </div>

      <button
        onClick={() => onApply?.({ positionSize: result.positionSize, stopLoss, takeProfit })}
        disabled={!result.isValid}
        className="w-full py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
      >
        Apply to Order
      </button>
    </div>
  )
}
