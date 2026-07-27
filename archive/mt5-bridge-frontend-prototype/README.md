# MT5 bridge frontend prototype (archived)

This was a standalone package (`mt5-bridge/frontend/`, its own `README.md`) that was
never wired into the main app (`src/`) — nothing in `src/` imported from it. It was
built against a multi-account ZeroMQ↔WebSocket bridge (`mt5-bridge/bridge/`, also
archived — see the ZMQ note below) that spoke a different protocol than the bridge
actually used by the app (`server/mt5-bridge.js`, single-account, raw TCP + HTTP
polling, the one the real `mql5/MATai_Bridge.mq5` EA connects to).

On 2026-07-25 this repo was audited end-to-end (the app didn't even compile at the
time — see git history / CLAUDE.md for the full account). The genuinely useful,
self-contained pieces of this prototype were ported into `src/`, adapted to the
live `layoutStore`/`orderStore` data model instead of the prototype's own
`useMT5Feed` WebSocket protocol. Once ported and verified working in the browser,
the source files below were deleted from this archive (kept only in git/session
history) — what's left in `frontend/` now is only the pieces that were **not**
ported (see "Not ported, and why" below).

| Ported to | Was here (now deleted, already merged) |
|---|---|
| `src/components/RiskCalculator.tsx` | `components/RiskCalculator.tsx` (wired into `OrderPanel`) |
| `src/components/OrderConfirmModal.tsx` | `components/OrderConfirmModal.tsx` (wired into `OrderPanel`'s submit flow) |
| `src/components/PnLDashboard.tsx` + `src/hooks/usePnL.ts` | `components/PnLDashboard.tsx` + `hooks/usePnL.ts` (simplified — see below) |
| `src/components/TradeJournal.tsx` + `src/hooks/useTradeJournal.ts` | `components/TradeJournal.tsx` + `hooks/useTradeJournal.ts` (rebuilt around `useOrderStore().trades` instead of a separate WS-fed trade log) |
| `src/components/DrawingTemplateManager.tsx` + `src/hooks/useDrawingTemplates.ts` | same names (rebuilt around `layoutStore`'s `Drawing[]` instead of the prototype's own `DrawingObject` type) |
| `src/components/PositionActions.tsx` | `components/PositionActions.tsx` (partial close 25/50/75/100%, reverse, breakeven — wired into `OrderPanel`'s position section via `useOrderStore`'s `placeOrder`/`modifySLTP`; reverse = opposite-side order at 2× position size, which `OrderService.updatePosition`'s flip branch already handles correctly; verified end-to-end in browser: buy → reverse → breakeven → auto SL-close, no errors) |
| `direction: 'touch'` on `PriceAlert` (`src/types/alerts.ts`, `alertsService.ts`, `AlertsPanel.tsx`) | `components/PriceAlertPanel.tsx` + `hooks/useAlerts.ts` — everything else in those two files duplicated the already-live `AlertsPanel.tsx`/`alertsStore.ts`/`alertsService.ts`, so only this one missing condition was merged in (both files then deleted) |

`utils/risk-calculator.ts` was also deleted from here — it was an empty file with
nothing to port.

**Why the PnL/analytics scope is smaller here than in the prototype:** the live
`Trade` type (`src/types/order.ts`) records `price`/`size`/`commission`/`exitReason`
per fill but not a computed `profit` per trade — profit only exists on open
`Position`s (as `unrealizedPnL`), which are deleted once a position fully closes.
Reconstructing win-rate/profit-factor/max-drawdown accurately would require adding
a `profit` field to `Trade` and threading it through `OrderService.closePosition`
and the partial-close branch in `updatePosition` (`src/services/orderService.ts`).
That's a real change to the order-matching engine, not a UI port, so it was left
alone rather than risk destabilizing working code under time pressure — the ported
`PnLDashboard`/`TradeJournal` only surface numbers that are honestly derivable
today (unrealized P&L, commission paid, SL/TP hit counts, raw trade log).
Revisit `getDefaultSpread`/`closePosition` in `orderService.ts` if you want to add
`profit` and unlock full analytics.

**Since resolved:** `components/SLTPDragOverlay.tsx`'s UX idea (live handle +
label showing price/pip distance while dragging SL/TP) was implemented directly
in `src/components/PositionLines.tsx` (2026-07-25) — as a `drag` state addition
alongside the mousemove handler that was already calling `modifySLTP`, using the
real `series.priceToCoordinate`/`coordinateToPrice` API, not this package's
`chart-helpers.ts` (which did manual price-scale math for a different,
non-lightweight-charts chart implementation and was never applicable here).
Verified end-to-end with a live drag in the browser. `SLTPDragOverlay.tsx` and
`chart-helpers.ts` were deleted from here afterward — nothing in them ended up
used, since the real API made the manual coordinate math unnecessary.

**Since resolved:** `components/MultiTimeframePanel.tsx` — rebuilt in
`src/components/MultiTimeframePanel.tsx` (2026-07-25). This uncovered a real bug
in the process: `mt5Feed`/`binanceFeed` (`src/services/`) were module-level
singletons with exactly one active connection — connecting a second
symbol/timeframe tore down whatever was already streaming. In a multi-chart
layout, opening a second tile on a different symbol silently froze the first
tile and made both tiles display the second symbol's price. Fixed by refactoring
`mt5Feed.ts`, `binanceFeed.ts`, and `depthFeed.ts` into proper subscription
managers (`connect()` returns an id, keyed in a `Map`, so each caller gets an
independent connection); `useRealtimeFeed.ts`/`useDepthData.ts` updated to use
the returned id. Verified in-browser: two tiles on EUR/USD and GBP/USD now show
correct, independently-updating prices instead of collapsing to one. Added a
`driveOrders` opt-out on `mt5Feed.connect()` so secondary subscriptions (this
panel's glance timeframes, the DOM panel's depth-only subscription) don't each
run their own random walk against `orderService`'s position/pending-order
checks — only the chart tile actually trading a symbol should do that.
`MultiTimeframePanel` seeds each mini-chart via `dataLoader.ts`'s
`generateMockData` (scaled per timeframe to ~30 bars each) since the feed's
candle bucketing is wall-clock-real-time — without a seed, a 1D/1W subscription
would show almost no history within a normal session.

**Not ported, and why:**
- `components/MT5FeedSelector.tsx`, `hooks/useMT5Feed.ts`, `hooks/useMT5NativeBridge.ts` —
  multi-account UI/data layer for the ZeroMQ bridge. `useMT5NativeBridge.ts` also has
  a dangling import (`../services/mt5-native-bridge`, a file that never existed in
  this package). The live bridge (`server/mt5-bridge.js`) is single-account only, so
  there's no backend for a multi-account selector today.

`types/mt5.ts` is kept because `MT5FeedSelector`/`useMT5Feed` still import from
it. Everything else that only existed to support now-deleted, already-handled
files was removed.

The ZeroMQ backend this package originally talked to (`mt5-bridge/bridge/`) was
deleted outright rather than archived — it's incompatible with the actual EA and
the user confirmed removal during the audit.
