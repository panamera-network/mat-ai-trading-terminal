export interface MTFContextLayoutInput {
  paneWidth: number
  paneHeight: number
  visibleColumnCount: number
  preferredColumnWidth?: number
  minColumnWidth?: number
  maxColumnWidth?: number
  outerGap?: number
  columnGap?: number
  labelHeight?: number
}

export interface MTFContextLayoutColumn {
  x: number
  width: number
}

export interface MTFContextLayoutResult {
  visibleCount: number
  columnWidth: number
  candleTop: number
  candleBottom: number
  columns: MTFContextLayoutColumn[]
}

const DEFAULT_COLUMN_WIDTH = 14
const DEFAULT_MIN_COLUMN_WIDTH = 10
const DEFAULT_MAX_COLUMN_WIDTH = 18
const DEFAULT_OUTER_GAP = 10
const DEFAULT_COLUMN_GAP = 5
const DEFAULT_LABEL_HEIGHT = 16

export function calculateMTFContextLayout(input: MTFContextLayoutInput): MTFContextLayoutResult {
  const paneWidth = Math.max(0, input.paneWidth)
  const paneHeight = Math.max(0, input.paneHeight)
  const requestedCount = Math.max(0, Math.floor(input.visibleColumnCount))
  const minColumnWidth = input.minColumnWidth ?? DEFAULT_MIN_COLUMN_WIDTH
  const maxColumnWidth = input.maxColumnWidth ?? DEFAULT_MAX_COLUMN_WIDTH
  const preferredColumnWidth = clamp(
    input.preferredColumnWidth ?? DEFAULT_COLUMN_WIDTH,
    minColumnWidth,
    maxColumnWidth
  )
  const outerGap = input.outerGap ?? DEFAULT_OUTER_GAP
  const columnGap = input.columnGap ?? DEFAULT_COLUMN_GAP
  const labelHeight = input.labelHeight ?? DEFAULT_LABEL_HEIGHT

  if (requestedCount === 0 || paneWidth < outerGap + minColumnWidth || paneHeight <= labelHeight + 8) {
    return emptyLayout()
  }

  let visibleCount = Math.min(3, requestedCount)
  while (visibleCount > 0) {
    const totalGap = outerGap + Math.max(0, visibleCount - 1) * columnGap
    const availableForColumns = paneWidth - totalGap
    const columnWidth = Math.min(preferredColumnWidth, Math.floor(availableForColumns / visibleCount))
    if (columnWidth >= minColumnWidth) {
      const boundedWidth = clamp(columnWidth, minColumnWidth, maxColumnWidth)
      const totalWidth = visibleCount * boundedWidth + Math.max(0, visibleCount - 1) * columnGap
      const startX = paneWidth - totalWidth - outerGap
      return {
        visibleCount,
        columnWidth: boundedWidth,
        candleTop: 4,
        candleBottom: paneHeight - labelHeight - 2,
        columns: Array.from({ length: visibleCount }, (_, index) => ({
          x: startX + index * (boundedWidth + columnGap),
          width: boundedWidth,
        })),
      }
    }
    visibleCount -= 1
  }

  return emptyLayout()
}

function emptyLayout(): MTFContextLayoutResult {
  return {
    visibleCount: 0,
    columnWidth: 0,
    candleTop: 0,
    candleBottom: 0,
    columns: [],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
