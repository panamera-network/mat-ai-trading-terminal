# MAT.ai Trading Terminal

A multi-chart trading terminal (React + TypeScript + Vite + lightweight-charts +
Tauri) with a simulated order/backtest engine and a real MetaTrader 5 bridge for
live price/account data.

This file exists so future work (human or Claude) starts from an accurate picture
of what's live, what's archived, and why — the repo went through a full audit and
recovery pass on 2026-07-25 (see "2026-07-25 audit" below) that fixed a build that
had never actually compiled.

## Running it

```bash
npm install
npm run dev      # concurrently: TCP+HTTP bridge (server/mt5-bridge.js) + vite
npm run build    # tsc && vite build
npm run tauri:dev
```

The bridge listens on TCP `5555` (for the MT5 EA) and HTTP `5556` (for the
frontend — `GET /status`, `GET /latest`, `POST /command`). The Vite dev server is
pinned to port `1420` (see `vite.config.ts`, required by Tauri).

## Architecture (live path)

```
App.tsx
 └─ TradingTerminal.tsx
     ├─ LayoutSelector, BacktestControlBar/Setup/Results
     └─ MultiChartLayout.tsx
         └─ ChartTile.tsx  (one per chart in the grid — everything below is per-tile)
             ├─ LeftSidebar.tsx         (drawing tool palette, magnet/lock/delete, per-tile)
             ├─ DrawingOverlay.tsx      (SVG drawing tools, per-chart state)
             ├─ PositionLines.tsx       (SL/TP price lines + drag-to-modify)
             ├─ ChartContextMenu.tsx    (right-click → place order at price)
             ├─ IndicatorOverlay.tsx    (SMA/EMA/Bollinger/VWAP, drawn directly on the price series)
             ├─ IndicatorPanel.tsx      (RSI/MACD, own sub-chart stacked below the main pane)
             ├─ VolumeProfileIndicator.tsx (POC/VAH/VAL lines)
             ├─ IndicatorsModal.tsx     (picker — add/toggle/edit/remove indicators, opened via header "Indicators" button)
             ├─ BottomPanel.tsx         (collapsible: Trades/Orders/Positions/Settings tabs)
             ├─ AlertsPanel / OrderPanel / DOMPanel / StrategyPanel
             ├─ PnLDashboard / TradeJournal / DrawingTemplateManager
             └─ RiskCalculator / OrderConfirmModal / PositionActions (inside OrderPanel)
```

There is no standalone `TopToolbar` component — `ChartTile`'s own header (symbol/
timeframe/chart-type selects) already covers that job per-tile, so the toolbar's
useful missing pieces (an indicators launcher, visible Undo/Redo) were added as
buttons directly in that header instead of introducing a second, redundant
control surface.

State lives in `src/stores/` (zustand):
- `layoutStore` — the source of truth for the chart grid. **Per-chart** state:
  each `ChartInstance` carries its own `drawings`, `indicators`, `data`,
  `selectedDrawing`, `showVolume`, `showGrid`. Also owns the shared `magnetMode`
  toggle and drawing undo/redo command stacks (keyed by chart id). Indicator
  actions: `addIndicator`/`removeIndicator`/`toggleIndicator`/`updateIndicatorParams`.
- `orderStore` — orders/positions/trades, backed by `services/orderService.ts`
  (an in-memory simulated fill/matching engine — not a real broker).
- `alertsStore`, `backtestStore`, `strategyStore` — as named.

Indicator math lives in `src/utils/indicators.ts` (SMA/EMA/RSI/MACD/Bollinger/
VWAP/ATR/Volume Profile) — pure functions over `OHLCV[]`, no store coupling, so
they work identically on live or backtest data.

Types are unified in `src/types/` — **`Symbol`, `ChartType`, `Timeframe` are
canonically defined in `src/types/market.ts`** and re-exported through
`src/types/index.ts`. Don't redeclare them in `index.ts` — that's exactly the bug
that broke the build (see below).

## MT5 bridge

Two pieces, both required for live MT5 data:
- `mql5/MATai_Bridge.mq5` — the EA, speaks a plain newline-delimited JSON protocol
  over a **native MQL5 socket** to `127.0.0.1:5555`.
- `server/mt5-bridge.js` — the Node bridge. Raw TCP server on `5555` for the EA,
  plus an HTTP API on `5556` (`/status`, `/ticks`, `/account`, `/latest`,
  `POST /command`) that the frontend polls (`src/services/mt5-bridge.ts` +
  `src/hooks/useMT5Bridge.ts`). There is no WebSocket — the frontend polls HTTP.

Do not confuse this with anything mentioning ZeroMQ or a WebSocket bridge on port
`8080` — that was a different, incompatible, multi-account architecture that was
deleted during the 2026-07-25 audit (see below). The EA only speaks the native
socket protocol; there is currently no multi-account support.

## `archive/`

One folder of dead/superseded code kept for reference rather than deleted
outright, with its own `README.md` explaining what's in it and why it's not live:

- `archive/mt5-bridge-frontend-prototype/` — a standalone package that was never
  wired into `src/`, built against a different (deleted) ZeroMQ↔WebSocket bridge.
  The useful, self-contained pieces (risk calculator, order confirm modal, P&L
  dashboard, trade journal, drawing templates, one alert condition) were ported
  into `src/` and adapted to the live stores; the rest wasn't (multi-account
  selector with no backend, a dangling import, features needing new data-fetching
  infra). Full breakdown in that folder's `README.md`.

Neither folder is included in the TypeScript build (`tsconfig.json` only
includes `src`).

## 2026-07-25 audit — what was actually wrong

The user asked for a duplicate-file audit/merge + this file. Investigation turned
up something bigger: **the app did not compile at all**. In order, what was found
and fixed:

1. `src/hooks/useOrderPlacement.ts` — missing closing `}` (syntax error).
2. `src/stores/chartStore.ts` did not exist, but 6 live files imported
   `useChartStore` from it (`DrawingOverlay.tsx`, `useKeyboardShortcuts.ts`, plus
   4 files that turned out to be part of the dead single-chart tree above). It had
   been intentionally removed in favor of `layoutStore`'s per-chart drawing state,
   but nothing was migrated. Migrated `DrawingOverlay.tsx` and
   `useKeyboardShortcuts.ts` to `layoutStore` (added `magnetMode`,
   `toggleMagnetMode`, `toggleLockAllDrawings` to support it); archived the 4 files
   that belonged to the dead tree instead of migrating them.
3. `src/types/index.ts` locally redeclared `Symbol` (`= string`), `ChartType`
   (`'candlestick'|'bar'|'line'|'area'|'heikinashi'`) and `Timeframe`
   (`'1m'...'1M'` lowercase), which **silently shadowed** the real definitions
   re-exported from `market.ts` (`Symbol` interface with `id`/`digits`/`pipSize`/
   etc., `ChartType` with `'heikin-ashi'`, `Timeframe` `'1m'...'1W'`). Every file
   importing `Symbol`/`ChartType`/`Timeframe` from `@/types` silently got the
   wrong one. Removed the local redeclarations.
4. `ChartInstance.symbol` was typed `SymbolInfo` (a `{name, digits, pipSize, type}`
   struct with no `id`) but the code everywhere accesses `chart.symbol.id` —
   should have been `Symbol` (the market.ts interface). Fixed.
5. `ChartTile.tsx` used `bid`/`ask`/`spread` inside `useCallback` dependency
   arrays **before** the `const` declarations that produce them — a real
   temporal-dead-zone bug (throws on first render), not just a lint warning.
   Moved the declarations above the callbacks that reference them.
6. `DrawingOverlay.tsx`, `PositionLines.tsx`, `ChartContextMenu.tsx` called
   `series.priceScale().priceToCoordinate(...)` / `.coordinateToPrice(...)` —
   those methods live on `ISeriesApi` directly in lightweight-charts v4, not on
   the `IPriceScaleApi` that `.priceScale()` returns. Would throw at runtime the
   moment a user tried to draw or drag SL/TP. Fixed to call the methods on the
   series directly (`ChartContextMenu` needed a `series` prop added for this).
7. `orderStore.ts` was missing `modifySLTP` (present on `orderService` but never
   exposed through the store) and `placeOrder`'s params didn't include
   `slPrice`/`tpPrice` even though `orderService.placeOrder` already supported
   them. Added both.
8. `server/mt5-bridge.js` used CommonJS `require()`/`module.exports` in a
   `"type": "module"` package — crashed instantly on every `npm run dev`. Same
   file was also missing a `/latest` HTTP endpoint that the frontend was already
   polling (`src/hooks/useMT5Bridge.ts`). Converted to ESM, added the endpoint.
9. `tsconfig.json` had `noUnusedLocals`/`noUnusedParameters` on, which added ~40
   cosmetic errors on top of the real ones from years of scaffolding. Turned off
   — no effect on runtime, just noise.
10. Deleted `mt5-bridge/bridge/` outright (not archived) — a ZeroMQ↔WebSocket
    bridge server, incompatible with the actual EA, confirmed for removal by the
    user rather than kept as a future path.

Verified via `npx tsc --noEmit` (clean), `npm run build` (succeeds), and manually
in a browser: chart renders, live feed connects, drawing tools work, all panel
toggles (Alerts/Strategy/DOM/Order/P&L/Journal/Templates) open without errors,
and `npm run dev` starts both the bridge and Vite without crashing.

## 2026-07-25 (continued) — indicators, Volume Profile, and the rest of the legacy UI rebuilt

The user then asked to rebuild `BottomPanel`, `LeftSidebar`, `TopToolbar`,
`IndicatorsModal` + indicator rendering (including Volume Profile) from
`archive/legacy-single-chart-ui/`, wired to real data instead of the old
`chartStore`. Done — see the architecture diagram above. Specifics:

- `layoutStore` gained per-chart `indicators` CRUD + `showVolume`/`showGrid`
  fields (`ChartInstance` type extended accordingly).
- `IndicatorOverlay.tsx`/`IndicatorPanel.tsx`/`VolumeProfileIndicator.tsx` ported
  from the archive near-verbatim — they already took `data`/`indicators` as
  props rather than reading a global store, so they needed no architectural
  change, just real `chart.data`/`chart.indicators` wiring. `calculateVolumeProfile`
  was moved from `utils/mockData.ts` to `utils/indicators.ts` (it's a real
  calculation over `OHLCV[]`, not mock-data-specific — it never belonged there).
- `ChartTile.tsx` now renders an actual volume histogram (previously nothing —
  the app had **no volume bars at all**), toggle-able via `chart.showVolume`;
  grid lines are toggle-able via `chart.showGrid`; Undo/Redo are now visible
  header buttons wired to `layoutStore`'s existing (previously keyboard-only)
  `undoDrawing`/`redoDrawing`.
- `IndicatorsModal.tsx` rebuilt against `layoutStore`'s per-chart indicator
  actions. **Found and fixed a real bug while testing**: indicator IDs were
  generated as `` `ind-${Date.now()}` ``, which collides when two indicators are
  added within the same millisecond (trivially reproducible by clicking two
  preset buttons in quick succession) — React then renders duplicate keys and
  silently drops one. Switched to `nanoid()`. The same collision-prone pattern
  existed in `DrawingOverlay.tsx`'s drawing IDs and `useDrawingTemplates.ts`'s
  template IDs (both used as React list keys) — fixed those too.
- `LeftSidebar.tsx` rebuilt as a **per-tile** component (the original was global,
  for the old single-chart layout) — operates on that `ChartTile`'s own
  `activeTool` state and `layoutStore`'s per-chart drawings.
- `BottomPanel.tsx` rebuilt with real data throughout: Trades/Orders/Positions
  tabs read from `useOrderStore()` filtered by the tile's symbol; the Settings
  tab's Chart Type/Show Volume/Show Grid/Magnet Mode controls are wired to the
  same `layoutStore` state the header and chart itself use (not separate,
  disconnected local checkboxes like the archived version had).

Verified in-browser: added SMA/RSI/Volume Profile indicators (all three render,
including the previously-nonexistent RSI sub-panel), toggled Show Volume/Show
Grid live, exercised the sidebar's tool selection and magnet toggle, confirmed
`npx tsc --noEmit` and `npm run build` stay clean.

## Known gaps (deliberately not fixed/built in this pass)

- **No multi-account support.** The bridge and EA are single-account only.
- **Trade analytics are intentionally limited.** `PnLDashboard`/`TradeJournal`
  only show unrealized P&L, commission, and SL/TP hit counts — not win-rate or
  profit-factor — because `Trade` (`src/types/order.ts`) doesn't carry a
  per-trade `profit` field, and reconstructing it needs a real change to
  `OrderService.closePosition`/`updatePosition`
  (`src/services/orderService.ts`), not just a UI port. See
  `archive/mt5-bridge-frontend-prototype/README.md` for the detail.
- **`PositionLines.tsx`'s SL/TP drag has no visual handle** while dragging (you
  only see the result on mouseup). The archived `SLTPDragOverlay.tsx` is a nicer
  reference implementation if this gets revisited.
- **`accountBalance` is hardcoded to `10000`** in `RiskCalculator`'s caller and
  `useStrategyRunner.ts` (both marked `// TODO`) — there's no live account/equity
  feed feeding a real balance yet.
