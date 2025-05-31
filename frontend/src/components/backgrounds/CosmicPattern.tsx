import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface CosmicPatternProps {
  boundaries: TerrainBoundaries;
}

export default function CosmicPattern({ boundaries }: CosmicPatternProps) {
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

    // Add stars
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = Math.random() * 2;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Add star twinkle effect
      if (Math.random() > 0.8) {
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

    // Draw planets
    const planetColors = [
      ["#ff6b6b", "#ff4757"], // Red planet
      ["#4dabf7", "#339af0"], // Blue planet
      ["#69db7c", "#51cf66"], // Green planet
      ["#ffd93d", "#fcc419"], // Yellow planet
      ["#da77f2", "#be4bdb"], // Purple planet
    ];

    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 200 + 28;
      const y = Math.random() * 200 + 28;
      const size = 15 + Math.random() * 25;
      const colorPair =
        planetColors[Math.floor(Math.random() * planetColors.length)];

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
        const featureX = x + (Math.random() - 0.5) * size;
        const featureY = y + (Math.random() - 0.5) * size;
        const featureSize = size * 0.1 + Math.random() * size * 0.2;

        ctx.beginPath();
        ctx.arc(featureX, featureY, featureSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // Rings for some planets
      if (Math.random() > 0.6) {
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

    // Add nebula effects
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = 30 + Math.random() * 50;
      const colors = ["#ff6b6b", "#4dabf7", "#da77f2", "#69db7c"];
      const color = colors[Math.floor(Math.random() * colors.length)];

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

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createCosmicTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(2, 2)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
