import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";

interface SnowflakePatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
  usePngFile?: string;
}

export default function SnowflakePattern({
  boundaries,
  seed,
  usePngFile,
}: SnowflakePatternProps) {
  const pngTexture = usePngFile ? useLoader(THREE.TextureLoader, usePngFile) : null;

  if (pngTexture) {
    pngTexture.wrapS = THREE.RepeatWrapping;
    pngTexture.wrapT = THREE.RepeatWrapping;
  }

  // Helper function for recursive dendritic branching
  const drawDendriticBranch = (
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    angle: number,
    length: number,
    level: number,
    randomSeed: number
  ) => {
    if (length < 5 || level > 4) return; // Stop recursion
    
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    
    ctx.lineWidth = Math.max(0.5, 3 - level);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Recursive sub-branches
    if (randomSeed > 0.3) {
      const subLength = length * (0.4 + randomSeed * 0.3);
      drawDendriticBranch(ctx, endX, endY, angle - Math.PI/6, subLength, level + 1, randomSeed * 0.8);
      drawDendriticBranch(ctx, endX, endY, angle + Math.PI/6, subLength, level + 1, randomSeed * 0.7);
    }
  };

  // Helper function for crystalline details
  const drawCrystallineDetail = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    size: number,
    randomSeed: number
  ) => {
    const numPoints = 3 + Math.floor(randomSeed * 4); // 3-6 crystalline points
    
    ctx.lineWidth = 0.5;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * Math.PI * 2) / numPoints + randomSeed * Math.PI;
      const length = size * (0.5 + randomSeed * 0.5);
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * length,
        centerY + Math.sin(angle) * length
      );
      ctx.stroke();
    }
  };

  const drawComplexSnowflake = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    random: any
  ) => {
    const snowflakeColors = [
      "rgba(0, 30, 80, 0.9)",       // Very dark blue
      "rgba(10, 40, 90, 0.8)",      // Dark blue
      "rgba(20, 60, 120, 0.8)",     // Medium blue
      "rgba(30, 70, 130, 0.7)",     // Medium-light blue
      "rgba(40, 80, 140, 0.7)",     // Lighter blue
      "rgba(50, 90, 150, 0.6)",     // Light blue
      "rgba(60, 100, 160, 0.6)",    // Even lighter blue
      "rgba(70, 110, 170, 0.5)",    // Very light blue
      "rgba(80, 120, 180, 0.5)",    // Lightest blue
      "rgba(0, 20, 60, 0.9)",       // Navy blue
      "rgba(15, 35, 85, 0.8)",      // Dark navy blue
    ];
    
    const colorIndex = Math.floor(random.color * snowflakeColors.length);
    ctx.strokeStyle = snowflakeColors[colorIndex];
    ctx.fillStyle = snowflakeColors[colorIndex];
    ctx.lineWidth = 2 + random.extra * 4; // Thinner for detail (2-6px)
    ctx.lineCap = "round";

    // Always 6 branches for natural snowflake symmetry
    const numMainBranches = 6;
    const rotationOffset = random.y * Math.PI / 6; // Small rotation variation
    
    for (let i = 0; i < numMainBranches; i++) {
      const angle = (i * Math.PI) / 3 + rotationOffset;
      const branchLength = radius * (0.8 + random.x * 0.4); // 80-120% variation
      
      // Draw main spine with thickness variation
      const spineThickness = 1 + random.size * 3;
      ctx.lineWidth = spineThickness;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * branchLength, centerY + Math.sin(angle) * branchLength);
      ctx.stroke();
      
      // Generate dendritic side branches
      const numLevels = 3 + Math.floor(random.extra * 3); // 3-5 levels of branching
      
      for (let level = 1; level <= numLevels; level++) {
        const branchesAtLevel = 2 + Math.floor(random.size * 4); // 2-5 branches per level
        
        for (let b = 0; b < branchesAtLevel; b++) {
          const branchRatio = (level + random.color * 0.5) / (numLevels + 1);
          const branchX = centerX + Math.cos(angle) * branchLength * branchRatio;
          const branchY = centerY + Math.sin(angle) * branchLength * branchRatio;
          
          // Generate fractal sub-branches
          const subBranchLength = branchLength * (1 - branchRatio) * (0.3 + random.y * 0.4);
          const angleVariation = (Math.PI / 8) + (random.extra * Math.PI / 8); // 22.5-45 degrees
          
          // Left sub-branch with recursive detail
          drawDendriticBranch(
            ctx,
            branchX,
            branchY,
            angle - angleVariation,
            subBranchLength,
            level,
            random.x + b * 0.1
          );
          
          // Right sub-branch with recursive detail
          drawDendriticBranch(
            ctx,
            branchX,
            branchY,
            angle + angleVariation,
            subBranchLength,
            level,
            random.y + b * 0.1
          );
          
          // Add crystalline details
          if (level > 1 && random.extra > 0.6) {
            drawCrystallineDetail(ctx, branchX, branchY, subBranchLength * 0.3, random.color + b * 0.05);
          }
        }
      }
      
      // Add feathery edge details
      const edgeDetails = Math.floor(random.size * 8); // 0-7 edge details
      for (let e = 0; e < edgeDetails; e++) {
        const edgeRatio = 0.7 + (e / edgeDetails) * 0.3; // Towards the tip
        const edgeX = centerX + Math.cos(angle) * branchLength * edgeRatio;
        const edgeY = centerY + Math.sin(angle) * branchLength * edgeRatio;
        
        const featherLength = branchLength * 0.1 * (1 - edgeRatio);
        const featherAngle = angle + (random.x - 0.5) * Math.PI / 4;
        
        ctx.lineWidth = 0.5 + random.extra;
        ctx.beginPath();
        ctx.moveTo(edgeX, edgeY);
        ctx.lineTo(
          edgeX + Math.cos(featherAngle) * featherLength,
          edgeY + Math.sin(featherAngle) * featherLength
        );
        ctx.stroke();
      }
    }
    
    // Complex center with hexagonal structure
    const centerRadius = 3 + random.extra * 8;
    
    // Draw hexagonal center
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const hexAngle = (i * Math.PI) / 3;
      const x = centerX + Math.cos(hexAngle) * centerRadius;
      const y = centerY + Math.sin(hexAngle) * centerRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Fill center
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const snowflakeTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1024, boundaries.width * 20);
    canvas.height = Math.max(1024, boundaries.height * 20);
    const ctx = canvas.getContext("2d")!;

    // Winter background with subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#E8F4FF");
    gradient.addColorStop(0.5, "#F0F8FF");
    gradient.addColorStop(1, "#F8FCFF");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate fewer but much larger snowflakes
    const flakeRandom = multiRandom(seed);
    const numSnowflakes = 20 + Math.floor(flakeRandom.x * 30); // 20-49 snowflakes (fewer for bigger size)
    
    // Create grid-based distribution with space for large snowflakes
    const gridCols = Math.ceil(Math.sqrt(numSnowflakes * 0.8));
    const gridRows = Math.ceil(numSnowflakes / gridCols);
    const cellWidth = canvas.width / gridCols;
    const cellHeight = canvas.height / gridRows;

    for (let i = 0; i < numSnowflakes; i++) {
      const snowflakeRandom = multiRandom(seed + i * 1000);
      
      // Grid-based positioning with controlled offset within cell
      const gridCol = i % gridCols;
      const gridRow = Math.floor(i / gridCols);
      
      const baseX = gridCol * cellWidth;
      const baseY = gridRow * cellHeight;
      
      // Small random offset to stay within grid cell
      const offsetX = (snowflakeRandom.x - 0.5) * cellWidth * 0.4;
      const offsetY = (snowflakeRandom.y - 0.5) * cellHeight * 0.4;
      
      const centerX = baseX + cellWidth/2 + offsetX;
      const centerY = baseY + cellHeight/2 + offsetY;
      
      // Much larger snowflakes - up to 80% of cell size
      const maxRadius = Math.min(cellWidth, cellHeight) * 0.8; // Max 80% of cell size
      const radius = maxRadius * 0.6 + snowflakeRandom.size * maxRadius * 0.4; // 60-100% of max
      
      drawComplexSnowflake(ctx, centerX, centerY, radius, snowflakeRandom);
    }

    return canvas;
  }, [boundaries.width, boundaries.height, seed]);


  const downloadPattern = () => {
    const link = document.createElement("a");
    link.download = `snowflake-pattern-${seed}.png`;
    link.href = snowflakeTexture.toDataURL();
    link.click();
  };

  if (typeof window !== "undefined") {
    (window as unknown as { downloadSnowflakePattern: () => void }).downloadSnowflakePattern = downloadPattern;
  }

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
            image={snowflakeTexture}
            wrapS={THREE.ClampToEdgeWrapping}
            wrapT={THREE.ClampToEdgeWrapping}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}