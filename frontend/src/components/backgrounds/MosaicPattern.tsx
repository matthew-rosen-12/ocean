import React from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";

interface MosaicPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
  usePngFile?: string; // Optional: use static PNG instead of generated pattern
}

export default function MosaicPattern({
  boundaries,
  seed,
  usePngFile,
}: MosaicPatternProps) {
  // Load PNG texture if specified
  const pngTexture = usePngFile
    ? useLoader(THREE.TextureLoader, usePngFile)
    : null;

  // Configure PNG texture if loaded
  if (pngTexture) {
    pngTexture.wrapS = THREE.RepeatWrapping;
    pngTexture.wrapT = THREE.RepeatWrapping;
  }

  const createMosaicTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base background color (light grout)
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(0, 0, 256, 256);

    // Mosaic tile colors with 0.6 transparency
    const tileColors = [
      "rgba(70, 130, 180, 0.6)", // Steel blue
      "rgba(205, 133, 63, 0.6)", // Peru
      "rgba(139, 69, 19, 0.6)", // Saddle brown
      "rgba(85, 107, 47, 0.6)", // Dark olive green
      "rgba(128, 0, 128, 0.6)", // Purple
      "rgba(165, 42, 42, 0.6)", // Brown
      "rgba(47, 79, 79, 0.6)", // Dark slate gray
      "rgba(184, 134, 11, 0.6)", // Dark goldenrod
    ];

    // Large equilateral triangles in rows
    const triangleSize = 120; // Much larger triangles
    const triangleHeight = (triangleSize * Math.sqrt(3)) / 2;
    
    const trianglesPerRow = Math.ceil(canvas.width / triangleSize) + 1;
    const numRows = Math.ceil(canvas.height / triangleHeight) + 1;

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < trianglesPerRow; col++) {
        const x = col * triangleSize;
        const y = row * triangleHeight;
        
        // Generate unique color for each triangle
        const tileSeed = seed + row * 1000 + col * 100;
        const random = multiRandom(tileSeed);
        const colorIndex = Math.floor(random.color * tileColors.length);
        
        ctx.fillStyle = tileColors[colorIndex];
        ctx.beginPath();
        
        if (row % 2 === 0) {
          // Even rows: triangles pointing up
          ctx.moveTo(x + triangleSize / 2, y); // Top point
          ctx.lineTo(x, y + triangleHeight); // Bottom left
          ctx.lineTo(x + triangleSize, y + triangleHeight); // Bottom right
        } else {
          // Odd rows: triangles pointing down (flipped on x-axis)
          ctx.moveTo(x + triangleSize / 2, y + triangleHeight); // Bottom point
          ctx.lineTo(x, y); // Top left
          ctx.lineTo(x + triangleSize, y); // Top right
        }
        
        ctx.closePath();
        ctx.fill();
      }
    }

    return canvas;
  };

  // Utility function to download current pattern as PNG
  const downloadPattern = () => {
    const canvas = createMosaicTexture();
    const link = document.createElement("a");
    link.download = `mosaic-pattern-${seed}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Add to window for debugging (remove in production)
  if (typeof window !== "undefined") {
    (window as any).downloadMosaicPattern = downloadPattern;
  }

  // Calculate repeat based on desired tile size
  const desiredTileSize = 15; // World units per tile
  const repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
  const repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial
        transparent
        opacity={TERRAIN_PLANE_CONFIG.opacity}
        map={pngTexture || undefined}
      >
        {!usePngFile && (
          <canvasTexture
            attach="map"
            image={createMosaicTexture()}
            wrapS={THREE.RepeatWrapping}
            wrapT={THREE.RepeatWrapping}
            repeat={new THREE.Vector2(repeatX, repeatY)}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}