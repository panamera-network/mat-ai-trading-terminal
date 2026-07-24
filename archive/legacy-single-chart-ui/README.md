# Legacy single-chart UI (archived)

This tree was an earlier, single-global-chart prototype of the trading terminal.
It was superseded by the multi-chart architecture in `src/components/MultiChartLayout.tsx`
+ `src/components/ChartTile.tsx`, backed by `src/stores/layoutStore.ts` (one entry
per chart tile, instead of one global chart).

None of these files were reachable from `src/App.tsx` when this was archived
(2026-07-25) — they all depended on `src/stores/chartStore.ts`, which had already
been removed in favor of `layoutStore`, so this tree could not compile or run.

Contents:
- `components/Chart/` — alternate `ChartContainer` (single chart) + `IndicatorOverlay` +
  `VolumeProfileIndicator`/`VolumeProfileOverlay`. The volume-profile logic here is the
  only thing with no live equivalent — `ChartTile.tsx` has no volume-profile rendering.
  If volume profile is wanted again, `VolumeProfileIndicator.tsx`'s approach (native
  lightweight-charts line series for POC/VAH/VAL) is a reasonable starting point, but
  it needs to be adapted to per-tile `layoutStore` state instead of the old `chartStore`.
- `components/DrawingLayer/DrawingOverlay.tsx` — earlier version of the drawing tool
  overlay. The live version (`src/components/DrawingOverlay.tsx`) is strictly newer/better
  (adds drag-to-edit handles on selected drawings); nothing here was worth merging back.
- `components/Sidebar/`, `components/Toolbar/` — a left sidebar + top toolbar for the old
  single-chart layout, including an `IndicatorsModal` for adding indicators. The live
  `ChartTile.tsx` has its own compact inline header (symbol/timeframe/chart-type selects)
  and currently has **no UI to add indicators** — indicators can only be attached
  programmatically. If an indicators picker is wanted, `IndicatorsModal.tsx` is the
  reference for the UX, but it needs rewriting against `layoutStore`'s per-chart
  `indicators` array.
- `components/Panels/` — `BottomPanel` (unused by anything, even in this legacy tree)
  and `IndicatorPanel` (panel-style indicator rendering, e.g. RSI/MACD below the chart).
- `hooks/useMagnetLock.ts` — standalone magnet-snap hook, superseded by the inline
  `snapToMagnet` logic in the live `DrawingOverlay.tsx`.
- `services/strategyRunner.ts` — an earlier strategy execution engine built around
  `StrategyRule`/`StrategyCondition` types that no longer exist in `src/types/strategy.ts`.
  Superseded by `src/services/strategyEngine.ts` + `src/hooks/useStrategyRunner.ts`
  (built around `StrategyScript`/`StrategyAction`), which is what's actually wired
  into `ChartTile.tsx` today.

This folder is excluded from the TypeScript build (`tsconfig.json` only includes `src`).
