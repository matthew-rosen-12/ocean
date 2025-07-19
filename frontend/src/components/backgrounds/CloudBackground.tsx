import React, { useMemo } from "react";
import * as THREE from "three";
import { CLOUD_PLANE_CONFIG } from "../../utils/terrain";
import { canvasCache, backgroundGenerators } from "../../utils/canvas-cache";

export default function CloudBackground() {
  const cloudTexture = useMemo(() => {
    return canvasCache.getOrCreate(
      {
        width: 256,
        height: 256,
        type: 'cloud',
        hash: 'static' // Static cloud pattern - could be made dynamic if needed
      },
      backgroundGenerators.cloud
    );
  }, []);

  return (
    <>
      {/* Cloud plane background - same XY plane as animals, behind terrain pattern */}
      <mesh position={CLOUD_PLANE_CONFIG.position}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial 
          map={cloudTexture}
          transparent 
          opacity={CLOUD_PLANE_CONFIG.opacity}
          depthWrite={false}
          depthTest={true}
        />
      </mesh>
    </>
  );
}
