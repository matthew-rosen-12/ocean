import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface CosmicPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
}

export default function CosmicPattern({
  boundaries,
  seed,
}: CosmicPatternProps) {
  const createCosmicTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - deep space
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f0f1a");
    ctx.fillStyle = gradient;
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

    // Add tileable stars
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 120; i++) {
      const starSeed = seed + i * 1000;
      const random = multiRandom(starSeed);

      const x = random.x * 256;
      const y = random.y * 256;
      const size = random.size * 2;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Add star twinkle effect
      if (random.extra > 0.8) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - size * 2, y);
        ctx.lineTo(x + size * 2, y);
        ctx.moveTo(x, y - size * 2);
        ctx.lineTo(x, y + size * 2);
        ctx.stroke();
      }
    }

    // Draw tileable planets
    const planetColors = [
      ["#ff6b6b", "#ff4757"], // Red planet
      ["#4dabf7", "#339af0"], // Blue planet
      ["#69db7c", "#51cf66"], // Green planet
      ["#ffd93d", "#fcc419"], // Yellow planet
      ["#da77f2", "#be4bdb"], // Purple planet
    ];

    for (let i = 0; i < 4; i++) {
      const seed = i * 2000;
      // Ensure planets are not too close to edges for better tiling
      const x = 40 + multiRandom(seed).x * 176; // 40px margin from edges
      const y = 40 + multiRandom(seed).y * 176;
      const size = 15 + multiRandom(seed).size * 25;
      const colorIndex = Math.floor(
        multiRandom(seed).color * planetColors.length
      );
      const colorPair = planetColors[colorIndex];

      // Planet body with gradient
      const planetGradient = ctx.createRadialGradient(
        x - size * 0.3,
        y - size * 0.3,
        0,
        x,
        y,
        size
      );
      planetGradient.addColorStop(0, colorPair[0]);
      planetGradient.addColorStop(1, colorPair[1]);

      ctx.fillStyle = planetGradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Add planet features
      ctx.fillStyle = colorPair[1];
      ctx.globalAlpha = 0.6;

      // Craters or surface features
      for (let j = 0; j < 3; j++) {
        const featureSeed = seed + 100 + j * 10;
        const featureX = x + (multiRandom(featureSeed).x - 0.5) * size;
        const featureY = y + (multiRandom(featureSeed).y - 0.5) * size;
        const featureSize =
          size * 0.1 + multiRandom(featureSeed).size * size * 0.2;

        ctx.beginPath();
        ctx.arc(featureX, featureY, featureSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // Rings for some planets
      if (multiRandom(seed).extra > 0.6) {
        ctx.strokeStyle = colorPair[0];
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;

        ctx.beginPath();
        ctx.ellipse(x, y, size * 1.5, size * 0.3, Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(x, y, size * 1.8, size * 0.4, Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    }

    // Add tileable nebula effects
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      const seed = i * 3000;
      const x = multiRandom(seed).x * 256;
      const y = multiRandom(seed).y * 256;
      const size = 30 + multiRandom(seed).size * 50;
      const colors = ["#ff6b6b", "#4dabf7", "#da77f2", "#69db7c"];
      const colorIndex = Math.floor(multiRandom(seed).color * colors.length);
      const color = colors[colorIndex];

      const nebulaGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      nebulaGradient.addColorStop(0, color);
      nebulaGradient.addColorStop(1, "transparent");

      ctx.fillStyle = nebulaGradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    return canvas;
  };

  // Calculate repeat based on desired tile size and boundary dimensions
  const desiredTileSize = 25; // World units per tile (larger for cosmic scale)
  const repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
  const repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createCosmicTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(repeatX, repeatY)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
