import * as THREE from "three";
import React from "react";
import CloudBackground from "../components/backgrounds/CloudBackground";
import FloralPattern from "../components/backgrounds/FloralPattern";
import CosmicPattern from "../components/backgrounds/CosmicPattern";
import CityPattern from "../components/backgrounds/CityPattern";
import SnowflakePattern from "../components/backgrounds/SnowflakePattern";
import TerrainOutline from "../components/backgrounds/TerrainOutline";
import { Z_DEPTHS } from "shared/z-depths";
import { BackgroundString, BackgroundType, normalizeBackgroundType } from "shared/background-types";

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
  backgroundType: BackgroundString;
  seed: number;
}

export interface TerrainConfig {
  boundaries: TerrainBoundaries;
  walls: THREE.Mesh[] | null;
  backgroundType: BackgroundString;
  seed: number;
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
    seed: serverConfig.seed,
    renderBackground(): React.JSX.Element {
      return renderTerrainBackground(
        boundaries,
        serverConfig.backgroundType,
        serverConfig.seed
      );
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

  // Generate a fallback seed
  const fallbackSeed = Date.now() % 1000000;

  return {
    boundaries: boundaries,
    walls: null,
    backgroundType: BackgroundType.FLORAL,
    seed: fallbackSeed,
    renderBackground(): React.JSX.Element {
      // Don't render any pattern while loading - just show cloud backdrop
      return (
        <>
          <CloudBackground />
          <TerrainOutline boundaries={boundaries} seed={fallbackSeed} />
        </>
      );
    },
  };
}

// Create background pattern based on type
function renderTerrainBackground(
  boundaries: TerrainBoundaries,
  backgroundType: BackgroundString,
  seed: number
): React.JSX.Element {
  const renderPattern = () => {
    const normalizedType = normalizeBackgroundType(backgroundType);
    
    switch (normalizedType) {
      case BackgroundType.FLORAL:
        return <FloralPattern boundaries={boundaries} seed={seed} />;

      case BackgroundType.COSMIC:
        return <CosmicPattern boundaries={boundaries} seed={seed} />;

      case BackgroundType.CITY:
        return <CityPattern boundaries={boundaries} seed={seed} />;

      case BackgroundType.SNOWFLAKE:
        return <SnowflakePattern boundaries={boundaries} seed={seed} />;

      default:
        return <FloralPattern boundaries={boundaries} seed={seed} />;
    }
  };

  return (
    <>
      <CloudBackground />
      {renderPattern()}
      <TerrainOutline boundaries={boundaries} seed={seed} />
    </>
  );
}

export interface TerrainPlaneConfig {
  position: [number, number, number];
  opacity: number;
  zIndex: number;
}

export const TERRAIN_PLANE_CONFIG: TerrainPlaneConfig = {
  position: [0, 0, Z_DEPTHS.TERRAIN], // Same XY plane as animals, slightly behind
  opacity: 0.9,
  zIndex: Z_DEPTHS.TERRAIN,
};

export const CLOUD_PLANE_CONFIG: TerrainPlaneConfig = {
  position: [0, 0, Z_DEPTHS.CLOUDS], // Same XY plane as animals, further behind
  opacity: 1.0,
  zIndex: Z_DEPTHS.CLOUDS,
};

// Utility function to generate multiple random numbers from one seed
export const multiRandom = (seed: number) => {
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
