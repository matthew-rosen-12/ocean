import { useMemo } from "react";
import * as THREE from "three";

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Hook to calculate viewport bounds for culling off-screen entities
 * Returns whether a position is within the visible viewport
 */
export function useViewportCulling(
  cameraPosition: THREE.Vector3,
  viewDistance: number = 60, // Distance from camera to consider "visible"
  bufferFactor: number = 1.2 // Extra buffer to prevent pop-in at edges
) {
  const viewportBounds = useMemo((): ViewportBounds => {
    const adjustedDistance = viewDistance * bufferFactor;
    
    return {
      minX: cameraPosition.x - adjustedDistance,
      maxX: cameraPosition.x + adjustedDistance,
      minY: cameraPosition.y - adjustedDistance,
      maxY: cameraPosition.y + adjustedDistance,
    };
  }, [cameraPosition.x, cameraPosition.y, viewDistance, bufferFactor]);

  const isInViewport = useMemo(() => {
    return (position: { x: number; y: number }) => {
      return (
        position.x >= viewportBounds.minX &&
        position.x <= viewportBounds.maxX &&
        position.y >= viewportBounds.minY &&
        position.y <= viewportBounds.maxY
      );
    };
  }, [viewportBounds]);

  const getDistanceFromCamera = useMemo(() => {
    return (position: { x: number; y: number }) => {
      const dx = position.x - cameraPosition.x;
      const dy = position.y - cameraPosition.y;
      return Math.sqrt(dx * dx + dy * dy);
    };
  }, [cameraPosition.x, cameraPosition.y]);

  return {
    viewportBounds,
    isInViewport,
    getDistanceFromCamera,
  };
}