import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface AnimalPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
}

export default function AnimalPattern({
  boundaries,
  seed,
}: AnimalPatternProps) {
  const createAnimalTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - sandy savanna
    ctx.fillStyle = "#F4E4BC";
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

    // Add subtle grass texture with seeded randomness
    ctx.fillStyle = "#E6D7A3";
    for (let i = 0; i < 200; i++) {
      const grassSeed = seed + i * 100;
      const random = multiRandom(grassSeed);

      const x = random.x * 256;
      const y = random.y * 256;
      ctx.fillRect(x, y, 1, random.extra * 3);
    }

    // Draw animal silhouettes with deterministic placement
    const animalColors = ["#8B4513", "#654321", "#A0522D", "#D2691E"];

    for (let i = 0; i < 12; i++) {
      const animalSeed = seed + i * 1000;
      const random = multiRandom(animalSeed);

      const x = 40 + random.x * 176; // Keep away from edges
      const y = 40 + random.y * 176;
      const size = 20 + random.size * 25;
      const animalType = Math.floor(random.extra * 4);

      ctx.fillStyle =
        animalColors[Math.floor(random.color * animalColors.length)];

      switch (animalType) {
        case 0: // Elephant
          // Body
          ctx.beginPath();
          ctx.ellipse(x, y, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Trunk
          ctx.beginPath();
          ctx.arc(x - size * 0.3, y - size * 0.2, size * 0.15, 0, Math.PI * 2);
          ctx.fill();
          // Legs
          for (let leg = 0; leg < 4; leg++) {
            ctx.fillRect(
              x - size * 0.4 + leg * (size * 0.27),
              y + size * 0.2,
              size * 0.1,
              size * 0.3
            );
          }
          break;

        case 1: // Giraffe
          // Body
          ctx.beginPath();
          ctx.ellipse(x, y, size * 0.3, size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Neck
          ctx.fillRect(x - size * 0.05, y - size * 0.8, size * 0.1, size * 0.6);
          // Head
          ctx.beginPath();
          ctx.arc(x, y - size * 0.8, size * 0.15, 0, Math.PI * 2);
          ctx.fill();
          // Legs
          for (let leg = 0; leg < 4; leg++) {
            ctx.fillRect(
              x - size * 0.2 + leg * (size * 0.13),
              y + size * 0.3,
              size * 0.08,
              size * 0.4
            );
          }
          break;

        case 2: // Lion
          // Body
          ctx.beginPath();
          ctx.ellipse(x, y, size * 0.4, size * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
          // Head with mane
          ctx.beginPath();
          ctx.arc(x - size * 0.3, y - size * 0.1, size * 0.2, 0, Math.PI * 2);
          ctx.fill();
          // Mane
          ctx.beginPath();
          ctx.arc(x - size * 0.3, y - size * 0.1, size * 0.25, 0, Math.PI * 2);
          ctx.stroke();
          // Tail
          ctx.fillRect(x + size * 0.35, y, size * 0.1, size * 0.15);
          break;

        case 3: // Zebra
          // Body
          ctx.beginPath();
          ctx.ellipse(x, y, size * 0.35, size * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          // Head
          ctx.beginPath();
          ctx.ellipse(
            x - size * 0.25,
            y - size * 0.1,
            size * 0.12,
            size * 0.15,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          // Stripes (simplified)
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          for (let stripe = 0; stripe < 5; stripe++) {
            ctx.beginPath();
            ctx.moveTo(x - size * 0.35, y - size * 0.2 + stripe * (size * 0.1));
            ctx.lineTo(x + size * 0.35, y - size * 0.2 + stripe * (size * 0.1));
            ctx.stroke();
          }
          break;
      }
    }

    // Add acacia trees with deterministic placement
    ctx.fillStyle = "#228B22";
    for (let i = 0; i < 6; i++) {
      const x = multiRandom(i * 20 + 200).x * 256;
      const y = multiRandom(i * 20 + 201).y * 256;
      const size = 15 + multiRandom(i * 20 + 202).size * 20;

      // Acacia tree crown (flat top)
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Trunk
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(x - 2, y + size * 0.2, 4, size * 0.4);
      ctx.fillStyle = "#228B22";
    }

    return canvas;
  };

  // Calculate repeat based on desired tile size and boundary dimensions
  const desiredTileSize = 22; // World units per tile
  const repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
  const repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createAnimalTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(repeatX, repeatY)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
