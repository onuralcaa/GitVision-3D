import React, { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

export default function Controls(){
  const { camera, gl } = useThree()
  const controlsRef = useRef(null)
  
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const canvas = gl.domElement
    
    if (isMobile && controlsRef.current) {
      // Mobile optimizations
      controlsRef.current.enableDamping = true
      controlsRef.current.dampingFactor = 0.08
      controlsRef.current.enableZoom = true
      controlsRef.current.zoomSpeed = 1.5
      controlsRef.current.enableRotate = true
      controlsRef.current.rotateSpeed = 1.2
      controlsRef.current.enablePan = true
      controlsRef.current.panSpeed = 0.8
      controlsRef.current.autoRotateSpeed = 0
      // Prevent going below ground on mobile too
      controlsRef.current.minPolarAngle = 0.08
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.05
      controlsRef.current.minDistance = 5
      controlsRef.current.maxDistance = 300
      
      // Touch-specific handling
      let lastTouchDistance = 0
      
      const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
          const touch1 = e.touches[0]
          const touch2 = e.touches[1]
          lastTouchDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
          )
        }
      }
      
      const handleTouchMove = (e) => {
        if (e.touches.length === 2) {
          const touch1 = e.touches[0]
          const touch2 = e.touches[1]
          const distance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
          )
          
          if (lastTouchDistance > 0) {
            const scale = distance / lastTouchDistance
            const zoomDelta = (1 - scale) * 0.5
            camera.position.multiplyScalar(1 + zoomDelta)
            controlsRef.current?.update()
          }
          lastTouchDistance = distance
        }
      }
      
      const handleTouchEnd = () => {
        lastTouchDistance = 0
      }
      
      canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
      canvas.addEventListener('touchmove', handleTouchMove, { passive: true })
      canvas.addEventListener('touchend', handleTouchEnd, { passive: true })
      
      return () => {
        canvas.removeEventListener('touchstart', handleTouchStart)
        canvas.removeEventListener('touchmove', handleTouchMove)
        canvas.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [gl, camera])
  
  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      target={[0, 0, 0]}
      dampingFactor={0.05}
      enableZoom={true}
      zoomSpeed={1.0}
      enableRotate={true}
      rotateSpeed={0.8}
      enablePan={true}
      panSpeed={0.5}
      // Prevent camera from going below the ground plane.
      // maxPolarAngle: just under 90° (π/2) keeps the horizon as the lowest view.
      // minPolarAngle: 5° so the camera can't flip to a pure top-down lock.
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI / 2 - 0.05}
      // Prevent zooming so close that the camera clips through the ground.
      minDistance={5}
      maxDistance={300}
    />
  )
}
