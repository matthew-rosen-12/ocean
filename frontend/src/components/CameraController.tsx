import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControllerProps {
  targetPosition: THREE.Vector3;
  animalScale: number;
}

export function CameraController({ targetPosition }: CameraControllerProps) {
  const { camera } = useThree();
  const zdistance = 30;

  useEffect(() => {
    camera.position.set(targetPosition.x, targetPosition.y, zdistance);
  }, [camera, targetPosition.x, targetPosition.y, zdistance]);

  return null;
}