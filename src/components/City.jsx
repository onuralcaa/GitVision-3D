import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getColorForFileType } from '../utils/fileTypeColors'

// Compute the target height for a file given its size in bytes
function computeHeight(sizeBytes) {
  const lines = Math.max(1, Math.round((sizeBytes || 100) / 50))
  return Math.max(0.8, Math.log(lines + 1)) * 1.2
}

export default function City({ repoData, onFileSelect, selectedFile, timelapseSnapshot }) {
  const { camera, raycaster, mouse } = useThree()
  const [hoveredFile, setHoveredFile] = useState(null)
  const meshesRef = useRef(new Map())       // Map<path, THREE.Mesh>
  const targetHeightsRef = useRef(new Map()) // Map<path, number>  — driven by snapshot
  const mousePos = useRef({ x: 0, y: 0 })
  const lastHoveredRef = useRef(null)
  const previousSelectedRef = useRef(null)

  // ── Layout (stable; based on the full file list from repoData) ─────────────
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
    return groups.map((g, i) => {
      const gx = (i % cols) * spacing
      const gz = Math.floor(i / cols) * spacing
      return { group: g, x: gx, z: gz }
    })
  }, [groups])

  // ── Sync target heights whenever the timelapse snapshot changes ────────────
  useEffect(() => {
    if (!timelapseSnapshot) {
      // No timelapse active — use the current repoData sizes for all files
      for (const file of repoData.files) {
        targetHeightsRef.current.set(file.path, computeHeight(file.size))
      }
    } else {
      // Timelapse active — files present in snapshot get their snapshot size;
      // files NOT in snapshot get height 0 (not yet created)
      for (const file of repoData.files) {
        const snap = timelapseSnapshot.files.get(file.path)
        if (snap) {
          targetHeightsRef.current.set(file.path, computeHeight(snap.size))
        } else {
          targetHeightsRef.current.set(file.path, 0)
        }
      }
    }
  }, [timelapseSnapshot, repoData])

  // ── Animate buildings toward their target heights every frame ──────────────
  useFrame((_, delta) => {
    const lerpSpeed = 6 // units per second — controls grow animation speed

    for (const [path, mesh] of meshesRef.current) {
      if (!mesh) continue

      const target = targetHeightsRef.current.get(path) ?? computeHeight(
        repoData.files.find(f => f.path === path)?.size ?? 100
      )

      const currentScaleY = mesh.scale.y
      // scale.y maps 1 → full height; we store full height in userData.baseHeight
      const baseHeight = mesh.userData.baseHeight || 1
      const currentHeight = currentScaleY * baseHeight
      const newHeight = THREE.MathUtils.lerp(currentHeight, target, Math.min(1, lerpSpeed * delta))

      if (Math.abs(newHeight - currentHeight) > 0.001) {
        const scaleY = newHeight / baseHeight
        mesh.scale.y = scaleY
        // Keep the building sitting on the ground: center at height/2
        mesh.position.y = newHeight / 2
      }

      // Show/hide based on whether the building has any height.
      // Also toggle castShadow so hidden buildings don't cast ghost shadows.
      const isVisible = newHeight > 0.05
      mesh.visible = isVisible
      mesh.castShadow = isVisible
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
    if (validMeshes.length === 0) return

    const intersects = raycaster.intersectObjects(validMeshes, true)

    let newHoveredPath = null
    if (intersects.length > 0) {
      for (const hit of intersects) {
        if (hit.object.userData.file) {
          newHoveredPath = hit.object.userData.file.path
          break
        }
      }
    }

    const oldPath = lastHoveredRef.current?.path
    if (oldPath !== newHoveredPath) {
      if (oldPath && oldPath !== selectedFile?.path) {
        const oldMesh = meshesRef.current.get(oldPath)
        if (oldMesh?.material) {
          oldMesh.material.emissiveIntensity = 0
          oldMesh.material.emissive.setHex(0x000000)
        }
      }
      if (newHoveredPath && newHoveredPath !== selectedFile?.path) {
        const newMesh = meshesRef.current.get(newHoveredPath)
        if (newMesh?.material) {
          newMesh.material.emissiveIntensity = 0.3
          newMesh.material.emissive.setHex(0x00ff88)
          setHoveredFile(newMesh.userData.file)
        }
      } else {
        setHoveredFile(null)
      }
      lastHoveredRef.current = newHoveredPath ? { path: newHoveredPath } : null
    }
  })

  // ── Click handler ──────────────────────────────────────────────────────────
  const handlePointerMove = (event) => {
    mousePos.current.x = (event.clientX / window.innerWidth) * 2 - 1
    mousePos.current.y = -(event.clientY / window.innerHeight) * 2 + 1
  }

  const handleClick = (event) => {
    mousePos.current.x = (event.clientX / window.innerWidth) * 2 - 1
    mousePos.current.y = -(event.clientY / window.innerHeight) * 2 + 1

    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    raycaster.setFromCamera(mouse, camera)

    const validMeshes = Array.from(meshesRef.current.values()).filter(
      m => m && m.visible && m.parent
    )
    if (validMeshes.length === 0) return

    const intersects = raycaster.intersectObjects(validMeshes, true)
    if (intersects.length > 0) {
      for (const hit of intersects) {
        const obj = hit.object
        if (obj.userData.file) {
          const newFile = obj.userData.file

          // Reset all highlights
          for (const mesh of meshesRef.current.values()) {
            if (mesh?.material) {
              mesh.material.emissiveIntensity = 0
              mesh.material.emissive.setHex(0x000000)
            }
          }

          // Highlight clicked
          const clickedMesh = meshesRef.current.get(newFile.path)
          if (clickedMesh?.material) {
            clickedMesh.material.emissiveIntensity = 0.3
            clickedMesh.material.emissive.setHex(0x00ff88)
          }

          onFileSelect(newFile)
          previousSelectedRef.current = newFile
          event.stopPropagation()
          break
        }
      }
    }
  }

  // ── Selection highlight effects ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFile && previousSelectedRef.current) {
      for (const mesh of meshesRef.current.values()) {
        if (mesh?.material) {
          mesh.material.emissiveIntensity = 0
          mesh.material.emissive.setHex(0x000000)
        }
      }
      previousSelectedRef.current = null
    }
  }, [selectedFile])

  useEffect(() => {
    if (selectedFile) {
      for (const mesh of meshesRef.current.values()) {
        if (mesh?.material) {
          mesh.material.emissiveIntensity = 0
          mesh.material.emissive.setHex(0x000000)
        }
      }
      const sel = meshesRef.current.get(selectedFile.path)
      if (sel?.material) {
        sel.material.emissiveIntensity = 0.3
        sel.material.emissive.setHex(0x00ff88)
      }
    }
  }, [selectedFile?.path])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      for (const mesh of meshesRef.current.values()) {
        mesh?.material?.dispose()
      }
      meshesRef.current.clear()
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <group onPointerMove={handlePointerMove} onPointerUp={handleClick}>
      {layout.map((l) =>
        l.group.items.map((f, i) => {
          const perRow = 6
          const rx = (i % perRow) * 1.2 - perRow / 2
          const rz = Math.floor(i / perRow) * 1.2

          // Full (final) height — used as the geometry height and stored in userData
          const fullHeight = computeHeight(f.size)

          const { hex } = getColorForFileType(f.path)
          const baseColor = new THREE.Color(hex)

          return (
            <mesh
              key={f.path}
              position={[l.x + rx, fullHeight / 2, l.z + rz]}
              castShadow
              receiveShadow
              ref={(mesh) => {
                if (mesh) {
                  meshesRef.current.set(f.path, mesh)
                  mesh.userData.file = f
                  mesh.userData.baseColor = baseColor
                  // Store the geometry height so the animation loop can scale correctly
                  mesh.userData.baseHeight = fullHeight

                  // If timelapse is active on mount, start invisible and non-shadow-casting
                  if (timelapseSnapshot && !timelapseSnapshot.files.has(f.path)) {
                    mesh.scale.y = 0.001
                    mesh.position.y = 0
                    mesh.visible = false
                    mesh.castShadow = false
                  }
                }
              }}
            >
              <boxGeometry args={[1.0, fullHeight, 1.0]} />
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
