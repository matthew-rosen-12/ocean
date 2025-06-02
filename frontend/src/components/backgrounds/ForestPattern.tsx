import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface ForestPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
}

export default function ForestPattern({
  boundaries,
  seed,
}: ForestPatternProps) {
  const createForestTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - forest floor
    ctx.fillStyle = "#3A5F3A";
    ctx.fillRect(0, 0, 256, 256);

    // Function to generate multiple random numbers from one seed
    const multiRandom = (seed: number) => {
      const rand1 = (Math.sin(seed * 12.9898) * 43758.5453123) % 1;
      const rand2 = (Math.sin(seed * 78.233) * 43758.5453123) % 1;
      const rand3 = (Math.sin(seed * 37.719) * 43758.5453123) % 1;
      const rand4 = (Math.sin(seed * 93.989) * 43758.5453123) % 1;
      const rand5 = (Math.sin(seed * 17.951) * 43758.5453123) % 1;

      return {
        x: Math.abs(rand1),
        y: Math.abs(rand2),
        size: Math.abs(rand3),
        color: Math.abs(rand4),
        extra: Math.abs(rand5),
      };
    };

    // Draw tileable trees
    const treeColors = ["#228B22", "#32CD32", "#006400", "#2E8B57"];
    const treeSpacing = 40; // Distance between tree centers

    // Create a tileable grid that wraps at edges
    for (let x = 0; x < 256 + treeSpacing; x += treeSpacing) {
      for (let y = 0; y < 256 + treeSpacing; y += treeSpacing) {
        const treeSeed = seed + (x / treeSpacing) * 1000 + y / treeSpacing;
        const random = multiRandom(treeSeed);
        const random2 = multiRandom(treeSeed + 1); // For second crown color

        // Random offset for natural look (but deterministic for tiling)
        const offsetX = (random.x - 0.5) * treeSpacing * 0.6;
        const offsetY = (random.y - 0.5) * treeSpacing * 0.6;

        const treeX = (x + offsetX) % 256;
        const treeY = (y + offsetY) % 256;
        const size = 15 + random.size * 20;

        // Draw tree trunk
        ctx.fillStyle = "#8B4513";
        const trunkWidth = 4;
        const trunkHeight = size * 0.4;

        ctx.fillRect(
          treeX - trunkWidth / 2,
          treeY + size * 0.6,
          trunkWidth,
          trunkHeight
        );

        // Handle wrapping for trunk
        if (treeX < trunkWidth / 2) {
          ctx.fillRect(
            treeX + 256 - trunkWidth / 2,
            treeY + size * 0.6,
            trunkWidth,
            trunkHeight
          );
        }
        if (treeX > 256 - trunkWidth / 2) {
          ctx.fillRect(
            treeX - 256 - trunkWidth / 2,
            treeY + size * 0.6,
            trunkWidth,
            trunkHeight
          );
        }

        // Draw tree crown (triangle)
        const colorIndex = Math.floor(random.color * treeColors.length);
        ctx.fillStyle = treeColors[colorIndex];

        // Main crown
        ctx.beginPath();
        ctx.moveTo(treeX, treeY);
        ctx.lineTo(treeX - size * 0.6, treeY + size);
        ctx.lineTo(treeX + size * 0.6, treeY + size);
        ctx.closePath();
        ctx.fill();

        // Handle wrapping for crown
        if (treeX - size * 0.6 < 0) {
          ctx.beginPath();
          ctx.moveTo(treeX + 256, treeY);
          ctx.lineTo(treeX + 256 - size * 0.6, treeY + size);
          ctx.lineTo(treeX + 256 + size * 0.6, treeY + size);
          ctx.closePath();
          ctx.fill();
        }
        if (treeX + size * 0.6 > 256) {
          ctx.beginPath();
          ctx.moveTo(treeX - 256, treeY);
          ctx.lineTo(treeX - 256 - size * 0.6, treeY + size);
          ctx.lineTo(treeX - 256 + size * 0.6, treeY + size);
          ctx.closePath();
          ctx.fill();
        }

        // Add smaller triangle for depth
        const secondColorIndex = Math.floor(random2.color * treeColors.length);
        ctx.fillStyle = treeColors[secondColorIndex];

        ctx.beginPath();
        ctx.moveTo(treeX, treeY + size * 0.3);
        ctx.lineTo(treeX - size * 0.4, treeY + size * 0.8);
        ctx.lineTo(treeX + size * 0.4, treeY + size * 0.8);
        ctx.closePath();
        ctx.fill();

        // Handle wrapping for second crown
        if (treeX - size * 0.4 < 0) {
          ctx.beginPath();
          ctx.moveTo(treeX + 256, treeY + size * 0.3);
          ctx.lineTo(treeX + 256 - size * 0.4, treeY + size * 0.8);
          ctx.lineTo(treeX + 256 + size * 0.4, treeY + size * 0.8);
          ctx.closePath();
          ctx.fill();
        }
        if (treeX + size * 0.4 > 256) {
          ctx.beginPath();
          ctx.moveTo(treeX - 256, treeY + size * 0.3);
          ctx.lineTo(treeX - 256 - size * 0.4, treeY + size * 0.8);
          ctx.lineTo(treeX - 256 + size * 0.4, treeY + size * 0.8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Add tileable forest undergrowth
    ctx.fillStyle = "#556B2F";
    for (let i = 0; i < 40; i++) {
      const baseIndex = i * 100 + 5000; // Offset to avoid collision with tree indices
      const x = multiRandom(baseIndex).x * 256;
      const y = multiRandom(baseIndex).y * 256;
      const size = 3 + multiRandom(baseIndex).extra * 6;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Handle wrapping for undergrowth
      if (x < size) {
        ctx.beginPath();
        ctx.arc(x + 256, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (x > 256 - size) {
        ctx.beginPath();
        ctx.arc(x - 256, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (y < size) {
        ctx.beginPath();
        ctx.arc(x, y + 256, size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (y > 256 - size) {
        ctx.beginPath();
        ctx.arc(x, y - 256, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  };

  // Calculate repeat based on desired tile size and boundary dimensions
  const desiredTileSize = 18; // World units per tile
  const repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
  const repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createForestTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(repeatX, repeatY)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
