import React from 'react'
import * as THREE from 'three'

// Generate once at module load — never regenerated on re-render.
// Random elements (noise dots) are seeded so they're always identical.
const GROUND_TEXTURE = generateGroundTexture()

export default function Ground() {
  return (
    <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        map={GROUND_TEXTURE}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}

function generateGroundTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // Base concrete colour
  ctx.fillStyle = '#a8a8a8'
  ctx.fillRect(0, 0, 512, 512)

  // Grid lines
  ctx.strokeStyle = 'rgba(90, 90, 90, 0.35)'
  ctx.lineWidth = 1.5
  const tileSize = 64
  for (let x = 0; x <= 512; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke()
  }
  for (let y = 0; y <= 512; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke()
  }

  // Subtle noise — tiny single-pixel dots with a seeded-like pattern
  // (deterministic: no Math.random() so texture is identical every call)
  const noiseStep = 7
  for (let x = 0; x < 512; x += noiseStep) {
    for (let y = 0; y < 512; y += noiseStep) {
      // Pseudo-random brightness variation using a simple hash
      const v = ((x * 1619 + y * 31337) & 0xff) / 255
      const alpha = 0.04 + v * 0.06
      ctx.fillStyle = `rgba(60,60,60,${alpha.toFixed(3)})`
      ctx.fillRect(x, y, 2, 2)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.repeat.set(3, 3)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}
