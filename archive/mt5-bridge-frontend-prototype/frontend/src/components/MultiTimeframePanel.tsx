import React from 'react';
import { MT5OHLCV } from '../types/mt5';

interface MiniChartProps {
  symbol: string;
  timeframe: string;
  data: MT5OHLCV[];
  height?: number;
}

const MiniChart: React.FC<MiniChartProps> = ({ symbol, timeframe, data, height = 60 }) => {
  if(!data.length) return <div className="mini-chart empty">{timeframe} — No data</div>;

  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;

  const lastClose = data[data.length - 1].close;
  const prevClose = data.length > 1 ? data[data.length - 2].close : lastClose;
  const change = ((lastClose - prevClose) / prevClose) * 100;

  return (
    <div className="mini-chart">
      <div className="mini-header">
        <span className="tf-badge">{timeframe}</span>
        <span className={`mini-change ${change >= 0 ? 'profit' : 'loss'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${data.length} ${height}`} height={height}>
        {data.map((bar, i) => {
          const yOpen = height - ((bar.open - min) / range) * height;
          const yClose = height - ((bar.close - min) / range) * height;
          const yHigh = height - ((bar.high - min) / range) * height;
          const yLow = height - ((bar.low - min) / range) * height;
          const isGreen = bar.close >= bar.open;

          return (
            <g key={i}>
              {/* Wick */}
              <line 
                x1={i} y1={yHigh} 
                x2={i} y2={yLow} 
                stroke={isGreen ? '#22c55e' : '#ef4444'} 
                strokeWidth="0.5"
              />
              {/* Body */}
              <line 
                x1={i} y1={yOpen} 
                x2={i} y2={yClose} 
                stroke={isGreen ? '#22c55e' : '#ef4444'} 
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface MultiTimeframePanelProps {
  symbol: string;
  primaryTF: string;
  secondaryTFs: string[];
  ohlcvData: Map<string, MT5OHLCV[]>;
}

export const MultiTimeframePanel: React.FC<MultiTimeframePanelProps> = ({
  symbol,
  primaryTF,
  secondaryTFs,
  ohlcvData
}) => {
  return (
    <div className="mtf-panel">
      <h5>📈 Multi-Timeframe</h5>
      <div className="primary-tf">
        <span>{symbol} {primaryTF}</span>
      </div>
      <div className="secondary-charts">
        {secondaryTFs.map(tf => {
          const key = `${symbol}_${tf}`;
          const data = ohlcvData.get(key) || [];
          return (
            <MiniChart 
              key={tf}
              symbol={symbol}
              timeframe={tf}
              data={data}
            />
          );
        })}
      </div>
    </div>
  );
};