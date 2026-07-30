export interface DrawingStorageAdapter {
  load(scopeKey: string): Promise<string | null>
  save(scopeKey: string, payload: string): Promise<void>
  remove(scopeKey: string): Promise<void>
}

export class LocalStorageDrawingAdapter implements DrawingStorageAdapter {
  constructor(private readonly prefix = 'mat:drawing:v1:') {}

  async load(scopeKey: string): Promise<string | null> {
    const storage = getLocalStorage()
    if (!storage) return null
    try {
      return storage.getItem(this.prefix + scopeKey)
    } catch (error) {
      console.warn('DrawingPersistence: local storage load failed', error)
      return null
    }
  }

  async save(scopeKey: string, payload: string): Promise<void> {
    const storage = getLocalStorage()
    if (!storage) return
    try {
      storage.setItem(this.prefix + scopeKey, payload)
    } catch (error) {
      console.warn('DrawingPersistence: local storage save failed', error)
    }
  }

  async remove(scopeKey: string): Promise<void> {
    const storage = getLocalStorage()
    if (!storage) return
    try {
      storage.removeItem(this.prefix + scopeKey)
    } catch (error) {
      console.warn('DrawingPersistence: local storage remove failed', error)
    }
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

