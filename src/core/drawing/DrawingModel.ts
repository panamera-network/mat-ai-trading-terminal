import { DrawingType, Timeframe } from '@/types'

export const DRAWING_SCHEMA_VERSION = 1

export interface DrawingAnchorModel {
  time: number
  price: number
}

export interface DrawingStyleModel {
  lineColor?: string
  lineWidth?: number
  lineDash?: number[]
  fillColor?: string
  fillOpacity?: number
  showLabels?: boolean
  labelFont?: string
  labelColor?: string
}

export interface DrawingModel {
  id: string
  type: DrawingType
  anchors: DrawingAnchorModel[]
  style: DrawingStyleModel
  visible: boolean
  locked: boolean
  zIndex?: number
  metadata?: {
    runtimeType?: string
  }
  createdAt: number
  updatedAt: number
}

export interface DrawingPersistenceScope {
  workspaceId?: string
  layoutId: string
  chartId: string
  symbol: string
  timeframe: Timeframe
}

export interface SerializedDrawingSet {
  schemaVersion: typeof DRAWING_SCHEMA_VERSION
  savedAt: number
  scope: DrawingPersistenceScope
  drawings: DrawingModel[]
}

