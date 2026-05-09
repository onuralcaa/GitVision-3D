import React, { useMemo, useState, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function City({ repoData, onFileSelect }){
  const { camera, raycaster, mouse } = useThree()
  const now = Date.now()
  const [hoveredFile, setHoveredFile] = useState(null)
  const meshesRef = useRef([])

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
    if (!raycaster || !camera) return
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(meshesRef.current)
    
    if (intersects.length > 0) {
      const closest = intersects[0]
      const fileData = closest.object.userData.file
      if (fileData) {
        setHoveredFile(fileData)
        onFileSelect(fileData)
      }
    }
  }

  const handlePointerLeave = () => {
    setHoveredFile(null)
    onFileSelect(null)
  }

  const isFileHovered = (filePath) => hoveredFile?.path === filePath

  return (
    <group 
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {layout.map((l, gi)=>{
        return l.group.items.map((f, i)=>{
          const perRow = 6
          const rx = (i % perRow) * 1.2 - (perRow/2)
          const rz = Math.floor(i/perRow) * 1.2
          const lines = f.lines || Math.max(1, Math.round((f.size||100)/50))
          const height = Math.max(0.2, Math.log(lines + 1)) * 1.2
          const ageDays = f.lastCommitDate ? (now - new Date(f.lastCommitDate).getTime()) / (1000*60*60*24) : 365
          const t = Math.min(1, ageDays/365)
          
          let color = new THREE.Color().setHSL(0.12*(1-t), 0.8*(1-t)+0.1, 0.5*(1-t)+0.2)
          
          if (isFileHovered(f.path)) {
            color.multiplyScalar(1.3)
          }
          
          return (
            <mesh 
              key={f.path} 
              position={[l.x + rx, height/2, l.z + rz]}
              ref={(mesh) => {
                if (mesh && !meshesRef.current.includes(mesh)) {
                  meshesRef.current.push(mesh)
                  mesh.userData.file = f
                }
              }}
            >
              <boxGeometry args={[0.9, height, 0.9]} />
              <meshStandardMaterial 
                color={color} 
                metalness={isFileHovered(f.path) ? 0.8 : 0.3} 
                roughness={isFileHovered(f.path) ? 0.2 : t}
                emissive={isFileHovered(f.path) ? new THREE.Color(0x00ff88) : new THREE.Color(0x000000)}
                emissiveIntensity={isFileHovered(f.path) ? 0.3 : 0}
              />
            </mesh>
          )
        })
      })}
    </group>
  )
}
