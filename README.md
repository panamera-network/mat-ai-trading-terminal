# MAT.ai Trading Terminal

## Parked UI

- The layout/sync toolbar (`1`, `2H`, `3H`, `4`, `6`, `+ Chart`, `Crosshair`, `Symbol`, `TF`) is currently hidden from `TradingTerminal`.
- Keep `src/components/LayoutSelector.tsx` for future multi-account or multi-workspace chart layouts.
- The archived `MT5FeedSelector` was built for an older multi-account ZeroMQ/WebSocket bridge and should not be wired into the live app until the current MT5 bridge supports multi-account routing.
- The old SVG `DrawingOverlay`/layout-store drawing flow is no longer mounted in the chart runtime. Current chart drawing uses `lightweight-charts-drawing` via `PluginDrawingLayer`; wire persistence/templates against that plugin manager before re-enabling drawing templates.
