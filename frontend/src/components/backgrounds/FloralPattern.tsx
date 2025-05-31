import React from "react";
import * as THREE from "three";
import { TerrainBoundaries, TERRAIN_PLANE_CONFIG } from "../../utils/terrain";

interface FloralPatternProps {
  boundaries: TerrainBoundaries;
}

export default function FloralPattern({ boundaries }: FloralPatternProps) {
  const createFloralTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Base color - soft green
    ctx.fillStyle = "#E8F5E8";
    ctx.fillRect(0, 0, 256, 256);

    // Draw floral pattern
    const colors = ["#98D982", "#7BC142", "#4A90A4", "#85C1E9"];

    for (let i = 0; i < 25; i++) {
      const x = (i % 5) * 51.2 + 25.6;
      const y = Math.floor(i / 5) * 51.2 + 25.6;

      // Random offset for natural look
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetY = (Math.random() - 0.5) * 20;

      const centerX = x + offsetX;
      const centerY = y + offsetY;

      // Draw flower petals
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      for (let petal = 0; petal < 6; petal++) {
        const angle = (petal * Math.PI * 2) / 6;
        const petalX = centerX + Math.cos(angle) * 8;
        const petalY = centerY + Math.sin(angle) * 8;

        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 4, 8, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw flower center
      ctx.fillStyle = "#F4D03F";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Add small leaves
      ctx.fillStyle = "#52C41A";
      for (let leaf = 0; leaf < 3; leaf++) {
        const leafAngle = (leaf * Math.PI * 2) / 3 + Math.PI / 6;
        const leafX = centerX + Math.cos(leafAngle) * 12;
        const leafY = centerY + Math.sin(leafAngle) * 12;

        ctx.beginPath();
        ctx.ellipse(leafX, leafY, 2, 6, leafAngle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  };

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial transparent opacity={TERRAIN_PLANE_CONFIG.opacity}>
        <canvasTexture
          attach="map"
          image={createFloralTexture()}
          wrapS={THREE.RepeatWrapping}
          wrapT={THREE.RepeatWrapping}
          repeat={new THREE.Vector2(4, 4)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}
