import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getColorForFileType } from '../utils/fileTypeColors'

export default function City({ repoData, onFileSelect, selectedFile }){
  const { camera, raycaster, mouse } = useThree()
  const now = Date.now()
  const [hoveredFile, setHoveredFile] = useState(null)
  const meshesRef = useRef(new Map()) // Use Map for better mesh tracking
  const mousePos = useRef({ x: 0, y: 0 })
  const lastHoveredRef = useRef(null)
  const previousSelectedRef = useRef(null) // Track previously selected file

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

  const handleClick = (event) => {
    mousePos.current.x = (event.clientX / window.innerWidth) * 2 - 1
    mousePos.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    
    raycaster.setFromCamera(mouse, camera)
    
    const validMeshes = Array.from(meshesRef.current.values()).filter(m => m && m.visible && m.parent)
    if (validMeshes.length === 0) return
    
    const intersects = raycaster.intersectObjects(validMeshes, true)
    
    if (intersects.length > 0) {
      for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object
        if (obj.userData.file) {
          const newFile = obj.userData.file
          console.log('🔷 CLICKED:', newFile.path)
          console.log('   Mesh object ID:', obj.id, 'Distance:', intersects[i].distance)
          
          // First, remove highlights from ALL meshes
          const allMeshes = Array.from(meshesRef.current.values())
          console.log('📦 Total meshes in map:', allMeshes.length)
          console.log('   Map keys:', Array.from(meshesRef.current.keys()))
          
          let resetCount = 0
          allMeshes.forEach((mesh) => {
            if (mesh?.material) {
              const path = mesh.userData.file?.path || 'unknown'
              const objId = mesh.id
              const isCurrentObj = (obj.id === objId)
              console.log(`  ↻ [${isCurrentObj ? '!' : ' '}] Reset ${path} (obj.id: ${objId})`)
              
              mesh.material.emissiveIntensity = 0
              mesh.material.emissive.setHex(0x000000)
              resetCount++
            }
          })
          console.log(`   Reset ${resetCount} meshes`)
          
          // Then highlight only the clicked mesh
          const newMesh = meshesRef.current.get(newFile.path)
          if (newMesh?.material) {
            console.log(`  ✨ Highlighting: ${newFile.path} (obj.id: ${newMesh.id})`)
            newMesh.material.emissiveIntensity = 0.3
            newMesh.material.emissive.setHex(0x00ff88)
          } else {
            console.log(`  ⚠️  Could not find mesh for ${newFile.path} in map!`)
          }
          
          // Set selection
          onFileSelect(newFile)
          previousSelectedRef.current = newFile
          event.stopPropagation()
          break
        }
      }
    }
  }

  useFrame(() => {
    // ONLY handle hover for visual feedback (temp green glow)
    // Do NOT touch selected mesh here - it's handled by useEffect below
    
    if (!raycaster || !camera || meshesRef.current.size === 0) return
    
    mouse.x = mousePos.current.x
    mouse.y = mousePos.current.y
    
    raycaster.setFromCamera(mouse, camera)
    raycaster.far = 1000
    
    const validMeshes = Array.from(meshesRef.current.values()).filter(m => m && m.visible && m.parent)
    if (validMeshes.length === 0) return
    
    const intersects = raycaster.intersectObjects(validMeshes, true)
    
    let newHoveredPath = null
    if (intersects.length > 0) {
      for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object
        if (obj.userData.file) {
          newHoveredPath = obj.userData.file.path
          break
        }
      }
    }
    
    // Update hover materials ONLY if NOT selected
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

  // Handle when info panel is closed
  useEffect(() => {
    if (!selectedFile && previousSelectedRef.current) {
      // Remove highlights from ALL meshes
      Array.from(meshesRef.current.values()).forEach((mesh) => {
        if (mesh?.material) {
          mesh.material.emissiveIntensity = 0
          mesh.material.emissive.setHex(0x000000)
        }
      })
      previousSelectedRef.current = null
    }
  }, [selectedFile])

  // Handle when file is selected - highlight it
  useEffect(() => {
    if (selectedFile) {
      // First, reset all meshes to normal
      Array.from(meshesRef.current.values()).forEach((mesh) => {
        if (mesh?.material) {
          mesh.material.emissiveIntensity = 0
          mesh.material.emissive.setHex(0x000000)
        }
      })
      
      // Then highlight only the selected mesh
      const selectedMesh = meshesRef.current.get(selectedFile.path)
      if (selectedMesh?.material) {
        console.log('✅ SELECTED FILE CHANGED: Highlighting', selectedFile.path)
        selectedMesh.material.emissiveIntensity = 0.3
        selectedMesh.material.emissive.setHex(0x00ff88)
      }
    }
  }, [selectedFile?.path])  // Use path as key to avoid infinite loops

  const isFileHovered = (filePath) => hoveredFile?.path === filePath

  // Clean up materials on cleanup
  useEffect(() => {
    return () => {
      Array.from(meshesRef.current.values()).forEach((mesh) => {
        if (mesh?.material) {
          mesh.material.dispose()
        }
      })
      meshesRef.current.clear()
    }
  }, [])

  return (
    <group 
      onPointerMove={handlePointerMove}
      onPointerUp={handleClick}
    >
      {layout.map((l, gi)=>{
        return l.group.items.map((f, i)=>{
          const perRow = 6
          const rx = (i % perRow) * 1.2 - (perRow/2)
          const rz = Math.floor(i/perRow) * 1.2
          const lines = f.lines || Math.max(1, Math.round((f.size||100)/50))
          // Ensure minimum height to make all buildings clickable
          const height = Math.max(0.8, Math.log(lines + 1)) * 1.2
          
          // Get color based on file type
          const { hex } = getColorForFileType(f.path)
          const baseColor = new THREE.Color(hex)
          
          return (
            <mesh 
              key={f.path} 
              position={[l.x + rx, height/2, l.z + rz]}
              castShadow
              receiveShadow
              ref={(mesh) => {
                if (mesh) {
                  meshesRef.current.set(f.path, mesh)
                  mesh.userData.file = f
                  // Store base color for later use
                  mesh.userData.baseColor = baseColor
                }
              }}
            >
              <boxGeometry args={[1.0, height, 1.0]} />
              <meshStandardMaterial 
                color={baseColor}
                metalness={0.3}
                roughness={0.7}
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
