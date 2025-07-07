import React from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";

interface CosmicPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
  usePngFile?: string; // Optional: use static PNG instead of generated pattern
}

export default function CosmicPattern({
  boundaries,
  seed,
  usePngFile,
}: CosmicPatternProps) {
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
  const createCosmicTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;

    // Deep space background
    ctx.fillStyle = "#0B0D1E";
    ctx.fillRect(0, 0, 1024, 1024);

    // Realistic planet colors with transparency (0.5-0.8)
    const planetColors = [
      "rgba(139, 69, 19, 0.7)", // Mars-like red/brown
      "rgba(255, 228, 181, 0.6)", // Venus-like pale yellow
      "rgba(70, 130, 180, 0.7)", // Neptune-like blue
      "rgba(218, 165, 32, 0.6)", // Jupiter-like golden brown
      "rgba(128, 128, 128, 0.7)", // Mercury-like gray
      "rgba(205, 133, 63, 0.6)", // Desert planet tan
      "rgba(47, 79, 79, 0.8)", // Dark slate gray
      "rgba(210, 180, 140, 0.7)", // Sandy brown
    ];


    // Create random but deterministic arrangement
    const random = multiRandom(seed);
    
    // Determine number of planets (1-3)
    const numPlanets = 1 + Math.floor(random.extra * 3);
    
    // Planet positions - non-overlapping
    const planetPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < numPlanets; i++) {
      const planetSeed = seed + i * 10000;
      const planetRandom = multiRandom(planetSeed);
      
      let x: number, y: number;
      let attempts = 0;
      do {
        x = 200 + planetRandom.x * 624; // Keep away from edges
        y = 200 + planetRandom.y * 624;
        attempts++;
      } while (attempts < 10 && planetPositions.some(p => 
        Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < 300
      ));
      
      planetPositions.push({ x, y });
    }

    // Draw big planets
    planetPositions.forEach((pos, i) => {
      const planetSeed = seed + i * 10000;
      const planetRandom = multiRandom(planetSeed);
      
      const mainColor = planetColors[Math.floor(planetRandom.color * planetColors.length)];
      const radius = 80 + planetRandom.extra * 60; // Large planets (80-140px radius)
      
      // Planet main body
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      
      // Planet rings (for some planets) - actual ring shapes
      if (planetRandom.extra > 0.4) { // 60% chance instead of 40%
        const ringColors = [
          "rgba(255, 255, 255, 0.4)", // Bright white rings
          "rgba(255, 228, 181, 0.3)", // Golden rings
          "rgba(176, 196, 222, 0.4)", // Light steel blue
          "rgba(255, 192, 203, 0.3)", // Light pink
        ];
        
        const ringColor = ringColors[Math.floor(planetRandom.size * ringColors.length)];
        const ringAngle = planetRandom.color * Math.PI * 0.3; // Moderate tilt
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(ringAngle);
        
        // Create actual ring shapes (filled ellipses with holes)
        ctx.fillStyle = ringColor;
        
        // Inner ring
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.4, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, radius * 1.15, radius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        
        // Middle ring (with gap)
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.8, radius * 0.4, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, radius * 1.55, radius * 0.32, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        
        // Outer ring (thinner)
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 2.1, radius * 0.45, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, radius * 1.95, radius * 0.38, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        
        // Optional additional faint rings for gas giants
        if (planetRandom.extra > 0.8) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 2.4, radius * 0.5, 0, 0, Math.PI * 2);
          ctx.ellipse(0, 0, radius * 2.25, radius * 0.43, 0, 0, Math.PI * 2);
          ctx.fill('evenodd');
        }
        
        ctx.restore();
      }
    });

    // Background stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < 200; i++) {
      const starSeed = seed + i * 100 + 50000;
      const starRandom = multiRandom(starSeed);

      const x = starRandom.x * 1024;
      const y = starRandom.y * 1024;
      const size = 0.5 + starRandom.size * 2;

      // Don't draw stars on planets
      const onPlanet = planetPositions.some(planet => 
        Math.sqrt((planet.x - x) ** 2 + (planet.y - y) ** 2) < 100
      );
      
      if (!onPlanet) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bright stars with glow
    for (let i = 0; i < 15; i++) {
      const brightStarSeed = seed + i * 500 + 100000;
      const brightStarRandom = multiRandom(brightStarSeed);

      const x = brightStarRandom.x * 1024;
      const y = brightStarRandom.y * 1024;
      
      // Don't draw on planets
      const onPlanet = planetPositions.some(planet => 
        Math.sqrt((planet.x - x) ** 2 + (planet.y - y) ** 2) < 120
      );
      
      if (!onPlanet) {
        // Glow
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright center
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Asteroids/rocks
    for (let i = 0; i < 25; i++) {
      const asteroidSeed = seed + i * 750 + 200000;
      const asteroidRandom = multiRandom(asteroidSeed);

      const x = asteroidRandom.x * 1024;
      const y = asteroidRandom.y * 1024;
      const size = 2 + asteroidRandom.size * 8;
      
      // Don't draw on planets
      const onPlanet = planetPositions.some(planet => 
        Math.sqrt((planet.x - x) ** 2 + (planet.y - y) ** 2) < 140
      );
      
      if (!onPlanet) {
        ctx.fillStyle = "rgba(139, 69, 19, 0.6)"; // Brown asteroids
        ctx.beginPath();
        
        // Irregular asteroid shape
        ctx.moveTo(x + size, y);
        for (let j = 0; j < 6; j++) {
          const angle = (j * Math.PI * 2) / 6;
          const variance = 0.7 + asteroidRandom.extra * 0.6;
          const px = x + Math.cos(angle) * size * variance;
          const py = y + Math.sin(angle) * size * variance;
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Distant nebula clouds
    for (let i = 0; i < 8; i++) {
      const nebulaSeed = seed + i * 1500 + 300000;
      const nebulaRandom = multiRandom(nebulaSeed);

      const x = nebulaRandom.x * 1024;
      const y = nebulaRandom.y * 1024;
      const size = 40 + nebulaRandom.size * 80;
      
      const nebulaColors = [
        "rgba(138, 43, 226, 0.2)", // Purple
        "rgba(255, 20, 147, 0.15)", // Pink
        "rgba(0, 191, 255, 0.2)", // Blue
        "rgba(50, 205, 50, 0.15)", // Green
      ];
      
      ctx.fillStyle = nebulaColors[Math.floor(nebulaRandom.color * nebulaColors.length)];
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas;
  };

  // Utility function to download current pattern as PNG
  const downloadPattern = () => {
    const canvas = createCosmicTexture();
    const link = document.createElement("a");
    link.download = `cosmic-pattern-${seed}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Add to window for debugging (remove in production)
  if (typeof window !== "undefined") {
    (window as any).downloadCosmicPattern = downloadPattern;
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
            image={createCosmicTexture()}
            wrapS={THREE.ClampToEdgeWrapping}
            wrapT={THREE.ClampToEdgeWrapping}
            repeat={new THREE.Vector2(repeatX, repeatY)}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}
