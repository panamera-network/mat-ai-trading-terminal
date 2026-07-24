// === EXISTING ===
export interface MT5Account {
  id: string;
  connected: boolean;
  lastHeartbeat: number;
  balance: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  symbols?: Map<string, MT5Tick>;
  positions?: MT5Position[];
}

export interface MT5Tick {
  type: 'TICK';
  accountId: string;
  symbol: string;
  bid: number;
  ask: number;
  volume: number;
  time: number;
  spread: number;
}

export interface MT5OHLCV {
  type: 'OHLCV';
  accountId: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export interface MT5HistoryBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MT5Position {
  type: 'POSITION';
  accountId: string;
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice?: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: number;
}

export interface TradeCommand {
  action: 'BUY' | 'SELL' | 'MODIFY' | 'CLOSE' | 'CLOSE_PARTIAL' | 'REVERSE' | 'BREAKEVEN';
  symbol?: string;
  volume?: number;
  sl?: number;
  tp?: number;
  ticket?: number;
  comment?: string;
}

// === NEW: P&L DASHBOARD ===
export interface PnLSummary {
  totalUnrealized: number;
  totalRealized: number;
  totalSwap: number;
  totalCommission: number;
  netProfit: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  equityHistory: EquityPoint[];
}

export interface EquityPoint {
  time: number;
  equity: number;
  balance: number;
}

// === NEW: PRICE ALERTS ===
export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW' | 'TOUCH';
  triggered: boolean;
  triggerTime?: number;
  createdAt: number;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  message?: string;
}

// === NEW: TRADE JOURNAL ===
export interface TradeRecord {
  id: string;
  ticket: number;
  accountId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  exitPrice?: number;
  sl?: number;
  tp?: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: number;
  closeTime?: number;
  duration?: number; // seconds
  tags: string[];
  setup?: string;
  emotion?: string;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface JournalFilter {
  dateFrom?: number;
  dateTo?: number;
  symbols?: string[];
  setup?: string;
  result?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  tags?: string[];
}

// === NEW: RISK CALCULATOR ===
export interface RiskParams {
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  symbol: string;
}

export interface RiskResult {
  positionSize: number; // lots
  riskAmount: number;
  riskPercent: number;
  rewardAmount?: number;
  rewardPercent?: number;
  rrRatio?: number;
  maxLots: number;
  pipValue: number;
  pipDistance: number;
  isValid: boolean;
  warning?: string;
}

// === NEW: DRAWING TEMPLATES ===
export interface DrawingTemplate {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  drawings: DrawingObject[];
  createdAt: number;
  updatedAt: number;
}

export interface DrawingObject {
  type: 'LINE' | 'HLINE' | 'VLINE' | 'RECT' | 'FIB' | 'TEXT';
  points: { x: number; y: number; price?: number; time?: number }[];
  styles: {
    color: string;
    width: number;
    dash?: number[];
    fill?: string;
  };
  text?: string;
}

// === NEW: MULTI-TIMEFRAME ===
export interface TimeframeSync {
  primary: string;      // e.g. "H1"
  secondaries: string[]; // e.g. ["D1", "H4"]
  syncZoom: boolean;
  syncScroll: boolean;
}