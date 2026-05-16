import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getDepsForFile } from '../utils/dependencyParser'

// Arc colour palette — outgoing (imports) vs incoming (imported-by)
const COLOR_OUTGOING = new THREE.Color(0x00f2fe)  // cyan
const COLOR_INCOMING = new THREE.Color(0xff6b35)  // orange

// How many segments to use for the tube geometry
const TUBE_SEGMENTS  = 40
const TUBE_RADIUS    = 0.06
const TUBE_RADIAL    = 6

// Bézier arc height as a fraction of the horizontal distance
const ARC_HEIGHT_FACTOR = 0.55

/**
 * Build a QuadraticBezierCurve3 arc between two XZ positions.
 * The control point is lifted above the midpoint so the arc curves up
 * into the sky rather than cutting through buildings.
 */
function makeArcCurve(fromPos, toPos, extraHeight = 0) {
  const mid = new THREE.Vector3(
    (fromPos.x + toPos.x) / 2,
    0,
    (fromPos.z + toPos.z) / 2,
  )
  const dist = fromPos.distanceTo(toPos)
  mid.y = Math.max(6, dist * ARC_HEIGHT_FACTOR) + extraHeight

  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z),
    mid,
    new THREE.Vector3(toPos.x, toPos.y, toPos.z),
  )
}

/**
 * A single animated arc tube.
 * Fades in on mount, fades out when `visible` becomes false.
 */
function Arc({ fromPos, toPos, color, arcIndex }) {
  const meshRef  = useRef(null)
  const alphaRef = useRef(0)
  const targetAlphaRef = useRef(1)

  const geometry = useMemo(() => {
    const curve = makeArcCurve(fromPos, toPos, arcIndex * 0.4)
    return new THREE.TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_RADIAL, false)
  }, [fromPos.x, fromPos.y, fromPos.z, toPos.x, toPos.y, toPos.z, arcIndex])

  // Animate opacity
  useFrame((_, delta) => {
    if (!meshRef.current) return
    const target = targetAlphaRef.current
    alphaRef.current += (target - alphaRef.current) * Math.min(1, 8 * delta)
    meshRef.current.material.opacity = alphaRef.current
    // Pulse emissive intensity slightly for a neon glow effect
    const pulse = 0.6 + Math.sin(Date.now() * 0.003 + arcIndex) * 0.2
    meshRef.current.material.emissiveIntensity = pulse
  })

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * DependencyArcs
 *
 * Props:
 *   depMap          – Map<path, Set<path>>  (importer → imported)
 *   meshesRef       – ref to City's Map<path, THREE.Mesh>
 *   selectedFile    – { path } | null
 *   timelapseSnapshot – current snapshot | null  (used to filter visible files)
 */
export default function DependencyArcs({ depMap, meshesRef, selectedFile, timelapseSnapshot }) {
  // Derive the set of arcs to draw from the selected file
  const arcs = useMemo(() => {
    if (!selectedFile || !depMap) return []
    const meshMap = meshesRef.current?.getMeshes?.()
    if (!meshMap) return []

    const { outgoing, incoming } = getDepsForFile(selectedFile.path, depMap)
    const result = []

    const getPos = (path) => {
      const mesh = meshMap.get(path)
      if (!mesh || !mesh.visible) return null
      const height = mesh.scale.y
      return new THREE.Vector3(mesh.position.x, height, mesh.position.z)
    }

    const fromPos = getPos(selectedFile.path)
    if (!fromPos) return []

    const isVisible = (path) => {
      if (!timelapseSnapshot) return true
      return timelapseSnapshot.files.has(path)
    }

    let idx = 0
    for (const dep of outgoing) {
      if (!isVisible(dep)) continue
      const toPos = getPos(dep)
      if (toPos) {
        result.push({ from: fromPos.clone(), to: toPos, color: COLOR_OUTGOING, key: `out-${dep}`, idx: idx++ })
      }
    }
    for (const dep of incoming) {
      if (!isVisible(dep)) continue
      const toPos = getPos(dep)
      if (toPos) {
        result.push({ from: fromPos.clone(), to: toPos, color: COLOR_INCOMING, key: `in-${dep}`, idx: idx++ })
      }
    }

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path, depMap, timelapseSnapshot])

  if (!arcs.length) return null

  return (
    <group>
      {arcs.map((arc) => (
        <Arc
          key={arc.key}
          fromPos={arc.from}
          toPos={arc.to}
          color={arc.color}
          arcIndex={arc.idx}
        />
      ))}
    </group>
  )
}
