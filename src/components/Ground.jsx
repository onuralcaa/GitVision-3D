import React from 'react'
import * as THREE from 'three'

export default function Ground() {
  return (
    <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial 
        map={generateGroundTexture()}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}

function generateGroundTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  
  // Açık beton/asfalt base
  ctx.fillStyle = '#a8a8a8'
  ctx.fillRect(0, 0, 256, 256)
  
  // Beton dokusu - kareler
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)'
  ctx.lineWidth = 2
  const tileSize = 32
  for (let x = 0; x < 256; x += tileSize) {
    for (let y = 0; y < 256; y += tileSize) {
      ctx.strokeRect(x, y, tileSize, tileSize)
    }
  }
  
  // Ayrıntılar - çatlaklar ve pürüzlülük
  ctx.fillStyle = 'rgba(80, 80, 80, 0.15)'
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const w = Math.random() * 30 + 5
    const h = Math.random() * 10 + 1
    ctx.fillRect(x, y, w, h)
  }
  
  // Işık yansımaları (güneşin yansıması)
  ctx.fillStyle = 'rgba(255, 255, 200, 0.15)'
  ctx.beginPath()
  ctx.arc(128, 128, 80, 0, Math.PI * 2)
  ctx.fill()
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.repeat.set(2, 2)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}
