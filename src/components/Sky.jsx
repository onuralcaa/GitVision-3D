import React from 'react'
import * as THREE from 'three'

export default function Sky() {
  return (
    <mesh scale={500}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial 
        map={generateSkyTexture()}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

function generateSkyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  
  // Gün batımı gradient: yukarı mor-pembe, orta turuncu, alt altın-kırmızı
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  
  // Üst (gökyüzü): Koyu mor
  gradient.addColorStop(0, '#1a0033')
  // Üst-orta: Pembe-mor
  gradient.addColorStop(0.3, '#6b1b47')
  // Orta: Turuncu
  gradient.addColorStop(0.5, '#ff6b1b')
  // Orta-alt: Altın
  gradient.addColorStop(0.7, '#ffb81b')
  // Alt (horizon): Kırmızı-turuncu
  gradient.addColorStop(1, '#ff4500')
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)
  
  // Bulut efektleri ekle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const w = Math.random() * 60 + 40
    const h = Math.random() * 20 + 10
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}
