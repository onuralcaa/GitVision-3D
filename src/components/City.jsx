import React, { useMemo, useState, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function City({ repoData, onFileSelect }){
  const { camera, raycaster, mouse } = useThree()
  const now = Date.now()
  const [hoveredFile, setHoveredFile] = useState(null)
  const meshesRef = useRef(new Map()) // Use Map for better mesh tracking
  const mousePos = useRef({ x: 0, y: 0 })
  const lastHoveredRef = useRef(null)

  const groups = useMemo(()=>{
    const map = new Map()
    for(const file of repoData.files){
      const parts = file.path.split('/')
      const group = parts.length>1 ? parts[0] : 'root'
      if(!map.has(group)) map.set(group, [])
      map.get(group).push(file)
    }
    return Array.from(map.entries()).map(([name, items])=>({name, items}))
  },[repoData])

  const layout = useMemo(()=>{
    const cols = Math.ceil(Math.sqrt(groups.length))
    const spacing = 10
    return groups.map((g, i)=>{
      const gx = (i % cols) * spacing
      const gz = Math.floor(i/cols) * spacing
      return { group: g, x: gx, z: gz }
    })
  },[groups])

  const handlePointerMove = (event) => {
    mousePos.current.x = (event.clientX / window.innerWidth) * 2 - 1
    mousePos.current.y = -(event.clientY / window.innerHeight) * 2 + 1
  }

  useFrame(() => {
    if (!raycaster || !camera || meshesRef.current.size === 0) return
    
    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    
    raycaster.setFromCamera(mouse, camera)
    
    // Ensure raycaster covers entire scene
    raycaster.far = 1000
    
    // Get all valid meshes from the map
    const validMeshes = Array.from(meshesRef.current.values()).filter(m => m && m.visible && m.parent)
    if (validMeshes.length === 0) return
    
    // Intersect with all meshes recursively
    const intersects = raycaster.intersectObjects(validMeshes, true)
    
    let newHoveredPath = null
    
    if (intersects.length > 0) {
      // Find the first valid intersection (closest to camera)
      for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object
        if (obj.userData.file) {
          newHoveredPath = obj.userData.file.path
          break
        }
      }
    }
    
    // Update materials directly without triggering React re-renders
    const oldPath = lastHoveredRef.current?.path
    if (oldPath !== newHoveredPath) {
      // Remove hover effect from old mesh
      if (oldPath) {
        const oldMesh = meshesRef.current.get(oldPath)
        if (oldMesh?.material) {
          oldMesh.material.metalness = 0.3
          oldMesh.material.roughness = oldMesh.userData.roughness || 0.6
          oldMesh.material.emissiveIntensity = 0
          oldMesh.material.emissive.setHex(0x000000)
        }
      }
      
      // Add hover effect to new mesh
      if (newHoveredPath) {
        const newMesh = meshesRef.current.get(newHoveredPath)
        if (newMesh?.material) {
          newMesh.material.metalness = 0.8
          newMesh.material.roughness = 0.2
          newMesh.material.emissiveIntensity = 0.3
          newMesh.material.emissive.setHex(0x00ff88)
          
          // Only update React state for info panel
          const fileData = newMesh.userData.file
          setHoveredFile(fileData)
          onFileSelect(fileData)
        }
      } else {
        setHoveredFile(null)
        onFileSelect(null)
      }
      
      // Update reference
      lastHoveredRef.current = newHoveredPath ? { path: newHoveredPath } : null
    }
  })

  const isFileHovered = (filePath) => hoveredFile?.path === filePath

  return (
    <group 
      onPointerMove={handlePointerMove}
    >
      {layout.map((l, gi)=>{
        return l.group.items.map((f, i)=>{
          const perRow = 6
          const rx = (i % perRow) * 1.2 - (perRow/2)
          const rz = Math.floor(i/perRow) * 1.2
          const lines = f.lines || Math.max(1, Math.round((f.size||100)/50))
          // Ensure minimum height to make all buildings clickable
          const height = Math.max(0.8, Math.log(lines + 1)) * 1.2
          const ageDays = f.lastCommitDate ? (now - new Date(f.lastCommitDate).getTime()) / (1000*60*60*24) : 365
          const t = Math.min(1, ageDays/365)
          
          // Base color - aged files get yellow, newer get orange-red
          const baseColor = new THREE.Color().setHSL(0.12*(1-t), 0.8*(1-t)+0.1, 0.5*(1-t)+0.2)
          
          return (
            <mesh 
              key={f.path} 
              position={[l.x + rx, height/2, l.z + rz]}
              ref={(mesh) => {
                if (mesh) {
                  meshesRef.current.set(f.path, mesh)
                  mesh.userData.file = f
                  // Store roughness for later use
                  mesh.userData.roughness = t
                }
              }}
            >
              <boxGeometry args={[1.0, height, 1.0]} />
              <meshStandardMaterial 
                color={baseColor}
                metalness={0.3}
                roughness={t}
                emissive={0x000000}
                emissiveIntensity={0}
              />
            </mesh>
          )
        })
      })}
    </group>
  )
}
