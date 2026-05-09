import React from 'react'
import { OrbitControls } from '@react-three/drei'

export default function Controls(){
  return <OrbitControls enableDamping target={[0,0,0]} />
}
