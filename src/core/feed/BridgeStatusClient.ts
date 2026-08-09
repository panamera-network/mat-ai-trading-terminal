import { Symbol } from '@/types'

const BRIDGE_URL = 'http://localhost:5556'
const STATUS_CACHE_TTL_MS = 1000

interface BridgeStatusClient {
  id?: string
  account?: string | null
  broker?: string | null
  symbols?: string[]
}

interface BridgeStatusResponse {
  connected?: boolean
  clients?: BridgeStatusClient[]
}

export interface BridgeSymbolStatus {
  connected: boolean
  available: boolean
  symbols: string[]
}

let cachedStatus: { value: BridgeSymbolStatus; fetchedAt: number } | null = null
let inFlightStatus: Promise<BridgeSymbolStatus> | null = null

export function requestBridgeSymbolStatus(symbol: Symbol): Promise<BridgeSymbolStatus> {
  if (symbol.exchange !== 'mt5') {
    return Promise.resolve({ connected: true, available: true, symbols: [] })
  }

  if (cachedStatus && Date.now() - cachedStatus.fetchedAt <= STATUS_CACHE_TTL_MS) {
    return Promise.resolve(toSymbolStatus(symbol, cachedStatus.value))
  }

  if (inFlightStatus) return inFlightStatus.then((status) => toSymbolStatus(symbol, status))

  inFlightStatus = fetch(`${BRIDGE_URL}/status`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Bridge status ${res.status}`)
      const body = await res.json() as BridgeStatusResponse
      const symbols = Array.from(new Set((body.clients ?? []).flatMap((client) => client.symbols ?? [])))
      const value = { connected: Boolean(body.connected), available: false, symbols }
      cachedStatus = { value, fetchedAt: Date.now() }
      return value
    })
    .finally(() => {
      inFlightStatus = null
    })

  return inFlightStatus.then((status) => toSymbolStatus(symbol, status))
}

function toSymbolStatus(symbol: Symbol, status: BridgeSymbolStatus): BridgeSymbolStatus {
  const requested = symbol.id.toUpperCase()
  const available = status.symbols.some((bridgeSymbol) => isSymbolMatch(requested, bridgeSymbol))
  return { ...status, available }
}

function isSymbolMatch(requested: string, bridgeSymbol: string): boolean {
  const normalized = bridgeSymbol.toUpperCase()
  return normalized === requested || normalized.startsWith(requested)
}
