import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import City from './components/City'
import Controls from './components/Controls'
import { fetchRepoData } from './services/github'

export default function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFetch = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const parsed = parseRepoUrl(repoUrl)
      if (!parsed) return alert('Geçersiz repo URL')
      const d = await fetchRepoData(parsed.owner, parsed.repo)
      setData(d)
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
          <button type="submit">Fetch</button>
        </form>
        {loading && <div className="loader">Loading…</div>}
      </header>

      <main className="canvas-wrap">
        <Canvas camera={{ position: [0, 30, 40], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <Controls />
          {data && <City repoData={data} />}
        </Canvas>
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
