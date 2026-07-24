// server/mt5-bridge.js — FIXED
import net from 'net';
import { EventEmitter } from 'events';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = process.env.MT5_BRIDGE_PORT || 5555;
const HOST = process.env.MT5_BRIDGE_HOST || '0.0.0.0';

class MT5Bridge extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.server = null;
  }

  start() {
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`[MT5] New connection: ${clientId}`);

      let buffer = '';
      
      this.clients.set(socket, {
        id: clientId,
        connectedAt: Date.now(),
        account: null,
        broker: null,
        symbols: [],
        lastHeartbeat: Date.now()
      });

      socket.on('data', (data) => {
        buffer += data.toString('utf8');
        let lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            this.handleMessage(socket, msg);
          } catch (e) {
            console.error('[MT5] Invalid JSON:', trimmed.substring(0, 100));
          }
        }
      });

      socket.on('close', () => {
        const client = this.clients.get(socket);
        console.log(`[MT5] Disconnected: ${client?.account || clientId}`);
        this.clients.delete(socket);
        this.emit('disconnect', { clientId, account: client?.account });
      });

      socket.on('error', (err) => {
        console.error('[MT5] Socket error:', err.message);
        this.clients.delete(socket);
      });
    });

    this.server.listen(PORT, HOST, () => {
      console.log(`[MT5] TCP Bridge on ${HOST}:${PORT}`);
    });

    // Heartbeat checker
    setInterval(() => {
      const now = Date.now();
      for (const [socket, client] of this.clients) {
        if (now - client.lastHeartbeat > 60000) {
          console.log(`[MT5] Timeout: ${client.account || client.id}`);
          socket.destroy();
          this.clients.delete(socket);
        }
      }
    }, 30000);
  }

  handleMessage(socket, msg) {
    const client = this.clients.get(socket);
    if (!client) return;

    switch (msg.type) {
      case 'handshake':
        client.account = msg.account;
        client.broker = msg.broker;
        client.symbols = msg.symbols || [];
        client.lastHeartbeat = Date.now();
        console.log(`[MT5] Handshake: ${msg.account} | ${msg.broker}`);
        this.emit('handshake', { clientId: client.id, ...msg });
        break;

      case 'heartbeat':
        client.lastHeartbeat = Date.now();
        break;

      case 'tick':
        this.emit('tick', msg);
        break;

      case 'bar':
        this.emit('bar', msg);
        break;

      case 'history':
        this.emit('history', msg);
        break;

      case 'history_complete':
        console.log(`[MT5] History: ${msg.symbol} (${msg.bars} bars)`);
        this.emit('historyComplete', msg);
        break;

      case 'account':
        this.emit('account', msg);
        break;

      case 'order_result':
        console.log(`[MT5] Order: ${msg.request_type} — ${msg.success ? 'OK' : 'FAIL'}`);
        this.emit('orderResult', msg);
        break;

      case 'error':
        console.error('[MT5] EA error:', msg.error);
        this.emit('mt5Error', msg);
        break;

      default:
        console.log('[MT5] Unknown:', msg.type);
    }
  }

  sendToAccount(accountId, command) {
    for (const [socket, client] of this.clients) {
      if (client.account === accountId) {
        return this.sendToSocket(socket, command);
      }
    }
    console.error(`[MT5] Account not connected: ${accountId}`);
    return false;
  }

  sendToFirst(command) {
    for (const [socket] of this.clients) {
      return this.sendToSocket(socket, command);
    }
    console.error('[MT5] No MT5 client connected');
    return false;
  }

  sendToSocket(socket, command) {
    if (!socket || socket.destroyed) return false;
    const data = JSON.stringify(command) + '\n';
    socket.write(data, 'utf8');
    return true;
  }

  // Commands
  placeOrder(accountId, params) {
    return this.sendToAccount(accountId, { type: 'place_order', ...params });
  }

  closePosition(accountId, ticket) {
    return this.sendToAccount(accountId, { type: 'close_position', ticket });
  }

  modifyPosition(accountId, ticket, sl, tp) {
    return this.sendToAccount(accountId, { type: 'modify_position', ticket, sl, tp });
  }

  cancelOrder(accountId, ticket) {
    return this.sendToAccount(accountId, { type: 'cancel_order', ticket });
  }

  getHistory(accountId, symbol, timeframe, count) {
    return this.sendToAccount(accountId, { type: 'get_history', symbol, timeframe, count });
  }

  getStatus() {
    return Array.from(this.clients.values()).map(c => ({
      id: c.id,
      account: c.account,
      broker: c.broker,
      symbols: c.symbols,
      connectedAt: c.connectedAt,
      lastHeartbeat: c.lastHeartbeat
    }));
  }

  stop() {
    if (this.server) {
      this.server.close();
      for (const [socket] of this.clients) socket.destroy();
      this.clients.clear();
    }
  }
}

// ─── Standalone Mode ───
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const bridge = new MT5Bridge();
  bridge.start();

  // Latest data buffer for HTTP polling
  const latestData = {
    ticks: [],
    account: null,
    bars: []
  };

  bridge.on('tick', (tick) => {
    latestData.ticks.push(tick);
    if (latestData.ticks.length > 100) latestData.ticks.shift();
  });

  bridge.on('account', (acc) => {
    latestData.account = acc;
  });

  // HTTP API server
  const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        connected: bridge.clients.size > 0,
        clients: bridge.getStatus()
      }));
    }
    else if (req.url === '/ticks') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const response = { ticks: latestData.ticks };
      latestData.ticks = [];
      res.end(JSON.stringify(response));
    }
    else if (req.url === '/account') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ account: latestData.account }));
    }
    else if (req.url === '/latest') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const response = { ticks: latestData.ticks, account: latestData.account };
      latestData.ticks = [];
      res.end(JSON.stringify(response));
    }
    else if (req.url === '/command' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const cmd = JSON.parse(body);
          const result = bridge.sendToFirst(cmd);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: result, queued: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid command' }));
        }
      });
    }
    else {
      res.writeHead(404);
      res.end();
    }
  });

  httpServer.listen(5556, () => {
    console.log('[HTTP] API on http://localhost:5556');
    console.log('  GET  /status   — connection status');
    console.log('  GET  /ticks    — latest ticks');
    console.log('  GET  /account  — account info');
    console.log('  GET  /latest   — ticks + account combined (used by frontend poller)');
    console.log('  POST /command  — send command to MT5');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[MT5] Shutting down...');
    bridge.stop();
    httpServer.close();
    process.exit(0);
  });
}

export { MT5Bridge };