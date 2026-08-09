import { useEffect, useRef, useCallback, useState } from 'react'
import { CandleData, Symbol, Timeframe } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderStore } from '@/stores/orderStore'
import { createTradingFeed, TradingFeed } from '@/core/feed/tradingFeed'
import { getBridgeHistoryCount, requestBridgeHistory } from '@/core/feed/BridgeHistoryClient'
import { requestBridgeSymbolStatus } from '@/core/feed/BridgeStatusClient'

export function useRealtimeFeed(
  chartId: string,
  symbol: Symbol,
  timeframe: Timeframe
) {
  const appendCandle = useLayoutStore((s) => s.appendCandle)
  const updateChartData = useLayoutStore((s) => s.updateChartData)
  const updateLastPrice = useLayoutStore((s) => s.updateLastPrice)
  const updatePositions = useOrderStore((s) => s.updatePositions)
  const checkPendingOrders = useOrderStore((s) => s.checkPendingOrders)
  const feedRef = useRef<TradingFeed | null>(null)
  const subscriptionIdRef = useRef<string | null>(null)
  const subscriptionGenerationRef = useRef(0)
  const [isConnected, setIsConnected] = useState(false)
  const [symbolStatus, setSymbolStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')

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
    setSymbolStatus(symbol.exchange === 'mt5' ? 'checking' : 'available')

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

    if (symbol.exchange === 'mt5') {
      requestBridgeSymbolStatus(symbol)
        .then((status) => {
          if (subscriptionGenerationRef.current !== generation) return
          setSymbolStatus(status.available ? 'available' : 'unavailable')
          if (!status.available) throw new Error(`MT5 symbol not exposed by bridge: ${symbol.id}`)
          return requestBridgeHistory(symbol, timeframe, getBridgeHistoryCount(timeframe))
        })
        .then((candles) => {
          if (!candles) return
          if (subscriptionGenerationRef.current !== generation || candles.length === 0) return
          updateChartData(chartId, candles)
          const last = candles[candles.length - 1]
          updateLastPrice(chartId, last.close, last.close - last.open, 0)
        })
        .catch((err) => {
          if (subscriptionGenerationRef.current !== generation) return
          console.warn(`[Feed] History unavailable: ${symbol.id} ${timeframe}`, err)
        })
    }

    return () => {
      unsubscribe()
      subscriptionIdRef.current = null
      setIsConnected(false)
    }
  }, [chartId, symbol, symbol.id, symbol.exchange, timeframe, handleCandle, updateChartData, updateLastPrice])

  return {
    isConnected,
    symbolStatus,
    getPrices: () => {
      if (symbol.exchange === 'mt5' && subscriptionIdRef.current) {
        return feedRef.current?.getCurrentPrices?.() ?? { bid: 0, ask: 0, mid: 0, spread: 0 }
      }
      return { bid: 0, ask: 0, mid: 0, spread: 0 }
    },
  }
}
