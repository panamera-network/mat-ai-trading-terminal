import { useEffect, useCallback, useRef } from 'react'
import { strategyEngine } from '@/services/strategyEngine'
import { useStrategyStore } from '@/stores/strategyStore'
import { useOrderStore } from '@/stores/orderStore'
import { Symbol } from '@/types/market'

/**
 * Hook to run active strategies on every candle/tick
 * 
 * Usage:
 * const { isRunning, logs } = useStrategyRunner(symbol, bid, ask, spread, candle);
 */
export function useStrategyRunner(
  symbol: Symbol,
  bid: number,
  ask: number,
  spread: number,
  candle: any | null
) {
  const { scripts, addLog, setLastResult } = useStrategyStore()
  const placeOrder = useOrderStore((s) => s.placeOrder)
  const cancelOrder = useOrderStore((s) => s.cancelOrder)
  const modifySLTP = useOrderStore((s) => s.modifySLTP)
  const positions = useOrderStore((s) => s.positions)
  const orders = useOrderStore((s) => s.orders)

  const activeScripts = scripts.filter((s) => s.isActive && s.symbol === symbol.id)
  const position = positions.find((p) => p.symbol === symbol.id)
  const balance = 10000 // TODO: get from account store
  const equity = balance + (position?.unrealizedPnL || 0)

  // Update candle history for indicators
  useEffect(() => {
    if (!candle) return
    strategyEngine.updateCandle(symbol.id, candle)
  }, [candle, symbol.id])

  // Run strategies
  useEffect(() => {
    if (!candle || activeScripts.length === 0) return

    const context = {
      symbol: symbol.id,
      candle,
      bid,
      ask,
      spread,
      position: position || null,
      balance,
      equity,
    }

    for (const script of activeScripts) {
      strategyEngine.runScript(script.id, context).then((result) => {
        setLastResult(result)

        // Execute actions
        for (const action of result.actions) {
          handleAction(action, symbol, bid, ask, spread)
        }

        // Log
        for (const log of result.logs) {
          addLog(`[${script.name}] ${log}`)
        }
      })
    }
  }, [candle?.time, activeScripts.length, bid, ask, spread])

  const handleAction = useCallback(
    async (action: any, sym: Symbol, b: number, a: number, sp: number) => {
      const currentPrice = (b + a) / 2
      const size = action.size || 0.1

      switch (action.type) {
        case 'buy':
          await placeOrder({
            symbol: sym,
            side: 'buy',
            type: 'market',
            size,
            currentPrice,
            spread: sp,
            bid: b,
            ask: a,
            slPrice: action.slPrice || (action.slPips ? b - action.slPips * sym.pipSize : undefined),
            tpPrice: action.tpPrice || (action.tpPips ? a + action.tpPips * sym.pipSize : undefined),
          })
          break

        case 'sell':
          await placeOrder({
            symbol: sym,
            side: 'sell',
            type: 'market',
            size,
            currentPrice,
            spread: sp,
            bid: b,
            ask: a,
            slPrice: action.slPrice || (action.slPips ? a + action.slPips * sym.pipSize : undefined),
            tpPrice: action.tpPrice || (action.tpPips ? b - action.tpPips * sym.pipSize : undefined),
          })
          break

        case 'close':
          // Close position by placing opposite market order
          if (position) {
            await placeOrder({
              symbol: sym,
              side: position.side === 'buy' ? 'sell' : 'buy',
              type: 'market',
              size: position.size,
              currentPrice,
              spread: sp,
              bid: b,
              ask: a,
            })
          }
          break

        case 'modify_sl':
          if (position && action.slPips) {
            const newSL = position.side === 'buy'
              ? position.entryPrice - action.slPips * sym.pipSize
              : position.entryPrice + action.slPips * sym.pipSize
            modifySLTP(sym.id, newSL, undefined)
          }
          break

        case 'modify_tp':
          if (position && action.tpPips) {
            const newTP = position.side === 'buy'
              ? position.entryPrice + action.tpPips * sym.pipSize
              : position.entryPrice - action.tpPips * sym.pipSize
            modifySLTP(sym.id, undefined, newTP)
          }
          break

        case 'log':
          addLog(action.message || '')
          break
      }
    },
    [placeOrder, modifySLTP, position, addLog]
  )

  return {
    isRunning: activeScripts.length > 0,
    activeCount: activeScripts.length,
  }
}
