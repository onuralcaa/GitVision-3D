import React, { useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import City from './components/City'
import Controls from './components/Controls'
import Sky from './components/Sky'
import Ground from './components/Ground'
import { fetchFileContent, fetchRepoData } from './services/github'

function ShadowController() {
  const { gl } = useThree()
  React.useEffect(() => {
    // Initialize shadow map once and keep it stable
    gl.shadowMap.enabled = true
    gl.shadowMap.type = 1 // PCFShadowMap
    // Render shadows once then stabilize
    gl.shadowMap.autoUpdate = true
    let frameCount = 0
    const rafHandle = setInterval(() => {
      frameCount++
      if (frameCount > 5) {
        gl.shadowMap.autoUpdate = false
      }
    }, 16)
    return () => clearInterval(rafHandle)
  }, [gl])
  return null
}

export default function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const [showContentModal, setShowContentModal] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Detect mobile device
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
      const parsed = parseRepoUrl(repoUrl)
      if (!parsed) return alert('Geçersiz repo URL')
      const d = await fetchRepoData(parsed.owner, parsed.repo, (p) => setProgress(p))
      setData(d)
      setProgress(100)
    } catch (err) {
      console.error(err)
      const errorMsg = err.message || 'Veri alınırken hata'
      setError(errorMsg)
      setData(null)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="app-root">
      <header className="topbar">
        <form onSubmit={handleFetch}>
          <input value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" />
          <button type="submit" disabled={loading}>Fetch</button>
        </form>
        {loading && (
          <div className="loader-container">
            <span>{progress}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${progress}%`}}></div>
            </div>
          </div>
        )}
      </header>
      
      {error && (
        <div className="error-banner">
          <div className="error-content">
            <strong>GitHub API Hatası:</strong> {error}
          </div>
          <button className="error-close" onClick={() => setError('')}>✕</button>
        </div>
      )}

      <main className="canvas-wrap" onClick={(e) => {
        // Close info panel if clicking canvas area (not on panel itself)
        if (e.target === e.currentTarget) {
          setSelectedFile(null)
        }
      }}>
        <Canvas 
          camera={{ position: [0, 30, 40], fov: 50 }}
          style={{ background: 'linear-gradient(180deg, #87ceeb 0%, #b0e0e6 50%, #e0f6ff 100%)' }}
          shadows
        >
          <ambientLight intensity={0.7} color="#ffffff" />
          <directionalLight position={[20, 30, 20]} intensity={1.5} color="#ffffe0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} />
          <directionalLight position={[-10, 5, -20]} intensity={0.3} color="#e6f2ff" />
          <ShadowController />
          <Sky />
          <Ground />
          <Controls />
          {data && <City repoData={data} onFileSelect={setSelectedFile} selectedFile={selectedFile} />}
        </Canvas>
        {selectedFile && (
          <div className="info-panel">
            <button className="close-btn" onClick={() => setSelectedFile(null)}>✕</button>
            <h3>{selectedFile.path.split('/').pop()}</h3>
            <div className="file-info">
              <div><strong>Path:</strong> <code>{selectedFile.path}</code></div>
              <div><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</div>
              {selectedFile.lastCommitDate && (
                <div><strong>Last Updated:</strong> {new Date(selectedFile.lastCommitDate).toLocaleDateString()}</div>
              )}
            </div>
            <button className="inspect-btn" onClick={handleInspectFile}>View</button>
            <div className="hint">
              {isMobile ? 'Dokunup sürükleyin / İki parmakla yakınlaştırın' : 'Hareket etmek için fareyi taşıyın'}
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
  } catch(e){}
  return null
}
