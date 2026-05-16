import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getColorForFileType } from '../utils/fileTypeColors'

// Compute the target height for a file given its size in bytes
function computeHeight(sizeBytes) {
  const lines = Math.max(1, Math.round((sizeBytes || 100) / 50))
  return Math.max(0.8, Math.log(lines + 1)) * 1.2
}

// A box geometry whose bottom face sits exactly at y=0.
// Translated up by 0.5 so the unit cube spans [0,1] on Y.
// The mesh stays at position.y = 0 forever — only scale.y changes.
// Shadow footprint (XZ) never moves.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
UNIT_BOX.translate(0, 0.5, 0)

// Fraction of remaining distance below which a building is considered "settled"
const SETTLE_THRESHOLD = 0.015

// Exponential ease-out speed (units/second). Fast enough to finish well within
// the dwell window, slow enough to look like a smooth grow.
const LERP_SPEED = 8

export default function City({
  repoData,
  onFileSelect,
  selectedFile,
  timelapseSnapshot,
  // Playback props — the frame loop drives commit advancing so animation
  // always completes before the next snapshot is applied.
  isPlaying,
  tlSpeed,
  onAdvanceCommit,
}) {
  const { camera, raycaster, mouse } = useThree()
  const [hoveredFile, setHoveredFile] = useState(null)
  const meshesRef        = useRef(new Map())  // Map<path, THREE.Mesh>
  const targetHeightsRef = useRef(new Map())  // Map<path, number>
  const mousePos         = useRef({ x: 0, y: 0 })
  const lastHoveredRef   = useRef(null)
  const previousSelectedRef = useRef(null)

  // How long (seconds) we have been dwelling on the current settled state
  const dwellRef   = useRef(0)
  const settledRef = useRef(true)

  // ── Layout ─────────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map()
    for (const file of repoData.files) {
      const parts = file.path.split('/')
      const group = parts.length > 1 ? parts[0] : 'root'
      if (!map.has(group)) map.set(group, [])
      map.get(group).push(file)
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
  }, [repoData])

  const layout = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(groups.length))
    const spacing = 10
    return groups.map((g, i) => ({
      group: g,
      x: (i % cols) * spacing,
      z: Math.floor(i / cols) * spacing,
    }))
  }, [groups])

  // ── Sync target heights on snapshot change ─────────────────────────────────
  useEffect(() => {
    // Reset dwell so we always animate fully before advancing
    dwellRef.current   = 0
    settledRef.current = false

    if (!timelapseSnapshot) {
      for (const file of repoData.files) {
        targetHeightsRef.current.set(file.path, computeHeight(file.size))
      }
    } else {
      for (const file of repoData.files) {
        const snap = timelapseSnapshot.files.get(file.path)
        targetHeightsRef.current.set(file.path, snap ? computeHeight(snap.size) : 0)
      }
    }
  }, [timelapseSnapshot, repoData])

  // ── Main frame loop: animate buildings + drive playback advance ────────────
  useFrame((_, delta) => {
    // Clamp delta to avoid huge jumps after tab switches
    const dt = Math.min(delta, 0.1)

    let allSettled = true

    for (const [path, mesh] of meshesRef.current) {
      if (!mesh) continue

      const target  = targetHeightsRef.current.get(path)
        ?? computeHeight(repoData.files.find(f => f.path === path)?.size ?? 100)
      const current = mesh.scale.y
      const diff    = target - current

      if (Math.abs(diff) > 0.001) {
        // Exponential ease-out — smooth deceleration as it approaches target
        mesh.scale.y = current + diff * Math.min(1, LERP_SPEED * dt)
        allSettled   = false
      } else if (current !== target) {
        mesh.scale.y = target  // snap the last micro-gap
      }

      // Secondary settle check: fraction of remaining distance
      const remaining = Math.abs(target - mesh.scale.y) / Math.max(0.001, Math.abs(target || 1))
      if (remaining > SETTLE_THRESHOLD) allSettled = false

      // Visibility + shadow in sync
      const isVisible = mesh.scale.y > 0.05
      if (mesh.visible !== isVisible) {
        mesh.visible    = isVisible
        mesh.castShadow = isVisible
      }
    }

    settledRef.current = allSettled

    // ── Playback advance ────────────────────────────────────────────────────
    // Advance only after buildings have settled AND a minimum dwell has passed.
    // dwell = 1s / speed, floored at 0.15s so fast speeds still look smooth.
    if (isPlaying && onAdvanceCommit) {
      const dwellTime = Math.max(0.15, 1 / (tlSpeed ?? 1))
      if (allSettled) {
        dwellRef.current += dt
        if (dwellRef.current >= dwellTime) {
          dwellRef.current = 0
          onAdvanceCommit()
        }
      }
      // Not settled → dwell stays at 0, we wait for animation to finish
    }

    // ── Hover raycasting ────────────────────────────────────────────────────
    if (!raycaster || !camera || meshesRef.current.size === 0) return

    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    raycaster.setFromCamera(mouse, camera)
    raycaster.far = 1000

    const validMeshes = Array.from(meshesRef.current.values()).filter(
      m => m && m.visible && m.parent
    )
    if (!validMeshes.length) return

    const intersects = raycaster.intersectObjects(validMeshes, true)
    let newHoveredPath = null
    for (const hit of intersects) {
      if (hit.object.userData.file) { newHoveredPath = hit.object.userData.file.path; break }
    }

    const oldPath = lastHoveredRef.current?.path
    if (oldPath !== newHoveredPath) {
      if (oldPath && oldPath !== selectedFile?.path) {
        const m = meshesRef.current.get(oldPath)
        if (m?.material) { m.material.emissiveIntensity = 0; m.material.emissive.setHex(0x000000) }
      }
      if (newHoveredPath && newHoveredPath !== selectedFile?.path) {
        const m = meshesRef.current.get(newHoveredPath)
        if (m?.material) {
          m.material.emissiveIntensity = 0.3
          m.material.emissive.setHex(0x00ff88)
          setHoveredFile(m.userData.file)
        }
      } else {
        setHoveredFile(null)
      }
      lastHoveredRef.current = newHoveredPath ? { path: newHoveredPath } : null
    }
  })

  // ── Pointer / click handlers ───────────────────────────────────────────────
  const handlePointerMove = (e) => {
    mousePos.current.x =  (e.clientX / window.innerWidth)  * 2 - 1
    mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1
  }

  const handleClick = (e) => {
    mousePos.current.x =  (e.clientX / window.innerWidth)  * 2 - 1
    mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    raycaster.setFromCamera(mouse, camera)

    const validMeshes = Array.from(meshesRef.current.values()).filter(m => m && m.visible && m.parent)
    if (!validMeshes.length) return

    const intersects = raycaster.intersectObjects(validMeshes, true)
    for (const hit of intersects) {
      if (hit.object.userData.file) {
        const newFile = hit.object.userData.file
        for (const m of meshesRef.current.values()) {
          if (m?.material) { m.material.emissiveIntensity = 0; m.material.emissive.setHex(0x000000) }
        }
        const cm = meshesRef.current.get(newFile.path)
        if (cm?.material) { cm.material.emissiveIntensity = 0.3; cm.material.emissive.setHex(0x00ff88) }
        onFileSelect(newFile)
        previousSelectedRef.current = newFile
        e.stopPropagation()
        break
      }
    }
  }

  // ── Selection highlight ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFile && previousSelectedRef.current) {
      for (const m of meshesRef.current.values()) {
        if (m?.material) { m.material.emissiveIntensity = 0; m.material.emissive.setHex(0x000000) }
      }
      previousSelectedRef.current = null
    }
  }, [selectedFile])

  useEffect(() => {
    if (selectedFile) {
      for (const m of meshesRef.current.values()) {
        if (m?.material) { m.material.emissiveIntensity = 0; m.material.emissive.setHex(0x000000) }
      }
      const sel = meshesRef.current.get(selectedFile.path)
      if (sel?.material) { sel.material.emissiveIntensity = 0.3; sel.material.emissive.setHex(0x00ff88) }
    }
  }, [selectedFile?.path])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    for (const m of meshesRef.current.values()) m?.material?.dispose()
    meshesRef.current.clear()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <group onPointerMove={handlePointerMove} onPointerUp={handleClick}>
      {layout.map((l) =>
        l.group.items.map((f, i) => {
          const perRow = 6
          const rx = (i % perRow) * 1.2 - perRow / 2
          const rz = Math.floor(i / perRow) * 1.2

          const fullHeight   = computeHeight(f.size)
          const { hex }      = getColorForFileType(f.path)
          const baseColor    = new THREE.Color(hex)
          const initialScale = (timelapseSnapshot && !timelapseSnapshot.files.has(f.path))
            ? 0.001
            : fullHeight

          return (
            <mesh
              key={f.path}
              position={[l.x + rx, 0, l.z + rz]}
              scale={[1, initialScale, 1]}
              castShadow={initialScale > 0.05}
              receiveShadow
              ref={(mesh) => {
                if (mesh) {
                  meshesRef.current.set(f.path, mesh)
                  mesh.userData.file      = f
                  mesh.userData.baseColor = baseColor
                  if (initialScale <= 0.05) {
                    mesh.visible    = false
                    mesh.castShadow = false
                  }
                }
              }}
            >
              <primitive object={UNIT_BOX} attach="geometry" />
              <meshStandardMaterial
                color={baseColor}
                metalness={0.3}
                roughness={0.7}
                emissive={new THREE.Color(0x000000)}
                emissiveIntensity={0}
              />
            </mesh>
          )
        })
      )}
    </group>
  )
}
