import React, { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Simple layout: group by top-level folder
export default function City({ repoData }){
  const { viewport } = useThree()
  const now = Date.now()

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

  // compute positions
  const layout = useMemo(()=>{
    const cols = Math.ceil(Math.sqrt(groups.length))
    const spacing = 10
    return groups.map((g, i)=>{
      const gx = (i % cols) * spacing
      const gz = Math.floor(i/cols) * spacing
      return { group: g, x: gx, z: gz }
    })
  },[groups])

  return (
    <group>
      {/* Ground planes for groups */}
      {layout.map((l, idx)=> (
        <mesh key={idx} position={[l.x, -0.01, l.z]} rotation-x={-Math.PI/2}>
          <planeGeometry args={[8,8]} />
          <meshStandardMaterial color={new THREE.Color(0x222222)} />
        </mesh>
      ))}

      {/* Files as boxes */}
      {layout.map((l, gi)=>{
        return l.group.items.map((f, i)=>{
          const perRow = 6
          const rx = (i % perRow) * 1.2 - (perRow/2)
          const rz = Math.floor(i/perRow) * 1.2
          const lines = f.lines || Math.max(1, Math.round((f.size||100)/50))
          const height = Math.max(0.2, Math.log(lines + 1)) * 1.2
          const ageDays = f.lastCommitDate ? (now - new Date(f.lastCommitDate).getTime()) / (1000*60*60*24) : 365
          const t = Math.min(1, ageDays/365)
          const color = new THREE.Color().setHSL(0.12*(1-t), 0.8*(1-t)+0.1, 0.5*(1-t)+0.2)
          return (
            <mesh key={f.path} position={[l.x + rx, height/2, l.z + rz]}>
              <boxGeometry args={[0.9, height, 0.9]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={t} />
            </mesh>
          )
        })
      })}
    </group>
  )
}
