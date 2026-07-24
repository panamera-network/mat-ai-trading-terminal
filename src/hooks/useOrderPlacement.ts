import { useState, useCallback } from 'react'
import { Order, OrderSide, OrderType, OrderTIF } from '@/types/order'
import { Symbol } from '@/types/market'
import { useOrderStore } from '@/stores/orderStore'

interface OrderFormState {
  side: OrderSide
  type: OrderType
  price: string
  stopPrice: string
  size: string
  tif: OrderTIF
  errors: Record<string, string>
}

export function useOrderPlacement(
  symbol: Symbol,
  currentPrice: number,
  spread?: number,
  bid?: number,
  ask?: number
) {
  const placeOrder = useOrderStore((s) => s.placeOrder)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<OrderFormState>({
    side: 'buy',
    type: 'market',
    price: '',
    stopPrice: '',
    size: '0.1',
    tif: 'GTC',
    errors: {},
  })

  const setField = useCallback((field: keyof Omit<OrderFormState, 'errors'>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value, errors: {} }))
  }, [])

  const setSide = useCallback((side: OrderSide) => {
    setForm((prev) => ({ ...prev, side, errors: {} }))
  }, [])

  const setType = useCallback((type: OrderType) => {
    setForm((prev) => ({ ...prev, type, errors: {} }))
  }, [])

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    const size = parseFloat(form.size)
    const price = parseFloat(form.price)
    const stopPrice = parseFloat(form.stopPrice)

    if (isNaN(size) || size <= 0) errors.size = 'Size must be > 0'
    if (form.type === 'limit' && (isNaN(price) || price <= 0)) errors.price = 'Limit price required'
    if ((form.type === 'stop' || form.type === 'stop_limit') && (isNaN(stopPrice) || stopPrice <= 0)) errors.stopPrice = 'Stop price required'

    if (Object.keys(errors).length > 0) {
      setForm((prev) => ({ ...prev, errors }))
      return false
    }
    return true
  }, [form])

  const submit = useCallback(async (slPrice?: number, tpPrice?: number): Promise<Order | null> => {
    if (!validate()) return null
    setIsSubmitting(true)
    try {
      return await placeOrder({
        symbol,
        side: form.side,
        type: form.type,
        price: form.type === 'limit' || form.type === 'stop_limit' ? parseFloat(form.price) : undefined,
        stopPrice: form.type === 'stop' || form.type === 'stop_limit' ? parseFloat(form.stopPrice) : undefined,
        size: parseFloat(form.size),
        tif: form.tif,
        currentPrice,
        spread,
        bid,
        ask,
        slPrice,
        tpPrice,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [form, symbol, currentPrice, spread, bid, ask, placeOrder, validate])

  const quickBuy = useCallback(async (size: number, slPrice?: number, tpPrice?: number) => {
    setIsSubmitting(true)
    try {
      return await placeOrder({ symbol, side: 'buy', type: 'market', size, currentPrice, spread, bid, ask, slPrice, tpPrice })
    } finally { setIsSubmitting(false) }
  }, [symbol, currentPrice, spread, bid, ask, placeOrder])

  const quickSell = useCallback(async (size: number, slPrice?: number, tpPrice?: number) => {
    setIsSubmitting(true)
    try {
      return await placeOrder({ symbol, side: 'sell', type: 'market', size, currentPrice, spread, bid, ask, slPrice, tpPrice })
    } finally { setIsSubmitting(false) }
  }, [symbol, currentPrice, spread, bid, ask, placeOrder])

  return { form, setField, setSide, setType, submit, quickBuy, quickSell, isSubmitting }
}
