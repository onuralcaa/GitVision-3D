import React, { useEffect, useRef } from 'react'

const SPEEDS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×',   value: 1   },
  { label: '2×',   value: 2   },
  { label: '4×',   value: 4   },
]

/**
 * TimeLapse panel — shown below the topbar when commit history is loaded.
 *
 * Props:
 *  snapshots    – Array<{ sha, date: Date, files: Map }>  (oldest → newest)
 *  currentIndex – number
 *  isPlaying    – bool
 *  speed        – number (multiplier)
 *  onIndexChange(i)
 *  onPlayPause()
 *  onSpeedChange(v)
 *  onClose()
 *  loading      – bool  (still fetching history)
 *  loadProgress – 0-100
 */
export default function TimeLapse({
  snapshots,
  currentIndex,
  isPlaying,
  speed,
  onIndexChange,
  onPlayPause,
  onSpeedChange,
  onClose,
  loading,
  loadProgress,
}) {
  const intervalRef = useRef(null)

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || !snapshots || snapshots.length === 0) {
      clearInterval(intervalRef.current)
      return
    }

    // Advance one commit every (1000ms / speed)
    const ms = Math.round(1000 / speed)
    intervalRef.current = setInterval(() => {
      onIndexChange(prev => {
        const next = prev + 1
        if (next >= snapshots.length) {
          // Reached the end — stop playback
          onPlayPause()
          return prev
        }
        return next
      })
    }, ms)

    return () => clearInterval(intervalRef.current)
  }, [isPlaying, speed, snapshots, onIndexChange, onPlayPause])

  const snapshot = snapshots?.[currentIndex]
  const total    = snapshots?.length ?? 0
  const fileCount = snapshot ? snapshot.files.size : 0

  const formatDate = (d) => {
    if (!d) return '—'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div className="timelapse-bar">
      {/* Header row */}
      <div className="timelapse-header">
        <span className="timelapse-title">⏱ Time-Lapse</span>

        {loading ? (
          <div className="timelapse-loading">
            <span>Fetching history… {loadProgress}%</span>
            <div className="tl-progress-track">
              <div className="tl-progress-fill" style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        ) : (
          <span className="timelapse-meta">
            {total} commits · {fileCount} files
          </span>
        )}

        <button className="tl-close-btn" onClick={onClose} title="Close time-lapse">✕</button>
      </div>

      {/* Controls row — only shown when data is ready */}
      {!loading && total > 0 && (
        <div className="timelapse-controls">
          {/* Play / Pause */}
          <button
            className={`tl-play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Rewind to start */}
          <button
            className="tl-icon-btn"
            onClick={() => onIndexChange(0)}
            title="Go to first commit"
            disabled={currentIndex === 0}
          >
            ⏮
          </button>

          {/* Timeline scrubber */}
          <div className="tl-scrubber-wrap">
            <input
              type="range"
              className="tl-scrubber"
              min={0}
              max={Math.max(0, total - 1)}
              value={currentIndex}
              onChange={e => onIndexChange(Number(e.target.value))}
            />
            <div className="tl-date-label">
              {formatDate(snapshot?.date)}
            </div>
          </div>

          {/* Skip to end */}
          <button
            className="tl-icon-btn"
            onClick={() => onIndexChange(total - 1)}
            title="Go to latest commit"
            disabled={currentIndex === total - 1}
          >
            ⏭
          </button>

          {/* Speed selector */}
          <div className="tl-speed-group">
            {SPEEDS.map(s => (
              <button
                key={s.value}
                className={`tl-speed-btn ${speed === s.value ? 'active' : ''}`}
                onClick={() => onSpeedChange(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Commit counter */}
          <span className="tl-counter">{currentIndex + 1} / {total}</span>
        </div>
      )}
    </div>
  )
}
