import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";

interface MosaicPatternProps {
  boundaries: TerrainBoundaries;
  seed: number;
  usePngFile?: string; // Optional: use static PNG instead of generated pattern
}

export default function MosaicPattern({
  boundaries,
  seed,
  usePngFile,
}: MosaicPatternProps) {
  // Load PNG texture if specified
  const pngTexture = usePngFile ? useLoader(THREE.TextureLoader, usePngFile) : null;

  // Configure PNG texture if loaded
  if (pngTexture) {
    pngTexture.wrapS = THREE.RepeatWrapping;
    pngTexture.wrapT = THREE.RepeatWrapping;
  }

  const createMosaicTexture = () => {
    const canvas = document.createElement("canvas");
    // Make canvas match terrain size to avoid tiling
    canvas.width = Math.max(512, boundaries.width * 10);
    canvas.height = Math.max(512, boundaries.height * 10);
    const ctx = canvas.getContext("2d")!

    // Base background color (light sky)
    ctx.fillStyle = "#E8F4F8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // City element colors with 0.5-0.8 transparency
    const buildingColors = [
      "rgba(100, 100, 100, 0.6)", // Gray concrete
      "rgba(80, 80, 90, 0.7)", // Dark gray
      "rgba(60, 80, 100, 0.6)", // Blue-gray
      "rgba(90, 70, 70, 0.5)", // Reddish brown
      "rgba(70, 85, 110, 0.6)", // Steel blue
      "rgba(110, 90, 70, 0.6)", // Brown
      "rgba(85, 95, 120, 0.7)", // Slate blue
      "rgba(120, 100, 80, 0.5)", // Light brown
    ];

    const vehicleColors = [
      "rgba(200, 50, 50, 0.8)", // Red bus
      "rgba(50, 100, 200, 0.7)", // Blue bus
      "rgba(255, 200, 50, 0.6)", // Yellow bus
      "rgba(100, 200, 100, 0.5)", // Green bus
    ];

    // Draw city blocks with streets (Manhattan-style: wider than tall)
    const blockWidth = 280; // Width of each city block
    const blockHeight = 180; // Height of each city block
    const streetWidth = 30; // Width of streets
    const totalBlockUnitX = blockWidth + streetWidth; // Total space per block unit X
    const totalBlockUnitY = blockHeight + streetWidth; // Total space per block unit Y
    
    const blocksX = Math.floor(canvas.width / totalBlockUnitX) + 1;
    const blocksY = Math.floor(canvas.height / totalBlockUnitY) + 1;
    
    // Generate rivers (1-2 rivers) - positioned at center of block edges (half-block offset from roads)
    const riverRandom = multiRandom(seed + 5000);
    const numRivers = Math.floor(riverRandom.x * 2) + (riverRandom.y > 0.3 ? 1 : 0); // 0-2 rivers
    const riverInfo: { type: string; position: number; width: number }[] = [];
    
    for (let r = 0; r < numRivers; r++) {
      const riverSeed = multiRandom(seed + 5000 + r * 1000);
      const isVertical = riverSeed.color > 0.5;
      
      if (isVertical) {
        // Vertical river - positioned at half-block offset from regular grid
        const riverPositionX = Math.floor((0.2 + riverSeed.x * 0.6) * blocksX) * totalBlockUnitX + totalBlockUnitX / 2;
        riverInfo.push({ type: 'vertical', position: riverPositionX, width: blockWidth });
      } else {
        // Horizontal river - positioned at half-block offset from regular grid  
        const riverPositionY = Math.floor((0.2 + riverSeed.y * 0.6) * blocksY) * totalBlockUnitY + totalBlockUnitY / 2;
        riverInfo.push({ type: 'horizontal', position: riverPositionY, width: blockHeight });
      }
    }
    
    // Draw streets first (gray rectangles)
    ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
    
    // Generate bridge positions (max 2 per river)
    const bridgePositions = new Set();
    for (let r = 0; r < riverInfo.length; r++) {
      const river = riverInfo[r];
      const bridgeRandom = multiRandom(seed + 6000 + r * 100);
      const numBridges = 1 + Math.floor(bridgeRandom.x * 2); // 1-2 bridges per river

      if (river.type === 'vertical') {
        // For vertical rivers, bridges are horizontal streets crossing the river
        const availableStreets = Array.from({ length: blocksY }, (_, i) => i);
        
        // Pick random, unique bridge positions
        for (let b = 0; b < Math.min(numBridges, availableStreets.length); b++) {
          const randIndex = Math.floor(((bridgeRandom.y + b * 0.4) % 1) * availableStreets.length);
          const streetY = availableStreets[randIndex];
          bridgePositions.add(`h,${streetY},${r}`);
          availableStreets.splice(randIndex, 1); // Ensure unique bridge placement
        }
      } else {
        // For horizontal rivers, bridges are vertical streets crossing the river
        const availableStreets = Array.from({ length: blocksX }, (_, i) => i);

        // Pick random, unique bridge positions
        for (let b = 0; b < Math.min(numBridges, availableStreets.length); b++) {
          const randIndex = Math.floor(((bridgeRandom.size + b * 0.4) % 1) * availableStreets.length);
          const streetX = availableStreets[randIndex];
          bridgePositions.add(`v,${streetX},${r}`);
          availableStreets.splice(randIndex, 1); // Ensure unique bridge placement
        }
      }
    }

    // Note: Bridges will be drawn after streets to ensure they appear on top
    
    // Helper function to check if a street segment intersects with any river
    const streetIntersectsRiver = (x: number, y: number, width: number, height: number) => {
      for (const river of riverInfo) {
        if (river.type === 'vertical') {
          // Check if street intersects vertical river
          const riverLeft = river.position - river.width / 2;
          const riverRight = river.position + river.width / 2;
          if (x < riverRight && x + width > riverLeft) {
            return true;
          }
        } else {
          // Check if street intersects horizontal river
          const riverTop = river.position - river.width / 2;
          const riverBottom = river.position + river.width / 2;
          if (y < riverBottom && y + height > riverTop) {
            return true;
          }
        }
      }
      return false;
    };

    // Draw horizontal streets (skip segments that intersect rivers)
    ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
    for (let by = 0; by < blocksY; by++) {
      const streetY = by * totalBlockUnitY + blockHeight;
      if (streetY < canvas.height) {
        // Draw street in segments, skipping river intersections
        let segmentStart = 0;
        const segmentSize = 50; // Check in small segments
        
        for (let x = 0; x <= canvas.width; x += segmentSize) {
          const segmentEnd = Math.min(x + segmentSize, canvas.width);
          const intersects = streetIntersectsRiver(x, streetY, segmentEnd - x, streetWidth);
          
          if (intersects) {
            // End current segment before river
            if (segmentStart < x) {
              ctx.fillRect(segmentStart, streetY, x - segmentStart, streetWidth);
            }
            segmentStart = segmentEnd; // Start new segment after this piece
          } else if (x === canvas.width) {
            // End of canvas, draw final segment
            if (segmentStart < segmentEnd) {
              ctx.fillRect(segmentStart, streetY, segmentEnd - segmentStart, streetWidth);
            }
          }
        }
      }
    }
    
    // Draw vertical streets (skip segments that intersect rivers)
    for (let bx = 0; bx < blocksX; bx++) {
      const streetX = bx * totalBlockUnitX + blockWidth;
      if (streetX < canvas.width) {
        // Draw street in segments, skipping river intersections
        let segmentStart = 0;
        const segmentSize = 50; // Check in small segments
        
        for (let y = 0; y <= canvas.height; y += segmentSize) {
          const segmentEnd = Math.min(y + segmentSize, canvas.height);
          const intersects = streetIntersectsRiver(streetX, y, streetWidth, segmentEnd - y);
          
          if (intersects) {
            // End current segment before river
            if (segmentStart < y) {
              ctx.fillRect(streetX, segmentStart, streetWidth, y - segmentStart);
            }
            segmentStart = segmentEnd; // Start new segment after this piece
          } else if (y === canvas.height) {
            // End of canvas, draw final segment
            if (segmentStart < segmentEnd) {
              ctx.fillRect(streetX, segmentStart, streetWidth, segmentEnd - segmentStart);
            }
          }
        }
      }
    }
    
    // Helper function to check if a block intersects with any river
    const blockIntersectsRiver = (blockX: number, blockY: number) => {
      for (const river of riverInfo) {
        if (river.type === 'vertical') {
          // Check if block intersects vertical river
          const riverLeft = river.position - river.width / 2;
          const riverRight = river.position + river.width / 2;
          const blockRight = blockX + blockWidth;
          if (blockX < riverRight && blockRight > riverLeft) {
            return true;
          }
        } else {
          // Check if block intersects horizontal river
          const riverTop = river.position - river.width / 2;
          const riverBottom = river.position + river.width / 2;
          const blockBottom = blockY + blockHeight;
          if (blockY < riverBottom && blockBottom > riverTop) {
            return true;
          }
        }
      }
      return false;
    };

    // Draw buildings in each block (multiple buildings per block)
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const blockX = bx * totalBlockUnitX;
        const blockY = by * totalBlockUnitY;
        
        // Skip if block is outside canvas or intersects with a river
        if (blockX >= canvas.width || blockY >= canvas.height || blockIntersectsRiver(blockX, blockY)) continue;
        
        // Number of buildings per block (2-4 buildings)
        const blockRandom = multiRandom(seed + bx * 100 + by * 1000);
        const buildingsInBlock = 2 + Math.floor(blockRandom.extra * 3); // 2-4 buildings
        
        for (let b = 0; b < buildingsInBlock; b++) {
          const buildingRandom = multiRandom(seed + bx * 100 + by * 1000 + b * 50);
          
          // Calculate building dimensions with more variation
          const baseWidth = 50 + buildingRandom.size * 60;
          const buildingHeight = 80 + buildingRandom.y * 120;
          
          // Position buildings across the block width
          const buildingX = blockX + (b * (blockWidth / buildingsInBlock)) + 
                           (blockWidth / buildingsInBlock - baseWidth) / 2;
          const buildingY = blockY + blockHeight - buildingHeight;
          
          const colorIndex = Math.floor(buildingRandom.color * buildingColors.length);
          ctx.fillStyle = buildingColors[colorIndex];
          
          // Create more interesting building shapes (no tapering)
          const shapeType = Math.floor(buildingRandom.extra * 3); // 3 different shapes
          
          switch (shapeType) {
            case 0: // Standard rectangle
              ctx.fillRect(buildingX, buildingY, baseWidth, buildingHeight);
              break;
              
            case 1: { // Stepped building (different heights, same width)
              const numSteps = 3;
              const stepHeight = buildingHeight / numSteps;
              for (let s = 0; s < numSteps; s++) {
                const sectionY = buildingY + s * stepHeight;
                const sectionHeight = stepHeight * (numSteps - s); // Taller sections at bottom
                ctx.fillRect(buildingX, sectionY, baseWidth, sectionHeight);
              }
              break;
            }
              
            case 2: { // Multi-section building (different sections, same width)
              const section1Height = buildingHeight * 0.4;
              const section2Height = buildingHeight * 0.3;
              const section3Height = buildingHeight * 0.3;
              
              // Bottom section
              ctx.fillRect(buildingX, buildingY + section2Height + section3Height, baseWidth, section1Height);
              // Middle section
              ctx.fillRect(buildingX, buildingY + section3Height, baseWidth, section2Height);
              // Top section
              ctx.fillRect(buildingX, buildingY, baseWidth, section3Height);
              break;
            }
          }
          
          // Add windows - standard grid for all shapes
          const windowsPerRow = Math.floor(baseWidth / 12);
          const windowRows = Math.floor(buildingHeight / 18);
          for (let w = 0; w < windowsPerRow; w++) {
            for (let h = 0; h < windowRows; h++) {
              const windowRandom = multiRandom(seed + bx * 100 + by * 1000 + b * 50 + w * 10 + h);
              if (windowRandom.extra > 0.6) {
                ctx.fillStyle = "rgba(255, 255, 200, 0.6)";
                ctx.fillRect(
                  buildingX + 3 + w * 12,
                  buildingY + 6 + h * 18,
                  6,
                  10
                );
              }
            }
          }
        }
      }
    }
    
    // Draw rivers (natural blue water) - positioned at half-block offset, covering streets
    ctx.fillStyle = "rgba(100, 150, 200, 0.8)";
    for (const river of riverInfo) {
      if (river.type === 'vertical') {
        // Vertical river spanning full canvas height
        ctx.fillRect(river.position - river.width / 2, 0, river.width, canvas.height);
      } else {
        // Horizontal river spanning full canvas width
        ctx.fillRect(0, river.position - river.width / 2, canvas.width, river.width);
      }
    }
    
    // Draw bridges on top of rivers (only where authorized)
    bridgePositions.forEach((bridgeKey) => {
      const [direction, coord1Str, riverIndexStr] = (bridgeKey as string).split(',');
      const riverIndex = parseInt(riverIndexStr);
      const river = riverInfo[riverIndex];
      
      if (direction === 'h') {
        const by = parseInt(coord1Str);
        // Horizontal bridge crossing a vertical river
        const streetY = by * totalBlockUnitY + blockHeight;
        const bridgeStart = river.position - river.width / 2;
        const bridgeWidth = river.width;
        
        // Bridge surface (darker gray)
        ctx.fillStyle = "rgba(60, 60, 60, 0.9)";
        ctx.fillRect(bridgeStart, streetY, bridgeWidth, streetWidth);
        // Bridge railings
        ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
        ctx.fillRect(bridgeStart, streetY, bridgeWidth, 2);
        ctx.fillRect(bridgeStart, streetY + streetWidth - 2, bridgeWidth, 2);

      } else if (direction === 'v') {
        const bx = parseInt(coord1Str);
        // Vertical bridge crossing a horizontal river
        const streetX = bx * totalBlockUnitX + blockWidth;
        const bridgeStart = river.position - river.width / 2;
        const bridgeHeight = river.width;
        
        // Bridge surface (darker gray)
        ctx.fillStyle = "rgba(60, 60, 60, 0.9)";
        ctx.fillRect(streetX, bridgeStart, streetWidth, bridgeHeight);
        // Bridge railings
        ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
        ctx.fillRect(streetX, bridgeStart, 2, bridgeHeight);
        ctx.fillRect(streetX + streetWidth - 2, bridgeStart, 2, bridgeHeight);
      }
    });
    
    // Helper function to check if a vehicle intersects with any river
    const vehicleIntersectsRiver = (x: number, y: number, width: number, height: number) => {
      for (const river of riverInfo) {
        if (river.type === 'vertical') {
          // Check if vehicle intersects vertical river
          const riverLeft = river.position - river.width / 2;
          const riverRight = river.position + river.width / 2;
          if (x < riverRight && x + width > riverLeft) {
            return true;
          }
        } else {
          // Check if vehicle intersects horizontal river
          const riverTop = river.position - river.width / 2;
          const riverBottom = river.position + river.width / 2;
          if (y < riverBottom && y + height > riverTop) {
            return true;
          }
        }
      }
      return false;
    };

    // Helper function to check if a vehicle is on a bridge
    const vehicleOnBridge = (x: number, y: number, width: number, height: number) => {
      let isOnBridge = false;
      bridgePositions.forEach((bridgeKey) => {
        const [direction, coord1Str, riverIndexStr] = (bridgeKey as string).split(',');
        const riverIndex = parseInt(riverIndexStr);
        const river = riverInfo[riverIndex];
        
        if (direction === 'h') {
          const by = parseInt(coord1Str);
          const streetY = by * totalBlockUnitY + blockHeight;
          const bridgeStart = river.position - river.width / 2;
          const bridgeEnd = river.position + river.width / 2;
          
          // Check if vehicle is on this horizontal bridge
          if (y < streetY + streetWidth && y + height > streetY &&
              x < bridgeEnd && x + width > bridgeStart) {
            isOnBridge = true;
          }
        } else if (direction === 'v') {
          const bx = parseInt(coord1Str);
          const streetX = bx * totalBlockUnitX + blockWidth;
          const bridgeStart = river.position - river.width / 2;
          const bridgeEnd = river.position + river.width / 2;
          
          // Check if vehicle is on this vertical bridge
          if (x < streetX + streetWidth && x + width > streetX &&
              y < bridgeEnd && y + height > bridgeStart) {
            isOnBridge = true;
          }
        }
      });
      return isOnBridge;
    };
    
    // Draw vehicles on streets (one-way, alternating directions)
    // Horizontal street vehicles
    for (let by = 0; by < blocksY; by++) {
      const streetY = by * totalBlockUnitY + blockHeight;
      if (streetY < canvas.height) {
        const goingRight = by % 2 === 0;
        const vehiclesOnStreet = Math.floor(canvas.width / 120);
        
        for (let v = 0; v < vehiclesOnStreet; v++) {
          const vehicleRandom = multiRandom(seed + by * 500 + v * 50 + 2000);
          const vehicleX = v * 120 + vehicleRandom.x * 40;
          const vehicleY = streetY + 8;
          const vehicleWidth = 40 + vehicleRandom.size * 30;
          const vehicleHeight = 15;
          
          if (vehicleX + vehicleWidth < canvas.width) {
            // Only draw vehicle if it's on a bridge or not intersecting rivers
            const onBridge = vehicleOnBridge(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
            const intersectsRiver = vehicleIntersectsRiver(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
            
            if (onBridge || !intersectsRiver) {
              const colorIndex = Math.floor(vehicleRandom.color * vehicleColors.length);
              ctx.fillStyle = vehicleColors[colorIndex];
              ctx.fillRect(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
              
              // Add wheels
              ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
              ctx.fillRect(vehicleX + 5, vehicleY + vehicleHeight - 3, 5, 5);
              ctx.fillRect(vehicleX + vehicleWidth - 10, vehicleY + vehicleHeight - 3, 5, 5);
              
              // Add front and back details
              if (goingRight) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(vehicleX + vehicleWidth - 8, vehicleY + 2, 6, vehicleHeight - 4);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + 2, 6, vehicleHeight - 4);
              } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + 2, 6, vehicleHeight - 4);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(vehicleX + vehicleWidth - 8, vehicleY + 2, 6, vehicleHeight - 4);
              }
            }
          }
        }
      }
    }
    
    // Vertical street vehicles
    for (let bx = 0; bx < blocksX; bx++) {
      const streetX = bx * totalBlockUnitX + blockWidth;
      if (streetX < canvas.width) {
        const goingDown = bx % 2 === 0;
        const vehiclesOnStreet = Math.floor(canvas.height / 120);
        
        for (let v = 0; v < vehiclesOnStreet; v++) {
          const vehicleRandom = multiRandom(seed + bx * 500 + v * 50 + 3000);
          const vehicleX = streetX + 8;
          const vehicleY = v * 120 + vehicleRandom.y * 40;
          const vehicleWidth = 15;
          const vehicleHeight = 40 + vehicleRandom.size * 30;
          
          if (vehicleY + vehicleHeight < canvas.height) {
            // Only draw vehicle if it's on a bridge or not intersecting rivers
            const onBridge = vehicleOnBridge(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
            const intersectsRiver = vehicleIntersectsRiver(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
            
            if (onBridge || !intersectsRiver) {
              const colorIndex = Math.floor(vehicleRandom.color * vehicleColors.length);
              ctx.fillStyle = vehicleColors[colorIndex];
              ctx.fillRect(vehicleX, vehicleY, vehicleWidth, vehicleHeight);
              
              // Add wheels
              ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
              ctx.fillRect(vehicleX + vehicleWidth - 3, vehicleY + 5, 5, 5);
              ctx.fillRect(vehicleX + vehicleWidth - 3, vehicleY + vehicleHeight - 10, 5, 5);
              
              // Add front and back details
              if (goingDown) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + vehicleHeight - 8, vehicleWidth - 4, 6);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + 2, vehicleWidth - 4, 6);
              } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + 2, vehicleWidth - 4, 6);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(vehicleX + 2, vehicleY + vehicleHeight - 8, vehicleWidth - 4, 6);
              }
            }
          }
        }
      }
    }

    return canvas;
  };

  // Utility function to download current pattern as PNG
  const downloadPattern = () => {
    const canvas = createMosaicTexture();
    const link = document.createElement("a");
    link.download = `city-pattern-${seed}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Add to window for debugging (remove in production)
  if (typeof window !== "undefined") {
    (window as unknown as { downloadCityPattern: () => void }).downloadCityPattern = downloadPattern;
  }

  // Calculate repeat based on desired tile size (currently unused)
  // const desiredTileSize = 15; // World units per tile
  // const _repeatX = Math.max(1, Math.ceil(boundaries.width / desiredTileSize));
  // const _repeatY = Math.max(1, Math.ceil(boundaries.height / desiredTileSize));

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial
        // eslint-disable-next-line react/no-unknown-property
        transparent
        opacity={TERRAIN_PLANE_CONFIG.opacity}
        // eslint-disable-next-line react/no-unknown-property
        map={pngTexture || undefined}
      >
        {!usePngFile && (
          <canvasTexture
            // eslint-disable-next-line react/no-unknown-property
            attach="map"
            // eslint-disable-next-line react/no-unknown-property
            image={createMosaicTexture()}
            // eslint-disable-next-line react/no-unknown-property
            wrapS={THREE.ClampToEdgeWrapping}
            // eslint-disable-next-line react/no-unknown-property
            wrapT={THREE.ClampToEdgeWrapping}
          />
        )}
      </meshBasicMaterial>
    </mesh>
  );
}