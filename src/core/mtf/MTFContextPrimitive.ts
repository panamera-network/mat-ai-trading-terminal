import {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { CanvasRenderingTarget2D } from 'fancy-canvas'
import { MTFContextColumn } from '@/core/mtf/MTFContextModel'
import { calculateMTFContextLayout } from '@/core/mtf/MTFContextLayout'

export interface MTFRenderTheme {
  bullishColor: string
  bearishColor: string
  bullishWickColor: string
  bearishWickColor: string
  labelColor: string
  separatorColor: string
}

export const DEFAULT_MTF_RENDER_THEME: MTFRenderTheme = {
  bullishColor: '#26a69a',
  bearishColor: '#ef5350',
  bullishWickColor: '#26a69a',
  bearishWickColor: '#ef5350',
  labelColor: '#d1d4dc',
  separatorColor: 'rgba(209, 212, 220, 0.18)',
}

interface MTFContextPrimitiveState {
  columns: readonly MTFContextColumn[]
  theme: MTFRenderTheme
  series: ISeriesApi<SeriesType> | null
}

class MTFContextPaneView implements IPrimitivePaneView {
  constructor(private readonly state: MTFContextPrimitiveState) {}

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal'
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this.state.series || this.state.columns.length === 0) return null
    return new MTFContextPaneRenderer(this.state)
  }
}

class MTFContextPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly state: MTFContextPrimitiveState) {}

  draw(target: CanvasRenderingTarget2D) {
    const series = this.state.series
    if (!series) return

    target.useBitmapCoordinateSpace((scope) => {
      const { context, horizontalPixelRatio, verticalPixelRatio, mediaSize } = scope
      const drawableColumns = this.state.columns.filter((column) =>
        column.status !== 'unavailable' &&
        column.status !== 'loading' &&
        column.candle
      )
      const layout = calculateMTFContextLayout({
        paneWidth: mediaSize.width,
        paneHeight: mediaSize.height,
        visibleColumnCount: drawableColumns.length,
      })

      if (layout.visibleCount === 0) return

      context.save()
      context.font = `${Math.round(10 * verticalPixelRatio)}px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'top'

      const visibleColumns = drawableColumns.slice(0, layout.visibleCount)
      for (let index = 0; index < visibleColumns.length; index++) {
        const column = visibleColumns[index]
        const slot = layout.columns[index]
        if (!column.candle) continue

        const opacity = getStatusOpacity(column.status, column.isPartial)
        const x = slot.x
        const width = slot.width
        const centerX = x + width / 2
        const openY = series.priceToCoordinate(column.candle.open)
        const highY = series.priceToCoordinate(column.candle.high)
        const lowY = series.priceToCoordinate(column.candle.low)
        const closeY = series.priceToCoordinate(column.candle.close)
        if (openY === null || highY === null || lowY === null || closeY === null) continue

        const bullish = column.candle.close >= column.candle.open
        const bodyColor = bullish ? this.state.theme.bullishColor : this.state.theme.bearishColor
        const wickColor = bullish ? this.state.theme.bullishWickColor : this.state.theme.bearishWickColor

        this.drawSeparator(context, x - 3, layout.candleTop, layout.candleBottom, horizontalPixelRatio, verticalPixelRatio)
        this.drawCandle(context, {
          centerX,
          width,
          openY,
          highY,
          lowY,
          closeY,
          bodyColor,
          wickColor,
          opacity,
          horizontalPixelRatio,
          verticalPixelRatio,
        })

        if (width >= 10 && mediaSize.height >= 70) {
          context.globalAlpha = Math.min(0.9, opacity)
          context.fillStyle = this.state.theme.labelColor
          context.fillText(formatTimeframeLabel(column.timeframe), centerX * horizontalPixelRatio, (layout.candleBottom + 2) * verticalPixelRatio)
        }
      }

      context.restore()
    })
  }

  private drawSeparator(
    context: CanvasRenderingContext2D,
    x: number,
    top: number,
    bottom: number,
    horizontalPixelRatio: number,
    verticalPixelRatio: number
  ) {
    context.globalAlpha = 1
    context.strokeStyle = this.state.theme.separatorColor
    context.lineWidth = Math.max(1, Math.floor(horizontalPixelRatio))
    context.beginPath()
    const pixelX = Math.round(x * horizontalPixelRatio) + 0.5
    context.moveTo(pixelX, top * verticalPixelRatio)
    context.lineTo(pixelX, bottom * verticalPixelRatio)
    context.stroke()
  }

  private drawCandle(
    context: CanvasRenderingContext2D,
    input: {
      centerX: number
      width: number
      openY: number
      highY: number
      lowY: number
      closeY: number
      bodyColor: string
      wickColor: string
      opacity: number
      horizontalPixelRatio: number
      verticalPixelRatio: number
    }
  ) {
    const {
      centerX,
      width,
      openY,
      highY,
      lowY,
      closeY,
      bodyColor,
      wickColor,
      opacity,
      horizontalPixelRatio,
      verticalPixelRatio,
    } = input

    const bodyTop = Math.min(openY, closeY)
    const bodyBottom = Math.max(openY, closeY)
    const minBodyHeight = 2 / verticalPixelRatio
    const bodyHeight = Math.max(minBodyHeight, bodyBottom - bodyTop)
    const bodyY = bodyHeight === minBodyHeight
      ? bodyTop - minBodyHeight / 2
      : bodyTop
    const bodyX = centerX - width / 2

    context.globalAlpha = opacity
    context.strokeStyle = wickColor
    context.lineWidth = Math.max(1, Math.floor(horizontalPixelRatio))
    context.beginPath()
    const wickX = Math.round(centerX * horizontalPixelRatio) + 0.5
    context.moveTo(wickX, highY * verticalPixelRatio)
    context.lineTo(wickX, lowY * verticalPixelRatio)
    context.stroke()

    context.fillStyle = bodyColor
    context.fillRect(
      Math.round(bodyX * horizontalPixelRatio),
      Math.round(bodyY * verticalPixelRatio),
      Math.max(1, Math.round(width * horizontalPixelRatio)),
      Math.max(1, Math.round(bodyHeight * verticalPixelRatio))
    )
  }
}

export class MTFContextPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null
  private state: MTFContextPrimitiveState = {
    columns: [],
    theme: DEFAULT_MTF_RENDER_THEME,
    series: null,
  }
  private paneView = new MTFContextPaneView(this.state)

  attached(param: SeriesAttachedParameter<Time, SeriesType>) {
    this.state.series = param.series
    this.requestUpdate = param.requestUpdate
    this.requestUpdate()
  }

  detached() {
    this.state.series = null
    this.requestUpdate = null
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }

  updateAllViews() {
    this.requestUpdate?.()
  }

  setColumns(columns: readonly MTFContextColumn[]) {
    this.state.columns = columns
    this.requestUpdate?.()
  }

  setTheme(theme: Partial<MTFRenderTheme>) {
    this.state.theme = { ...this.state.theme, ...theme }
    this.requestUpdate?.()
  }

  resize() {
    this.requestUpdate?.()
  }

  requestRedraw() {
    this.requestUpdate?.()
  }

  hitTest() {
    return null
  }
}

function getStatusOpacity(status: MTFContextColumn['status'], isPartial: boolean): number {
  if (status === 'stale') return 0.38
  if (status === 'incomplete' || isPartial) return 0.62
  return 0.9
}

function formatTimeframeLabel(timeframe: string): string {
  switch (timeframe) {
    case '15m':
      return 'M15'
    case '1H':
      return 'H1'
    case '4H':
      return 'H4'
    case '1D':
      return 'D1'
    case '1W':
      return 'W1'
    default:
      return timeframe.toUpperCase()
  }
}
