import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { TerrainBoundaries } from "../utils/terrain";

extend({ GridHelper: THREE.GridHelper });

interface WaveGridProps {
  boundaries: TerrainBoundaries;
}

export default function WaveGrid({ boundaries }: WaveGridProps) {
  // Use boundaries if provided, otherwise fallback to default
  const size = boundaries.width;
  const divisions = 100;

  return (
    <gridHelper
      args={[size, divisions]}
      position={[0, -2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}
