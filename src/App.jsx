import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import City from './components/City'
import Controls from './components/Controls'
import Sky from './components/Sky'
import Ground from './components/Ground'
import Legend from './components/Legend'
import TimeLapse from './components/TimeLapse'
import DependencyArcs from './components/DependencyArcs'
import { fetchFileContent, fetchRepoData, fetchCommitHistory, fetchFilesContent } from './services/github'
import { buildDependencyMap, PARSEABLE_EXTENSIONS } from './utils/dependencyParser'

function ShadowController({ timelapseActive }) {
  const { gl } = useThree()
  React.useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = 1 // PCFShadowMap
    gl.shadowMap.autoUpdate = true

    if (timelapseActive) {
      // Keep shadow map updating every frame during animation
      return
    }

    // Static scene — disable auto-update after a few frames to save GPU
    let frameCount = 0
    const rafHandle = setInterval(() => {
      frameCount++
      if (frameCount > 5) gl.shadowMap.autoUpdate = false
    }, 16)
    return () => clearInterval(rafHandle)
  }, [gl, timelapseActive])
  return null
}

export default function App() {
  const [repoUrl, setRepoUrl]           = useState('')
  const [data, setData]                 = useState(null)
  const [loading, setLoading]           = useState(false)
  const [progress, setProgress]         = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent]   = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const [showContentModal, setShowContentModal] = useState(false)
  const [error, setError]               = useState('')
  const [isMobile, setIsMobile]         = useState(false)
  const [shadowsEnabled, setShadowsEnabled] = useState(false)

  // ── Dependency graph state ─────────────────────────────────────────────────
  const cityRef                               = useRef(null)   // forwarded meshesRef
  const [depMap, setDepMap]                   = useState(null) // Map<path, Set<path>>
  const [depLoading, setDepLoading]           = useState(false)
  const [depProgress, setDepProgress]         = useState(0)

  // ── Time-lapse state ───────────────────────────────────────────────────────
  const [showTimelapse, setShowTimelapse]       = useState(false)
  const [tlLoading, setTlLoading]               = useState(false)
  const [tlProgress, setTlProgress]             = useState(0)
  const [snapshots, setSnapshots]               = useState(null)   // Array<snapshot>
  const [tlIndex, setTlIndex]                   = useState(0)
  const [tlPlaying, setTlPlaying]               = useState(false)
  const [tlSpeed, setTlSpeed]                   = useState(1)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleFetch = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setProgress(0)
      setError('')
      // Reset timelapse when fetching a new repo
      setShowTimelapse(false)
      setSnapshots(null)
      setTlIndex(0)
      setTlPlaying(false)

      const parsed = parseRepoUrl(repoUrl)
      if (!parsed) return alert('Invalid repo URL')
      const d = await fetchRepoData(parsed.owner, parsed.repo, (p) => setProgress(p))
      setData(d)
      setShadowsEnabled(true)
      setProgress(100)

      // ── Kick off dependency graph fetch in the background ──────────────────
      setDepMap(null)
      setDepLoading(true)
      setDepProgress(0)
      const parseablePaths = d.files
        .filter(f => {
          const ext = f.path.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? ''
          return PARSEABLE_EXTENSIONS.has(ext)
        })
        .map(f => f.path)

      fetchFilesContent(d.owner, d.repo, parseablePaths, d.branch, (p) => setDepProgress(p))
        .then(contentMap => {
          const map = buildDependencyMap(d.files, contentMap)
          setDepMap(map)
        })
        .catch(err => console.warn('Dependency fetch failed:', err.message))
        .finally(() => setDepLoading(false))
    } catch (err) {
      console.error(err)
      setError(err.message || 'Veri alınırken hata')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setRepoUrl('')
    setData(null)
    setProgress(0)
    setSelectedFile(null)
    setFileContent('')
    setContentLoading(false)
    setContentError('')
    setShowContentModal(false)
    setError('')
    setLoading(false)
    setShadowsEnabled(false)
    setDepMap(null)
    setDepLoading(false)
    setDepProgress(0)
    setShowTimelapse(false)
    setSnapshots(null)
    setTlIndex(0)
    setTlPlaying(false)
    setTlLoading(false)
    setTlProgress(0)
  }

  const handleInspectFile = async () => {
    if (!data || !selectedFile) return
    try {
      setContentLoading(true)
      setContentError('')
      setShowContentModal(true)
      const content = await fetchFileContent(data.owner, data.repo, selectedFile.path, data.branch)
      setFileContent(content)
    } catch (err) {
      console.error(err)
      setContentError(err.message || 'Dosya içeriği alınamadı')
      setFileContent('')
    } finally {
      setContentLoading(false)
    }
  }

  // ── Time-lapse handlers ────────────────────────────────────────────────────
  const handleOpenTimelapse = async () => {
    if (!data) return
    setShowTimelapse(true)
    setTlPlaying(false)
    setTlIndex(0)

    // If we already have snapshots for this repo, don't re-fetch
    if (snapshots) return

    try {
      setTlLoading(true)
      setTlProgress(0)
      const history = await fetchCommitHistory(
        data.owner,
        data.repo,
        data.branch,
        (p) => setTlProgress(p),
        80  // fetch up to 80 commits to stay within rate limits
      )
      setSnapshots(history)
      setTlIndex(0)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Commit geçmişi alınamadı')
      setShowTimelapse(false)
    } finally {
      setTlLoading(false)
    }
  }

  const handleCloseTimelapse = () => {
    setShowTimelapse(false)
    setTlPlaying(false)
  }

  const handleTlPlayPause = useCallback(() => {
    setTlPlaying(p => {
      // If at the end, restart from beginning
      if (!p && snapshots && tlIndex >= snapshots.length - 1) {
        setTlIndex(0)
      }
      return !p
    })
  }, [snapshots, tlIndex])

  const handleTlIndexChange = useCallback((valOrFn) => {
    setTlIndex(valOrFn)
  }, [])

  // Called by City's useFrame when buildings have settled and dwell time elapsed
  const handleAdvanceCommit = useCallback(() => {
    setTlIndex(prev => {
      const next = prev + 1
      if (!snapshots || next >= snapshots.length) {
        // Reached the end — stop playback
        setTlPlaying(false)
        return prev
      }
      return next
    })
  }, [snapshots])

  // Current snapshot to pass to City (null = show current repo state)
  const activeSnapshot = showTimelapse && snapshots && snapshots.length > 0
    ? snapshots[tlIndex]
    : null
  return (
    <div className="app-root">
      <header className="topbar">
        <form onSubmit={handleFetch}>
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
          />
          <button type="submit" disabled={loading}>Fetch</button>
          <button type="button" className="reset-btn" onClick={handleReset} disabled={loading && !data}>
            Reset
          </button>
        </form>

        {/* Time-lapse trigger button — only shown when a repo is loaded */}
        {data && !loading && (
          <button
            type="button"
            className={`timelapse-trigger-btn ${showTimelapse ? 'active' : ''}`}
            onClick={showTimelapse ? handleCloseTimelapse : handleOpenTimelapse}
            title="Toggle time-lapse"
          >
            ⏱ Time-Lapse
          </button>
        )}

        {loading && (
          <div className="loader-container">
            <span>{progress}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </header>

      {/* Time-lapse panel */}
      {showTimelapse && (
        <TimeLapse
          snapshots={snapshots}
          currentIndex={tlIndex}
          isPlaying={tlPlaying}
          speed={tlSpeed}
          onIndexChange={handleTlIndexChange}
          onPlayPause={handleTlPlayPause}
          onSpeedChange={setTlSpeed}
          onClose={handleCloseTimelapse}
          loading={tlLoading}
          loadProgress={tlProgress}
        />
      )}

      {error && (
        <div className="error-banner">
          <div className="error-content">
            <strong>GitHub API Hatası:</strong> {error}
          </div>
          <button className="error-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      <main
        className="canvas-wrap"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedFile(null)
        }}
      >
        <Canvas
          camera={{ position: [0, 30, 40], fov: 50 }}
          style={{ background: 'linear-gradient(180deg, #87ceeb 0%, #b0e0e6 50%, #e0f6ff 100%)' }}
          shadows={shadowsEnabled}
        >
          <ambientLight intensity={0.7} color="#ffffff" />
          <directionalLight
            position={[20, 30, 20]}
            intensity={1.5}
            color="#ffffe0"
            castShadow={shadowsEnabled}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
          />
          <directionalLight position={[-10, 5, -20]} intensity={0.3} color="#e6f2ff" />
          <ShadowController timelapseActive={showTimelapse} />
          <Sky />
          <Ground />
          <Controls />
          {data && (
            <City
              ref={cityRef}
              repoData={data}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              timelapseSnapshot={activeSnapshot}
              isPlaying={tlPlaying}
              tlSpeed={tlSpeed}
              onAdvanceCommit={handleAdvanceCommit}
            />
          )}
          {data && depMap && (
            <DependencyArcs
              depMap={depMap}
              meshesRef={cityRef}
              selectedFile={selectedFile}
              timelapseSnapshot={activeSnapshot}
            />
          )}
        </Canvas>

        <Legend repoData={data} />

        {/* Timelapse date overlay */}
        {activeSnapshot && (
          <div className="tl-date-overlay">
            {activeSnapshot.date.toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
        )}

        {selectedFile && (
          <div className="info-panel">
            <button className="close-btn" onClick={() => setSelectedFile(null)}>✕</button>
            <h3>{selectedFile.path.split('/').pop()}</h3>
            <div className="file-info">
              <div><strong>Path:</strong> <code>{selectedFile.path}</code></div>
              <div>
                <strong>Size:</strong>{' '}
                {activeSnapshot
                  ? (() => {
                      const snap = activeSnapshot.files.get(selectedFile.path)
                      return snap
                        ? `${(snap.size / 1024).toFixed(2)} KB (at this commit)`
                        : 'Not yet created'
                    })()
                  : `${(selectedFile.size / 1024).toFixed(2)} KB`
                }
              </div>
              {selectedFile.lastCommitDate && (
                <div>
                  <strong>Last Updated:</strong>{' '}
                  {new Date(selectedFile.lastCommitDate).toLocaleDateString()}
                </div>
              )}
            </div>
            <button className="inspect-btn" onClick={handleInspectFile}>View</button>
            {depLoading && (
              <div className="dep-loading-hint">⏳ Analysing dependencies…</div>
            )}
            {depMap && selectedFile && (() => {
              const out = depMap.get(selectedFile.path)?.size ?? 0
              const inc = [...depMap.values()].filter(s => s.has(selectedFile.path)).length
              if (out + inc === 0) return null
              return (
                <div className="dep-summary">
                  {out > 0 && <span className="dep-out">→ {out} import{out !== 1 ? 's' : ''}</span>}
                  {inc > 0 && <span className="dep-in">← {inc} used by</span>}
                </div>
              )
            })()}
            <div className="hint">
              {isMobile
                ? 'Dokunup sürükleyin / İki parmakla yakınlaştırın'
                : 'Hareket etmek için fareyi taşıyın'}
            </div>
          </div>
        )}

        {showContentModal && (
          <div className="content-modal-backdrop" onClick={() => setShowContentModal(false)}>
            <div className="content-modal" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="modal-close-btn" onClick={() => setShowContentModal(false)}>✕</button>
              <h3>{selectedFile?.path?.split('/').pop()}</h3>
              <div className="modal-path">{selectedFile?.path}</div>
              <pre className="modal-content">
                {contentLoading ? 'Loading...' : contentError || fileContent || 'No content available.'}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function parseRepoUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] }
  } catch (e) {}
  return null
}
