import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import City from './components/City'
import Controls from './components/Controls'
import Sky from './components/Sky'
import Ground from './components/Ground'
import { fetchRepoData } from './services/github'

export default function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFetch = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setProgress(0)
      const parsed = parseRepoUrl(repoUrl)
      if (!parsed) return alert('Geçersiz repo URL')
      const d = await fetchRepoData(parsed.owner, parsed.repo, (p) => setProgress(p))
      setData(d)
      setProgress(100)
    } catch (err) {
      console.error(err)
      alert(`Hata: ${err.message || 'Veri alınırken hata'}`)
    } finally {
      setLoading(false)
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

      <main className="canvas-wrap">
        <Canvas 
          camera={{ position: [0, 30, 40], fov: 50 }}
          style={{ background: 'linear-gradient(180deg, #87ceeb 0%, #b0e0e6 50%, #e0f6ff 100%)' }}
        >
          <ambientLight intensity={0.7} color="#ffffff" />
          <directionalLight position={[20, 30, 20]} intensity={1.5} color="#ffffe0" />
          <directionalLight position={[-10, 5, -20]} intensity={0.3} color="#e6f2ff" />
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
