import * as THREE from "three";
import { useMemo } from "react";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
} from "../../utils/terrain";

interface TerrainOutlineProps {
  boundaries: TerrainBoundaries;
  seed: number;
}

export default function TerrainOutline({
  boundaries,
  seed,
}: TerrainOutlineProps) {
  const outlineTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1024, boundaries.width * 20);
    canvas.height = Math.max(1024, boundaries.height * 20);
    const ctx = canvas.getContext("2d")!;

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate border dimensions
    const borderWidth = Math.max(4, Math.min(canvas.width, canvas.height) * 0.008); // Thinner border

    // Create a smooth rounded rectangle path for better corner transitions
    const drawRoundedBorder = (x: number, y: number, w: number, h: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    // Create dark outline for better contrast against both white terrain and white clouds
    const outerGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    outerGradient.addColorStop(0, "rgba(0, 50, 100, 0.8)");    // Dark blue
    outerGradient.addColorStop(0.5, "rgba(0, 30, 80, 0.9)");   // Darker blue
    outerGradient.addColorStop(1, "rgba(0, 50, 100, 0.8)");    // Dark blue

    // Draw outer border with smooth corners
    ctx.strokeStyle = outerGradient;
    ctx.lineWidth = borderWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawRoundedBorder(borderWidth/2, borderWidth/2, canvas.width - borderWidth, canvas.height - borderWidth, borderWidth * 2);
    ctx.stroke();

    // Add inner glassmorphism highlight
    const innerGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    innerGradient.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    innerGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.6)");
    innerGradient.addColorStop(1, "rgba(255, 255, 255, 0.4)");

    ctx.strokeStyle = innerGradient;
    ctx.lineWidth = borderWidth * 0.5;
    drawRoundedBorder(borderWidth * 0.75, borderWidth * 0.75, canvas.width - borderWidth * 1.5, canvas.height - borderWidth * 1.5, borderWidth * 1.5);
    ctx.stroke();

    // Add subtle shadow inset for depth
    const shadowGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.1)");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0.05)");

    ctx.strokeStyle = shadowGradient;
    ctx.lineWidth = borderWidth * 0.3;
    drawRoundedBorder(borderWidth * 1.2, borderWidth * 1.2, canvas.width - borderWidth * 2.4, canvas.height - borderWidth * 2.4, borderWidth);
    ctx.stroke();

    return canvas;
  }, [boundaries.width, boundaries.height, seed]);

  return (
    <mesh position={[TERRAIN_PLANE_CONFIG.position[0], TERRAIN_PLANE_CONFIG.position[1], TERRAIN_PLANE_CONFIG.position[2] + 0.001]}>
      <planeGeometry args={[boundaries.width * 1.02, boundaries.height * 1.02]} />
      <meshBasicMaterial
        transparent
        opacity={1.0}
        depthWrite={false}
        depthTest={false}
      >
        <canvasTexture
          attach="map"
          image={outlineTexture}
          wrapS={THREE.ClampToEdgeWrapping}
          wrapT={THREE.ClampToEdgeWrapping}
        />
      </meshBasicMaterial>
    </mesh>
  );
}