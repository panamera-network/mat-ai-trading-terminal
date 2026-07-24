// Price ↔ Y coordinate conversion helpers for SL/TP drag

export interface ChartScale {
  minPrice: number;
  maxPrice: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
}

export function createPriceScale(
  bars: { high: number; low: number }[],
  height: number,
  paddingPercent: number = 0.1
): ChartScale {
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min;
  const padding = range * paddingPercent;
  
  return {
    minPrice: min - padding,
    maxPrice: max + padding,
    height,
    paddingTop: padding,
    paddingBottom: padding
  };
}

export function priceToY(price: number, scale: ChartScale): number {
  const range = scale.maxPrice - scale.minPrice;
  const ratio = (price - scale.minPrice) / range;
  return scale.height - (ratio * scale.height); // Invert Y (0 at top)
}

export function yToPrice(y: number, scale: ChartScale): number {
  const ratio = (scale.height - y) / scale.height;
  const range = scale.maxPrice - scale.minPrice;
  return scale.minPrice + (ratio * range);
}

// Snap price to tick size
export function snapToTick(price: number, tickSize: number = 0.00001): number {
  return Math.round(price / tickSize) * tickSize;
}

// Validate SL/TP distance (e.g., minimum 5 pips from entry)
export function validateSlTp(
  entryPrice: number,
  sl: number,
  tp: number,
  type: 'BUY' | 'SELL',
  minPips: number = 5
): { valid: boolean; error?: string } {
  const pipSize = 0.0001;
  const minDistance = minPips * pipSize;
  
  if(type === 'BUY') {
    if(entryPrice - sl < minDistance) return { valid: false, error: 'SL too close to entry' };
    if(tp - entryPrice < minDistance) return { valid: false, error: 'TP too close to entry' };
  } else {
    if(sl - entryPrice < minDistance) return { valid: false, error: 'SL too close to entry' };
    if(entryPrice - tp < minDistance) return { valid: false, error: 'TP too close to entry' };
  }
  
  return { valid: true };
}