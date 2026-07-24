// src/services/mt5-bridge.ts
// Bridge client — talks to server/mt5-bridge.js over HTTP polling.
// The bridge server itself speaks raw TCP to the MQL5 EA on port 5555;
// the frontend never touches that socket directly, it only polls the
// HTTP API the bridge exposes on port 5556 (/status, /latest, /command).

export interface MT5Tick {
  type: 'tick';
  symbol: string;
  bid: string;
  ask: string;
  last: string;
  volume: string;
  time: string;
  time_msc: string;
  flags: string;
}

export interface MT5Bar {
  type: 'bar';
  symbol: string;
  timeframe: string;
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  tick_volume: string;
  real_volume: string;
  spread: string;
  isForming: boolean;
}

export interface MT5Account {
  type: 'account';
  login: string;
  balance: string;
  equity: string;
  margin: string;
  free_margin: string;
  profit: string;
  currency: string;
  leverage: string;
  server: string;
  company: string;
  name: string;
  positions_count: string;
  positions: MT5Position[];
  orders_count: string;
  orders: MT5Order[];
}

export interface MT5Position {
  ticket: string;
  symbol: string;
  type: string;
  volume: string;
  open_price: string;
  current_price: string;
  sl: string;
  tp: string;
  profit: string;
  swap: string;
  open_time: string;
  magic: string;
  comment: string;
}

export interface MT5Order {
  ticket: string;
  symbol: string;
  type: string;
  volume: string;
  price: string;
  sl: string;
  tp: string;
  magic: string;
}

export type MT5Message = MT5Tick | MT5Bar | MT5Account;

export interface BridgeStatus {
  connected: boolean;
  account: string | null;
  broker: string | null;
  symbols: string[];
}

class MT5BridgeClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private status: BridgeStatus = {
    connected: false,
    account: null,
    broker: null,
    symbols: []
  };
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    this.startPolling();
  }

  private startPolling() {
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:5556/status');
        const data = await res.json();
        
        const wasConnected = this.status.connected;
        this.status.connected = data.connected;
        
        if (data.clients && data.clients.length > 0) {
          const client = data.clients[0];
          this.status.account = client.account;
          this.status.broker = client.broker;
          this.status.symbols = client.symbols;
        }

        if (!wasConnected && this.status.connected) {
          this.emit('connected', this.status);
        } else if (wasConnected && !this.status.connected) {
          this.emit('disconnected', null);
        }
      } catch (e) {
        if (this.status.connected) {
          this.status.connected = false;
          this.emit('disconnected', null);
        }
      }
    };

    poll();
    this.reconnectTimer = window.setInterval(poll, 1000);
  }

  // Event system
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  getStatus(): BridgeStatus {
    return { ...this.status };
  }

  // Commands (send via HTTP POST to bridge)
  async placeOrder(params: {
    symbol: string;
    order_type: string;
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }) {
    return this.sendCommand('place_order', params);
  }

  async closePosition(ticket: number) {
    return this.sendCommand('close_position', { ticket });
  }

  async modifyPosition(ticket: number, sl: number, tp: number) {
    return this.sendCommand('modify_position', { ticket, sl, tp });
  }

  async cancelOrder(ticket: number) {
    return this.sendCommand('cancel_order', { ticket });
  }

  private async sendCommand(type: string, params: any) {
    try {
      const res = await fetch('http://localhost:5556/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...params })
      });
      return await res.json();
    } catch (e) {
      console.error('[Bridge] Command failed:', e);
      return { success: false, error: 'Bridge not available' };
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const mt5Bridge = new MT5BridgeClient();