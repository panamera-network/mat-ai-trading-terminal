import { useState, useEffect, useCallback } from 'react'
import { Drawing } from '@/types'

const STORAGE_KEY = 'mat_drawing_templates'

export interface DrawingTemplate {
  id: string
  name: string
  symbol: string
  timeframe: string
  drawings: Drawing[]
  createdAt: number
}

export function useDrawingTemplates() {
  const [templates, setTemplates] = useState<DrawingTemplate[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  }, [templates])

  const saveTemplate = useCallback((name: string, symbol: string, timeframe: string, drawings: Drawing[]) => {
    const template: DrawingTemplate = {
      id: `template-${Date.now()}`,
      name,
      symbol,
      timeframe,
      drawings,
      createdAt: Date.now(),
    }
    setTemplates((prev) => [template, ...prev])
  }, [])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const getTemplatesForSymbol = useCallback(
    (symbol: string) => templates.filter((t) => t.symbol === symbol),
    [templates]
  )

  return { templates, saveTemplate, deleteTemplate, getTemplatesForSymbol }
}
