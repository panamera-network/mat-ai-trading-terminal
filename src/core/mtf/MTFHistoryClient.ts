import { CandleData, Symbol, Timeframe } from '@/types'
import { requestBridgeHistory } from '@/core/feed/BridgeHistoryClient'

const HISTORY_COUNT = 10

export function requestMTFHistory(
  symbol: Symbol,
  timeframe: Timeframe,
  count = HISTORY_COUNT
): Promise<CandleData[]> {
  return requestBridgeHistory(symbol, timeframe, count)
}
