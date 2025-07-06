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
    pngTexture.wrapS = THREE.ClampToEdgeWrapping;
    pngTexture.wrapT = THREE.ClampToEdgeWrapping;
    pngTexture.repeat.set(1, 1);
  }

  const createFloralTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;

    // Base color - soft pastel cream
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, 1024, 1024);

    // Ultra-vibrant colors with high transparency
    const tulipColors = [
      "rgba(255, 20, 147, 0.6)", // Deep pink with high transparency
      "rgba(255, 69, 0, 0.6)", // Red orange with high transparency
      "rgba(220, 20, 60, 0.6)", // Crimson with high transparency
      "rgba(138, 43, 226, 0.6)", // Blue violet with high transparency
      "rgba(0, 0, 255, 0.6)", // Pure blue with high transparency
      "rgba(255, 215, 0, 0.6)", // Pure gold with high transparency
    ];

    const daisyColors = [
      "rgba(255, 255, 0, 0.6)", // Pure yellow with high transparency
      "rgba(255, 140, 0, 0.6)", // Dark orange with high transparency
      "rgba(255, 20, 147, 0.6)", // Deep pink with high transparency
      "rgba(139, 0, 255, 0.6)", // Electric violet with high transparency
      "rgba(0, 191, 255, 0.6)", // Deep sky blue with high transparency
      "rgba(50, 205, 50, 0.6)", // Lime green with high transparency
    ];

    const roseColors = [
      "rgba(255, 105, 180, 0.6)", // Hot pink with high transparency
      "rgba(255, 0, 0, 0.6)", // Pure red with high transparency
      "rgba(255, 69, 0, 0.6)", // Orange red with high transparency
      "rgba(153, 50, 204, 0.6)", // Dark orchid with high transparency
      "rgba(75, 0, 130, 0.6)", // Indigo with high transparency
      "rgba(30, 144, 255, 0.6)", // Dodger blue with high transparency
    ];

    const accentColors = [
      "rgba(255, 255, 0, 0.7)", // Pure yellow with transparency
      "rgba(255, 99, 71, 0.7)", // Tomato with transparency
      "rgba(127, 255, 0, 0.7)", // Chartreuse with transparency
      "rgba(0, 255, 255, 0.7)", // Cyan with transparency
      "rgba(139, 69, 19, 0.7)", // Saddle brown with transparency
      "rgba(70, 130, 180, 0.7)", // Steel blue with transparency
    ];

    const stemColor = "#228B22";

    // Create large, non-repeating arrangement
    const random = multiRandom(seed);
    

    // Large tulip flowers - very widely spaced
    const tulipPositions = [
      { x: 150, y: 150 }, { x: 700, y: 300 }, { x: 300, y: 700 },
    ];

    tulipPositions.forEach((pos, i) => {
      const tulipSeed = seed + i * 1000;
      const tulipRandom = multiRandom(tulipSeed);
      
      const mainColor = tulipColors[Math.floor(tulipRandom.color * tulipColors.length)];
      const accentColor = accentColors[Math.floor(tulipRandom.size * accentColors.length)];
      const scale = 2.5 + tulipRandom.extra * 1.5; // Much larger
      
      // Tulip stem - longer and thicker
      ctx.strokeStyle = stemColor;
      ctx.lineWidth = 8 * scale;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + 60 * scale);
      ctx.lineTo(pos.x + 8 * scale, pos.y + 200 * scale);
      ctx.stroke();
      
      // Tulip petals - classic tulip shape, much larger
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      
      // Left petal
      ctx.ellipse(pos.x - 25 * scale, pos.y, 20 * scale, 40 * scale, -0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Right petal
      ctx.beginPath();
      ctx.ellipse(pos.x + 25 * scale, pos.y, 20 * scale, 40 * scale, 0.7, 0, Math.PI * 2);
      ctx.fill();
      
      // Center petal
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, 22 * scale, 45 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner tulip accent
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 8 * scale, 15 * scale, 25 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Tulip leaves - larger
      ctx.fillStyle = stemColor;
      ctx.beginPath();
      ctx.ellipse(pos.x - 40 * scale, pos.y + 50 * scale, 15 * scale, 60 * scale, -0.6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(pos.x + 40 * scale, pos.y + 60 * scale, 15 * scale, 50 * scale, 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Daisy flowers - very widely spaced
    const daisyPositions = [
      { x: 500, y: 200 }, { x: 200, y: 500 }, { x: 800, y: 700 },
    ];

    daisyPositions.forEach((pos, i) => {
      const daisySeed = seed + i * 1500 + 50000;
      const daisyRandom = multiRandom(daisySeed);
      
      const mainColor = daisyColors[Math.floor(daisyRandom.color * daisyColors.length)];
      const centerColor = accentColors[Math.floor(daisyRandom.size * accentColors.length)];
      const scale = 2.0 + daisyRandom.extra * 1.0; // Much larger
      
      // Daisy stem
      ctx.strokeStyle = stemColor;
      ctx.lineWidth = 6 * scale;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + 40 * scale);
      ctx.lineTo(pos.x + 5 * scale, pos.y + 150 * scale);
      ctx.stroke();
      
      // Daisy petals - larger
      ctx.fillStyle = mainColor;
      for (let j = 0; j < 10; j++) {
        const angle = (j * Math.PI * 2) / 10;
        const petalX = pos.x + Math.cos(angle) * 30 * scale;
        const petalY = pos.y + Math.sin(angle) * 30 * scale;
        
        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 8 * scale, 25 * scale, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Daisy center - larger
      ctx.fillStyle = centerColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15 * scale, 0, Math.PI * 2);
      ctx.fill();
    });

    // Rose flowers - very widely spaced
    const rosePositions = [
      { x: 850, y: 150 }, { x: 100, y: 350 }, { x: 600, y: 600 },
    ];

    rosePositions.forEach((pos, i) => {
      const roseSeed = seed + i * 2000 + 100000;
      const roseRandom = multiRandom(roseSeed);
      
      const mainColor = roseColors[Math.floor(roseRandom.color * roseColors.length)];
      const accentColor = accentColors[Math.floor(roseRandom.size * accentColors.length)];
      const scale = 2.2 + roseRandom.extra * 1.3; // Much larger
      
      // Rose stem
      ctx.strokeStyle = stemColor;
      ctx.lineWidth = 7 * scale;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + 50 * scale);
      ctx.lineTo(pos.x + 6 * scale, pos.y + 180 * scale);
      ctx.stroke();
      
      // Rose outer petals - larger
      ctx.fillStyle = mainColor;
      for (let j = 0; j < 8; j++) {
        const angle = (j * Math.PI * 2) / 8;
        const petalX = pos.x + Math.cos(angle) * 25 * scale;
        const petalY = pos.y + Math.sin(angle) * 25 * scale;
        
        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 15 * scale, 30 * scale, angle + 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Rose inner petals - larger
      ctx.fillStyle = accentColor;
      for (let j = 0; j < 6; j++) {
        const angle = (j * Math.PI * 2) / 6 + 0.6;
        const petalX = pos.x + Math.cos(angle) * 12 * scale;
        const petalY = pos.y + Math.sin(angle) * 12 * scale;
        
        ctx.beginPath();
        ctx.ellipse(petalX, petalY, 10 * scale, 20 * scale, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Rose center - larger
      ctx.fillStyle = stemColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8 * scale, 0, Math.PI * 2);
      ctx.fill();
    });



    // Subtle texture dots
    ctx.fillStyle = "rgba(168, 196, 162, 0.1)";
    for (let i = 0; i < 30; i++) {
      const dotSeed = seed + i * 300 + 5000;
      const dotRandom = multiRandom(dotSeed);

      const x = dotRandom.x * 1024;
      const y = dotRandom.y * 1024;
      const size = 1 + dotRandom.size * 2;

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

  // Use single large texture without repeating
  const repeatX = 1;
  const repeatY = 1;

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
            wrapS={THREE.ClampToEdgeWrapping}
            wrapT={THREE.ClampToEdgeWrapping}
            repeat={new THREE.Vector2(repeatX, repeatY)}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}
