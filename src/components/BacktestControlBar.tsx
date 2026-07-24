import { useBacktestStore } from '@/stores/backtestStore'
import { useCallback } from 'react'

const SPEEDS = [0.5, 1, 2, 5, 10]

export default function BacktestControlBar() {
  const { state, play, pause, stop, step, stepBack, setSpeed } = useBacktestStore()

  if (!state) return null

  const progress = state.totalCandles > 0
    ? (state.cursor / state.totalCandles) * 100
    : 0

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cursor = Math.floor((parseFloat(e.target.value) / 100) * state.totalCandles)
    useBacktestStore.getState().seekTo(cursor)
  }

  return (
    <div className="h-14 bg-[#161a25] border-b border-gray-800 flex items-center px-3 gap-3">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={stepBack}
          disabled={state.cursor <= 0}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Step back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
          </svg>
        </button>

        <button
          onClick={step}
          disabled={state.isComplete}
          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Step forward"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
          </svg>
        </button>

        {state.isPlaying ? (
          <button
            onClick={pause}
            className="p-1.5 rounded bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400"
            title="Pause"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={play}
            disabled={state.isComplete}
            className="p-1.5 rounded bg-green-600/20 hover:bg-green-600/30 text-green-400 disabled:opacity-30"
            title="Play"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}

        <button
          onClick={stop}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-300"
          title="Stop / Reset"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{state.currentDate?.toLocaleString() || '—'}</span>
          <span>{state.cursor} / {state.totalCandles}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeek}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-500 uppercase">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
              state.speed === s
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-[#1e222d] border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {state.isComplete && (
          <span className="text-[10px] text-green-400 bg-green-900/20 px-2 py-0.5 rounded">
            Complete
          </span>
        )}
        {state.isPlaying && (
          <span className="text-[10px] text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded animate-pulse">
            Playing
          </span>
        )}
      </div>
    </div>
  )
}
