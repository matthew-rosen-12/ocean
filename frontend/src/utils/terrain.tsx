import * as THREE from "three";
import React from "react";
import CloudBackground from "../components/backgrounds/CloudBackground";
import FloralPattern from "../components/backgrounds/FloralPattern";
import ForestPattern from "../components/backgrounds/ForestPattern";
import AnimalPattern from "../components/backgrounds/AnimalPattern";
import CosmicPattern from "../components/backgrounds/CosmicPattern";

// Terrain system configuration
export class TerrainBoundaries {
  constructor(
    public minX: number,
    public maxX: number,
    public minY: number,
    public maxY: number
  ) {}

  get width() {
    return this.maxX - this.minX;
  }

  get height() {
    return this.maxY - this.minY;
  }

  // Utility function to wrap positions around boundaries
  wrapPosition(position: THREE.Vector3): THREE.Vector3 {
    const wrapped = position.clone();

    // Wrap X coordinate
    wrapped.x =
      ((((wrapped.x - this.minX) % this.width) + this.width) % this.width) +
      this.minX;

    // Wrap Y coordinate
    wrapped.y =
      ((((wrapped.y - this.minY) % this.height) + this.height) % this.height) +
      this.minY;

    return wrapped;
  }

  // Utility function to wrap a simple {x, y} object
  wrapPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x:
        ((((point.x - this.minX) % this.width) + this.width) % this.width) +
        this.minX,
      y:
        ((((point.y - this.minY) % this.height) + this.height) % this.height) +
        this.minY,
    };
  }

  // Calculate shortest distance between two positions considering wrapping
  shortestDistance(
    pos1: THREE.Vector3,
    pos2: THREE.Vector3
  ): { dx: number; dy: number; distance: number } {
    // Direct distances
    const directDx = pos2.x - pos1.x;
    const directDy = pos2.y - pos1.y;

    // Wrap-around distances
    const wrapDx =
      directDx > 0
        ? directDx - this.width // If moving right, try going left through wrap
        : directDx + this.width; // If moving left, try going right through wrap

    const wrapDy =
      directDy > 0
        ? directDy - this.height // If moving up, try going down through wrap
        : directDy + this.height; // If moving down, try going up through wrap

    // Choose shortest path for each axis
    const shortestDx =
      Math.abs(directDx) <= Math.abs(wrapDx) ? directDx : wrapDx;
    const shortestDy =
      Math.abs(directDy) <= Math.abs(wrapDy) ? directDy : wrapDy;

    const distance = Math.sqrt(
      shortestDx * shortestDx + shortestDy * shortestDy
    );

    return { dx: shortestDx, dy: shortestDy, distance };
  }

  // Wrap-aware lerp function
  wrapLerp(
    current: THREE.Vector3,
    target: THREE.Vector3,
    t: number
  ): THREE.Vector3 {
    const { dx, dy } = this.shortestDistance(current, target);

    const newPosition = new THREE.Vector3(
      current.x + dx * t,
      current.y + dy * t,
      current.z + (target.z - current.z) * t // Z doesn't wrap
    );

    // Wrap the result to ensure it stays in bounds
    return this.wrapPosition(newPosition);
  }
}

// Server terrain config interface
export interface ServerTerrainConfig {
  boundaries: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  gridSize: number;
  walls: null;
  backgroundType: string;
}

export interface TerrainConfig {
  boundaries: TerrainBoundaries;
  walls: THREE.Mesh[] | null;
  backgroundType: string;
  renderBackground(): React.JSX.Element;
}

// Create terrain from server configuration
export function createTerrainFromServer(
  serverConfig: ServerTerrainConfig
): TerrainConfig {
  const boundaries = new TerrainBoundaries(
    serverConfig.boundaries.minX,
    serverConfig.boundaries.maxX,
    serverConfig.boundaries.minY,
    serverConfig.boundaries.maxY
  );

  return {
    boundaries: boundaries,
    walls: null,
    backgroundType: serverConfig.backgroundType,
    renderBackground(): React.JSX.Element {
      return renderTerrainBackground(boundaries, serverConfig.backgroundType);
    },
  };
}

// Fallback terrain creation (for backward compatibility)
export function createTerrain(): TerrainConfig {
  // Based on WaveGrid: size = 100, so boundaries are -50 to +50
  const gridSize = 100;
  const halfSize = gridSize / 2;
  const boundaries = new TerrainBoundaries(
    -halfSize,
    halfSize,
    -halfSize,
    halfSize
  );

  return {
    boundaries: boundaries,
    walls: null,
    backgroundType: "floral",
    renderBackground(): React.JSX.Element {
      return renderTerrainBackground(boundaries, "floral");
    },
  };
}

// Create background pattern based on type
function renderTerrainBackground(
  boundaries: TerrainBoundaries,
  backgroundType: string
): React.JSX.Element {
  const renderPattern = () => {
    switch (backgroundType) {
      case "floral":
      case "grass":
        return <FloralPattern boundaries={boundaries} />;

      case "forest":
        return <ForestPattern boundaries={boundaries} />;

      case "animals":
      case "sand":
        return <AnimalPattern boundaries={boundaries} />;

      case "cosmic":
      case "rock":
        return <CosmicPattern boundaries={boundaries} />;

      default:
        return <FloralPattern boundaries={boundaries} />;
    }
  };

  return (
    <>
      <CloudBackground />
      {renderPattern()}
    </>
  );
}

export interface TerrainPlaneConfig {
  position: [number, number, number];
  opacity: number;
  zIndex: number;
}

export const TERRAIN_PLANE_CONFIG: TerrainPlaneConfig = {
  position: [0, 0, -0.1], // Same XY plane as animals, slightly behind
  opacity: 0.9,
  zIndex: -0.1,
};

export const CLOUD_PLANE_CONFIG: TerrainPlaneConfig = {
  position: [0, 0, -0.2], // Same XY plane as animals, further behind
  opacity: 1.0,
  zIndex: -0.2,
};
