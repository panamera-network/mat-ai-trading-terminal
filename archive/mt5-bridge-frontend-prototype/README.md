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

**Not ported, and why:**
- `components/MT5FeedSelector.tsx`, `hooks/useMT5Feed.ts`, `hooks/useMT5NativeBridge.ts` —
  multi-account UI/data layer for the ZeroMQ bridge. `useMT5NativeBridge.ts` also has
  a dangling import (`../services/mt5-native-bridge`, a file that never existed in
  this package). The live bridge (`server/mt5-bridge.js`) is single-account only, so
  there's no backend for a multi-account selector today.
- `components/SLTPDragOverlay.tsx` + `utils/chart-helpers.ts` — a nicer *visual*
  drag-to-modify SL/TP interaction (live handle + label showing price and pip
  distance while dragging) than what's live today in `src/components/PositionLines.tsx`
  (which drags invisibly — no handle/label follows the cursor, you only see the
  result on mouseup). Worth revisiting as a UX upgrade to `PositionLines.tsx`, but
  wiring it to `lightweight-charts`' real coordinate system (`series.priceToCoordinate`/
  `coordinateToPrice`, the same API bug that was fixed elsewhere in this audit)
  needed more care than this pass had budget for.
- `components/MultiTimeframePanel.tsx` — needs a data-fetching path for secondary
  timeframes that doesn't exist live (the app only loads OHLCV for the chart's own
  active timeframe, via `src/services/dataLoader.ts`). Fetching N extra timeframes
  per chart tile is a real feature, not a quick port.

`types/mt5.ts` and `utils/chart-helpers.ts` are kept because the files above still
import from them (`MultiTimeframePanel`/`MT5FeedSelector` use `types/mt5.ts`;
`SLTPDragOverlay` pairs with `chart-helpers.ts`'s price↔coordinate math). Everything
else that only existed to support the now-deleted, already-ported files was removed.

The ZeroMQ backend this package originally talked to (`mt5-bridge/bridge/`) was
deleted outright rather than archived — it's incompatible with the actual EA and
the user confirmed removal during the audit.
