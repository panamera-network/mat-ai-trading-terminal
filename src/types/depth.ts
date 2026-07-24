export interface DOMLevel {
  price: number
  size: number
  cumulativeSize: number
  isBid: boolean
}

export interface DepthSnapshot {
  symbol: string
  bids: DOMLevel[]
  asks: DOMLevel[]
  lastPrice: number
  lastUpdateId: number
}

export interface DepthUpdate {
  symbol: string
  bids: [string, string][]  // [price, size]
  asks: [string, string][]
  lastUpdateId: number
}
