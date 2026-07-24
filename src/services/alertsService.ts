import { PriceAlert } from '@/types/alerts'
import { useAlertsStore } from '@/stores/alertsStore'

export class AlertsService {
  private audio: HTMLAudioElement | null = null
  private notifiedAlerts = new Set<string>()

  constructor() {
    // Initialize audio for alert sound
    try {
      this.audio = new Audio()
      this.audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'
    } catch {}
  }

  checkAlerts(symbol: string, bid: number, ask: number) {
    const store = useAlertsStore.getState()
    const alerts = store.getActiveAlerts(symbol)

    for (const alert of alerts) {
      const price = alert.direction === 'above' ? ask : bid
      const shouldTrigger =
        (alert.direction === 'above' && price >= alert.price) ||
        (alert.direction === 'below' && price <= alert.price) ||
        (alert.direction === 'touch' && bid <= alert.price && ask >= alert.price)

      if (shouldTrigger && !this.notifiedAlerts.has(alert.id)) {
        this.notifiedAlerts.add(alert.id)
        store.triggerAlert(alert.id)
        this.notify(alert)
      }
    }
  }

  private notify(alert: PriceAlert) {
    // Play sound
    if (alert.sound && this.audio) {
      this.audio.play().catch(() => {})
    }

    // Browser notification
    if (alert.notification && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('MAT.ai Price Alert', {
          body: `${alert.symbol}: ${alert.message}`,
          icon: '/favicon.ico',
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('MAT.ai Price Alert', {
              body: `${alert.symbol}: ${alert.message}`,
              icon: '/favicon.ico',
            })
          }
        })
      }
    }

    // Console log
    console.log(`[ALERT] ${alert.symbol}: ${alert.message} at ${alert.price}`)
  }

  reset() {
    this.notifiedAlerts.clear()
  }
}

export const alertsService = new AlertsService()
