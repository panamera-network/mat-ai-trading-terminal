export interface PriceAlert {
  id: string
  symbol: string
  price: number
  direction: 'above' | 'below' | 'touch'
  triggered: boolean
  triggeredAt: Date | null
  createdAt: Date
  message: string
  sound: boolean
  notification: boolean
}

export interface AlertCondition {
  type: 'price' | 'indicator' | 'time'
  symbol: string
  params: Record<string, any>
}
