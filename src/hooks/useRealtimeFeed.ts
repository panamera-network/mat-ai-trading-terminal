import { useEffect, useRef, useCallback, useState } from 'react'
import { CandleData, Symbol, Timeframe } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderStore } from '@/stores/orderStore'
import { createTradingFeed, TradingFeed } from '@/core/feed/tradingFeed'

export function useRealtimeFeed(
  chartId: string,
  symbol: Symbol,
  timeframe: Timeframe
) {
  const appendCandle = useLayoutStore((s) => s.appendCandle)
  const updateLastPrice = useLayoutStore((s) => s.updateLastPrice)
  const updatePositions = useOrderStore((s) => s.updatePositions)
  const checkPendingOrders = useOrderStore((s) => s.checkPendingOrders)
  const feedRef = useRef<TradingFeed | null>(null)
  const subscriptionIdRef = useRef<string | null>(null)
  const subscriptionGenerationRef = useRef(0)
  const [isConnected, setIsConnected] = useState(false)

  const handleCandle = useCallback(
    (candle: CandleData) => {
      appendCandle(chartId, candle)
      updateLastPrice(chartId, candle.close, candle.close - candle.open, 0)

      // Spread-aware position and order updates
      if (symbol.exchange === 'mt5' && subscriptionIdRef.current) {
        const prices = feedRef.current?.getCurrentPrices?.() ?? { bid: 0, ask: 0, mid: 0, spread: 0 }
        if (prices.bid && prices.ask) {
          updatePositions(symbol, prices.bid, prices.ask)
          checkPendingOrders(symbol, prices.bid, prices.ask, prices.spread)
        }
      } else {
        // Crypto: assume tight spread, use mid price
        const spread = symbol.id === 'BTCUSDT' ? 0.5 : 0.05
        const bid = candle.close - spread / 2
        const ask = candle.close + spread / 2
        updatePositions(symbol, bid, ask)
        checkPendingOrders(symbol, bid, ask, spread)
      }
    },
    [chartId, symbol, appendCandle, updateLastPrice, updatePositions, checkPendingOrders]
  )

  useEffect(() => {
    const feed = createTradingFeed(symbol)
    feedRef.current = feed
    const generation = subscriptionGenerationRef.current + 1
    subscriptionGenerationRef.current = generation

    const unsubscribe = feed.subscribe({
      chartId,
      symbol,
      timeframe,
    }, {
      onLiveCandle: (candle) => {
        if (subscriptionGenerationRef.current !== generation) return
        handleCandle(candle)
      },
      onConnectionState: (state) => {
        if (subscriptionGenerationRef.current !== generation) return
        setIsConnected(state === 'connected')
        if (state === 'connected') console.log(`[Feed] Connected: ${symbol.id} ${timeframe}`)
      },
      onError: (err) => {
        if (subscriptionGenerationRef.current !== generation) return
        setIsConnected(false)
        console.error(`[Feed] Error: ${symbol.id}`, err)
      },
    })
    subscriptionIdRef.current = `${chartId}_${symbol.id}_${timeframe}_${generation}`

    return () => {
      unsubscribe()
      subscriptionIdRef.current = null
      setIsConnected(false)
    }
  }, [chartId, symbol, symbol.id, symbol.exchange, timeframe, handleCandle])

  return {
    isConnected,
    getPrices: () => {
      if (symbol.exchange === 'mt5' && subscriptionIdRef.current) {
        return feedRef.current?.getCurrentPrices?.() ?? { bid: 0, ask: 0, mid: 0, spread: 0 }
      }
      return { bid: 0, ask: 0, mid: 0, spread: 0 }
    },
  }
}
