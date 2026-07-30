// server/mt5-bridge.js — FIXED
import net from 'net';
import { EventEmitter } from 'events';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = process.env.MT5_BRIDGE_PORT || 5555;
const HOST = process.env.MT5_BRIDGE_HOST || '0.0.0.0';
const HISTORY_TIMEOUT_MS = 7000;
const HISTORY_CACHE_TTL_MS = 15000;
const HISTORY_MAX_COUNT = 100;
const HISTORY_DEFAULT_COUNT = 10;
const SUPPORTED_HISTORY_TIMEFRAMES = new Set(['1m', '5m', '15m', '1H', '4H', '1D', '1W']);

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
  const historyRequests = new Map();
  const historyCache = new Map();

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

  bridge.on('history', (msg) => {
    resolveHistoryMessage(msg);
  });

  bridge.on('historyComplete', (msg) => {
    resolveHistoryMessage(msg);
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
    else if (req.url.startsWith('/history') && req.method === 'GET') {
      handleHistoryRequest(req, res);
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

  function handleHistoryRequest(req, res) {
    const parsed = new URL(req.url, 'http://localhost');
    const validation = validateHistoryParams(parsed.searchParams);
    if (!validation.ok) {
      writeHistoryError(res, 400, validation.error);
      return;
    }

    requestHistory(validation.value)
      .then((response) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      })
      .catch((error) => {
        const status = error.code === 'MT5_DISCONNECTED' ? 503 : error.code === 'TIMEOUT' ? 504 : 500;
        writeHistoryError(res, status, error);
      });
  }

  function validateHistoryParams(params) {
    const symbol = String(params.get('symbol') || '').trim().toUpperCase();
    const timeframe = normalizeHistoryTimeframe(params.get('timeframe'));
    const rawCount = params.get('count');
    const count = rawCount === null ? HISTORY_DEFAULT_COUNT : Number(rawCount);

    if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) {
      return { ok: false, error: historyError('INVALID_REQUEST', 'Invalid history symbol') };
    }
    if (!timeframe) {
      return { ok: false, error: historyError('INVALID_REQUEST', 'Invalid history timeframe') };
    }
    if (!Number.isInteger(count) || count < 1) {
      return { ok: false, error: historyError('INVALID_REQUEST', 'Invalid history count') };
    }

    return { ok: true, value: { symbol, timeframe, count: Math.min(count, HISTORY_MAX_COUNT) } };
  }

  function requestHistory(request) {
    const key = historyKey(request.symbol, request.timeframe);
    const cached = historyCache.get(key);
    if (cached && Date.now() - cached.fetchedAt <= HISTORY_CACHE_TTL_MS && cached.count >= request.count) {
      return Promise.resolve(toHistoryResponse(request, cached.candles.slice(-request.count)));
    }

    const existing = historyRequests.get(key);
    if (existing) return existing.promise.then((candles) => toHistoryResponse(request, candles.slice(-request.count)));

    if (bridge.clients.size === 0) {
      return Promise.reject(historyError('MT5_DISCONNECTED', 'MT5 client is not connected'));
    }

    let timeout = null;
    const entry = { symbol: request.symbol, timeframe: request.timeframe, count: request.count };
    entry.promise = new Promise((resolve, reject) => {
      entry.resolvePromise = resolve;
      entry.rejectPromise = reject;
      timeout = setTimeout(() => {
        historyRequests.delete(key);
        reject(historyError('TIMEOUT', 'MT5 history request timed out'));
      }, HISTORY_TIMEOUT_MS);
    });
    entry.resolve = (candles) => {
      clearTimeout(timeout);
      historyRequests.delete(key);
      const normalized = normalizeHistoryCandles(candles).slice(-entry.count);
      historyCache.set(key, { candles: normalized, count: normalized.length, fetchedAt: Date.now() });
      entry.resolvePromise(normalized);
    };
    entry.reject = (error) => {
      clearTimeout(timeout);
      historyRequests.delete(key);
      entry.rejectPromise(error);
    };
    historyRequests.set(key, entry);

    const sent = bridge.sendToFirst({
      type: 'get_history',
      symbol: request.symbol,
      timeframe: request.timeframe,
      count: request.count,
    });
    if (!sent) entry.reject(historyError('MT5_DISCONNECTED', 'MT5 client is not connected'));

    return entry.promise.then((candles) => toHistoryResponse(request, candles.slice(-request.count)));
  }

  function resolveHistoryMessage(msg) {
    const symbol = String(msg.symbol || '').trim().toUpperCase();
    const timeframe = normalizeHistoryTimeframe(msg.timeframe || msg.period);
    if (!symbol || !timeframe) return;
    const entry = historyRequests.get(historyKey(symbol, timeframe));
    if (!entry) return;
    entry.resolve(extractHistoryCandles(msg));
  }

  function extractHistoryCandles(msg) {
    if (Array.isArray(msg.candles)) return msg.candles;
    if (Array.isArray(msg.bars)) return msg.bars;
    if (Array.isArray(msg.history)) return msg.history;
    if (Array.isArray(msg.data)) return msg.data;
    if (msg.open !== undefined && msg.high !== undefined && msg.low !== undefined && msg.close !== undefined) return [msg];
    return [];
  }

  function normalizeHistoryCandles(candles) {
    const byTime = new Map();
    for (const raw of candles) {
      const candle = normalizeHistoryCandle(raw);
      if (candle) byTime.set(candle.time, candle);
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }

  function normalizeHistoryCandle(raw) {
    const time = parseHistoryTime(raw.time ?? raw.timestamp ?? raw.t);
    const open = toHistoryNumber(raw.open ?? raw.o);
    const high = toHistoryNumber(raw.high ?? raw.h);
    const low = toHistoryNumber(raw.low ?? raw.l);
    const close = toHistoryNumber(raw.close ?? raw.c);
    const volume = toHistoryNumber(raw.volume ?? raw.tick_volume ?? raw.real_volume ?? raw.v ?? 0);
    if (time === null || ![open, high, low, close, volume].every(Number.isFinite) || high < low) return null;
    return { time, open, high, low, close, volume };
  }

  function parseHistoryTime(value) {
    if (typeof value === 'number') return value > 10000000000 ? Math.floor(value / 1000) : Math.floor(value);
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return parseHistoryTime(numeric);
      const normalized = value.includes('T') ? value : value.replace(' ', 'T');
      const parsed = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
      return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
    }
    return null;
  }

  function normalizeHistoryTimeframe(value) {
    const raw = String(value || '').trim();
    const aliases = {
      M1: '1m', M5: '5m', M15: '15m',
      H1: '1H', H4: '4H', D1: '1D', W1: '1W',
      '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W',
    };
    const normalized = aliases[raw] || raw;
    return SUPPORTED_HISTORY_TIMEFRAMES.has(normalized) ? normalized : null;
  }

  function toHistoryResponse(request, candles) {
    return { ok: true, symbol: request.symbol, timeframe: request.timeframe, candles, receivedAt: Date.now() };
  }

  function writeHistoryError(res, status, error) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'History request failed',
    }));
  }

  function historyError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function historyKey(symbol, timeframe) {
    return `${symbol}:${timeframe}`;
  }

  function toHistoryNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number.parseFloat(value);
    return Number.NaN;
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[MT5] Shutting down...');
    bridge.stop();
    httpServer.close();
    process.exit(0);
  });
}

export { MT5Bridge };