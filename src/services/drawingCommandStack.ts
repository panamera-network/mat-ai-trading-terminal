import { Drawing } from '@/types'

export type CommandType = 'add' | 'update' | 'delete' | 'clear'

export interface DrawingCommand {
  id: string
  type: CommandType
  drawing: Drawing
  prevDrawing?: Drawing  // for update
  timestamp: number
}

export class DrawingCommandStack {
  private commands: DrawingCommand[] = []
  private cursor = -1
  private maxSize = 100

  execute(command: DrawingCommand) {
    // Remove any redo commands
    if (this.cursor < this.commands.length - 1) {
      this.commands = this.commands.slice(0, this.cursor + 1)
    }

    this.commands.push(command)

    // Trim if exceeds max size
    if (this.commands.length > this.maxSize) {
      this.commands.shift()
    } else {
      this.cursor++
    }
  }

  undo(): DrawingCommand | null {
    if (this.cursor < 0) return null
    const cmd = this.commands[this.cursor]
    this.cursor--
    return cmd
  }

  redo(): DrawingCommand | null {
    if (this.cursor >= this.commands.length - 1) return null
    this.cursor++
    return this.commands[this.cursor]
  }

  canUndo(): boolean {
    return this.cursor >= 0
  }

  canRedo(): boolean {
    return this.cursor < this.commands.length - 1
  }

  clear() {
    this.commands = []
    this.cursor = -1
  }

  getHistory(): DrawingCommand[] {
    return [...this.commands]
  }
}

export const drawingCommandStack = new DrawingCommandStack()
