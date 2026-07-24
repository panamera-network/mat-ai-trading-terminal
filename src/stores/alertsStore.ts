import { create } from 'zustand'
import { PriceAlert } from '@/types/alerts'
import { nanoid } from 'nanoid'

interface AlertsStore {
  alerts: PriceAlert[]
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered' | 'triggeredAt'>) => string
  removeAlert: (id: string) => void
  triggerAlert: (id: string) => void
  clearTriggered: () => void
  getActiveAlerts: (symbol: string) => PriceAlert[]
}

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  alerts: [],

  addAlert: (alert) => {
    const id = nanoid(8)
    const newAlert: PriceAlert = {
      ...alert,
      id,
      createdAt: new Date(),
      triggered: false,
      triggeredAt: null,
    }
    set((state) => ({ alerts: [...state.alerts, newAlert] }))
    return id
  },

  removeAlert: (id) => {
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }))
  },

  triggerAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, triggered: true, triggeredAt: new Date() } : a
      ),
    }))
  },

  clearTriggered: () => {
    set((state) => ({ alerts: state.alerts.filter((a) => !a.triggered) }))
  },

  getActiveAlerts: (symbol) => {
    return get().alerts.filter((a) => a.symbol === symbol && !a.triggered)
  },
}))
