import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface ForestPatternProps {
  boundaries: TerrainBoundaries;
}

export default function ForestPattern({ boundaries }: ForestPatternProps) {
  const createForestTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - forest floor
    ctx.fillStyle = "#3A5F3A";
    ctx.fillRect(0, 0, 256, 256);

    // Draw trees
    const treeColors = ["#228B22", "#32CD32", "#006400", "#2E8B57"];

    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = 15 + Math.random() * 20;

      // Draw tree trunk
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(x - 2, y + size * 0.6, 4, size * 0.4);

      // Draw tree crown (triangle)
      ctx.fillStyle = treeColors[Math.floor(Math.random() * treeColors.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * 0.6, y + size);
      ctx.lineTo(x + size * 0.6, y + size);
      ctx.closePath();
      ctx.fill();

      // Add smaller triangle for depth
      ctx.fillStyle = treeColors[Math.floor(Math.random() * treeColors.length)];
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.3);
      ctx.lineTo(x - size * 0.4, y + size * 0.8);
      ctx.lineTo(x + size * 0.4, y + size * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    // Add forest undergrowth
    ctx.fillStyle = "#556B2F";
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = 3 + Math.random() * 6;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  };

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createForestTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(3, 3)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
