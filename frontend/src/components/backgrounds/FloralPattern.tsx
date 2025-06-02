import React from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";

interface FloralPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
  usePngFile?: string; // Optional: use static PNG instead of generated pattern
}

export default function FloralPattern({
  boundaries,
  seed,
  usePngFile,
}: FloralPatternProps) {
  // Load PNG texture if specified
  const pngTexture = usePngFile
    ? useLoader(THREE.TextureLoader, usePngFile)
    : null;

  // Configure PNG texture if loaded
  if (pngTexture) {
    pngTexture.wrapS = THREE.RepeatWrapping;
    pngTexture.wrapT = THREE.RepeatWrapping;
    const desiredTileSize = 20;
    const repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
    const repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));
    pngTexture.repeat.set(repeatX, repeatY);
  }

  const createFloralTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - mid-century modern cream
    ctx.fillStyle = "#F5F2E8";
    ctx.fillRect(0, 0, 256, 256);

    // Mid-century modern color palette
    const flowerColors = [
      "#E67E22", // Burnt orange
      "#F39C12", // Mustard yellow
      "#27AE60", // Retro green
      "#2C3E50", // Deep blue-gray
      "#8E44AD", // Retro purple
      "#E74C3C", // Coral red
    ];

    const accentColors = [
      "#D35400", // Dark orange
      "#F1C40F", // Bright yellow
      "#16A085", // Teal
      "#34495E", // Slate
    ];

    const spacing = 40; // Distance between flower centers

    // Create a tileable grid that wraps at edges
    for (let x = 0; x < 256 + spacing; x += spacing) {
      for (let y = 0; y < 256 + spacing; y += spacing) {
        // Generate one seed per flower position
        const flowerSeed = seed + (x / spacing) * 1000 + y / spacing;
        const random = multiRandom(flowerSeed);

        // Random offset for natural look (but deterministic for tiling)
        const offsetX = (random.x - 0.5) * spacing * 0.5;
        const offsetY = (random.y - 0.5) * spacing * 0.5;

        const centerX = (x + offsetX) % 256;
        const centerY = (y + offsetY) % 256;

        // Choose flower type based on random value
        const flowerType = Math.floor(random.extra * 3);
        const mainColor =
          flowerColors[Math.floor(random.color * flowerColors.length)];
        const accentColor =
          accentColors[Math.floor(random.size * accentColors.length)];

        switch (flowerType) {
          case 0: // Atomic starburst flower
            // Outer starburst petals
            ctx.fillStyle = mainColor;
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI * 2) / 8;
              const petalX = centerX + Math.cos(angle) * 12;
              const petalY = centerY + Math.sin(angle) * 12;

              ctx.beginPath();
              ctx.ellipse(petalX, petalY, 3, 8, angle, 0, Math.PI * 2);
              ctx.fill();
            }

            // Inner circle
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            ctx.fill();

            // Center dot
            ctx.fillStyle = "#2C3E50";
            ctx.beginPath();
            ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 1: // Geometric daisy
            // Triangular petals in a circle
            ctx.fillStyle = mainColor;
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI * 2) / 6;
              const petalX = centerX + Math.cos(angle) * 10;
              const petalY = centerY + Math.sin(angle) * 10;

              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.lineTo(petalX - 3, petalY);
              ctx.lineTo(petalX + 3, petalY);
              ctx.closePath();
              ctx.fill();
            }

            // Center circle
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
            ctx.fill();
            break;

          case 2: // Mod circles flower
            // Three overlapping circles
            const circleSize = 6;
            const positions = [
              { x: centerX - 4, y: centerY - 2 },
              { x: centerX + 4, y: centerY - 2 },
              { x: centerX, y: centerY + 4 },
            ];

            ctx.fillStyle = mainColor;
            positions.forEach((pos) => {
              ctx.beginPath();
              ctx.arc(pos.x, pos.y, circleSize, 0, Math.PI * 2);
              ctx.fill();
            });

            // Center accent
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            ctx.fill();
            break;
        }

        // Add small geometric leaves
        if (random.extra > 0.6) {
          ctx.fillStyle = "#27AE60";
          const leafAngle = random.color * Math.PI * 2;
          const leafX = centerX + Math.cos(leafAngle) * 16;
          const leafY = centerY + Math.sin(leafAngle) * 16;

          // Diamond-shaped leaf
          ctx.beginPath();
          ctx.moveTo(leafX, leafY - 4);
          ctx.lineTo(leafX + 2, leafY);
          ctx.lineTo(leafX, leafY + 4);
          ctx.lineTo(leafX - 2, leafY);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Add some atomic age background dots
    ctx.fillStyle = "rgba(52, 73, 94, 0.1)";
    for (let i = 0; i < 20; i++) {
      const dotSeed = seed + i * 500 + 10000;
      const random = multiRandom(dotSeed);

      const x = random.x * 256;
      const y = random.y * 256;
      const size = 1 + random.size * 3;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  };

  // Utility function to download current pattern as PNG
  const downloadPattern = () => {
    const canvas = createFloralTexture();
    const link = document.createElement("a");
    link.download = `midcentury-floral-${seed}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Add to window for debugging (remove in production)
  if (typeof window !== "undefined") {
    (window as any).downloadFloralPattern = downloadPattern;
  }

  // Calculate repeat based on desired tile size and boundary dimensions
  const desiredTileSize = 20; // World units per tile
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
            image={createFloralTexture()}
            wrapS={THREE.RepeatWrapping}
            wrapT={THREE.RepeatWrapping}
            repeat={new THREE.Vector2(repeatX, repeatY)}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}
