import { extend } from "@react-three/fiber";
import * as THREE from "three";
extend({ GridHelper: THREE.GridHelper });

export default function WaveGrid() {
  const size = 100;
  const divisions = 100;

  return (
    <gridHelper
      args={[size, divisions]}
      position={[0, -2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}
