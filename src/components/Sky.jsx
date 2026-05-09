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
  
  // Gündüz gradient: yukarı açık mavi, alt açık mavi-beyaz
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  
  // Üst (gökyüzü): Açık mavi
  gradient.addColorStop(0, '#87ceeb')
  // Üst-orta: Açık mavi
  gradient.addColorStop(0.4, '#87ceeb')
  // Orta: Açık mavi-beyaz
  gradient.addColorStop(0.6, '#b0e0e6')
  // Alt (horizon): Çok açık mavi-beyaz
  gradient.addColorStop(1, '#e0f6ff')
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)
  
  // Bulut efektleri ekle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 200
    const w = Math.random() * 80 + 50
    const h = Math.random() * 25 + 15
    ctx.beginPath()
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}
