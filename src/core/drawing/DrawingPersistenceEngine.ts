import { DrawingModel, DrawingPersistenceScope } from '@/core/drawing/DrawingModel'
import {
  createDrawingScopeKey,
  migrateDrawingPayload,
  parseDrawingSet,
  serializeDrawingSet,
} from '@/core/drawing/DrawingSerializer'
import { DrawingStorageAdapter, LocalStorageDrawingAdapter } from '@/core/drawing/DrawingStorageAdapter'

export class DrawingPersistenceEngine {
  private destroyed = false

  constructor(private readonly adapter: DrawingStorageAdapter = new LocalStorageDrawingAdapter()) {}

  getScopeKey(scope: DrawingPersistenceScope): string {
    return createDrawingScopeKey(scope)
  }

  async load(scope: DrawingPersistenceScope): Promise<DrawingModel[]> {
    if (this.destroyed) return []
    const payload = await this.adapter.load(this.getScopeKey(scope))
    if (!payload || this.destroyed) return []
    const drawingSet = parseDrawingSet(payload, scope)
    return drawingSet?.drawings || []
  }

  async save(scope: DrawingPersistenceScope, drawings: readonly DrawingModel[]): Promise<void> {
    if (this.destroyed) return
    const drawingSet = serializeDrawingSet(scope, drawings)
    await this.adapter.save(this.getScopeKey(scope), JSON.stringify(drawingSet))
  }

  async clear(scope: DrawingPersistenceScope): Promise<void> {
    if (this.destroyed) return
    await this.adapter.remove(this.getScopeKey(scope))
  }

  migrate(payload: unknown, scope: DrawingPersistenceScope) {
    return migrateDrawingPayload(payload, scope)
  }

  destroy() {
    this.destroyed = true
  }
}

