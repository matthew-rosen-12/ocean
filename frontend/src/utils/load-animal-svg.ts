import React from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { Animal, ANIMAL_ORIENTATION } from "shared/types";
import concaveman from "concaveman";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { Z_DEPTHS, RENDER_ORDERS } from "shared/z-depths";
import { svgWorkerManager } from "./SVGWorkerManager";

export const animalGraphicsCache = new Map<
  string,
  {
    texture: THREE.Texture;
    geometry: THREE.BufferGeometry;
    boundingBox: THREE.Box3;
    outlineLineGeometry: LineGeometry | null;
  }
>();

// Cache for intermediate SVG processing results
const svgDataCache = new Map<
  string,
  {
    data: any; // SVG loader data
    boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
    svgElement: SVGElement;
  }
>();

const textureCache = new Map<string, THREE.Texture>();
const outlineGeometryCache = new Map<string, { geometry: THREE.BufferGeometry; outlineShape: THREE.Shape | null }>();

// Cleanup function to dispose of all cached resources
export function disposeAnimalCaches(): void {
  // Dispose of animal graphics cache
  animalGraphicsCache.forEach((cached) => {
    if (cached.texture) {
      cached.texture.dispose();
    }
    if (cached.geometry) {
      cached.geometry.dispose();
    }
    if (cached.outlineLineGeometry) {
      cached.outlineLineGeometry.dispose();
    }
  });
  animalGraphicsCache.clear();

  // Dispose of texture cache
  textureCache.forEach((texture) => {
    texture.dispose();
  });
  textureCache.clear();

  // Dispose of outline geometry cache
  outlineGeometryCache.forEach((cached) => {
    if (cached.geometry) {
      cached.geometry.dispose();
    }
  });
  outlineGeometryCache.clear();

  // Clear SVG data cache
  svgDataCache.clear();
}

// File-based cache data structure
interface CachedAnimalData {
  animalName: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  paths: Array<{
    id: string;
    fill: string;
    d: string;
    points: [number, number][];
  }>;
  outline: [number, number][];
  outlinePath: { id: string; fill: string; d: string; points: [number, number][] } | null;
  originalSvg: string;
  timestamp: number;
}

// Load cached animal data from file
async function loadCachedAnimalData(animal: string): Promise<CachedAnimalData | null> {
  try {
    const response = await fetch(`/animal-cache/${animal}.json`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load cached data for ${animal}:`, error);
    return null;
  }
}

// Helper function to process SVG data and create cached intermediate results
async function processSVGData(animal: string, svgData: any): Promise<{
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  svgElement: SVGElement;
  texture: THREE.Texture;
}> {
  // Check if we already have cached SVG processing results
  let cachedSVGData = svgDataCache.get(animal);
  
  if (!cachedSVGData) {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidPoints = false;

    svgData.paths.forEach((path: any) => {
      path.subPaths.forEach((subPath: any) => {
        const points = subPath.getPoints();
        points.forEach((point: any) => {
          if (isFinite(point.x) && isFinite(point.y)) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
            hasValidPoints = true;
          }
        });
      });
    });

    // Validate bounding box
    if (!hasValidPoints || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.warn(`Invalid bounding box for animal ${animal}, using fallback`);
      minX = 0; minY = 0; maxX = 100; maxY = 100;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const finalWidth = Math.max(width, 1);
    const finalHeight = Math.max(height, 1);

    // Calculate texture scale factor for high resolution
    const targetTextureSize = 1024;
    const maxOriginalDim = Math.max(finalWidth, finalHeight);
    const textureScaleFactor = targetTextureSize / maxOriginalDim;
    const textureWidth = finalWidth * textureScaleFactor;
    const textureHeight = finalHeight * textureScaleFactor;

    // Create SVG element for texture generation
    const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute("width", textureWidth.toString());
    svgElement.setAttribute("height", textureHeight.toString());
    svgElement.setAttribute("viewBox", `${minX} ${minY} ${finalWidth} ${finalHeight}`);

    // Add paths to SVG element
    svgData.paths.forEach((path: any) => {
      const color = path.color || 0x000000;
      const shapes = path.toShapes(true);

      shapes.forEach((shape: any) => {
        const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const points = shape.getPoints();
        if (points.length > 0) {
          let pathData = `M ${points[0].x} ${points[0].y}`;
          for (let i = 1; i < points.length; i++) {
            pathData += ` L ${points[i].x} ${points[i].y}`;
          }
          pathData += " Z";
          pathElement.setAttribute("d", pathData);
          pathElement.setAttribute("fill", `#${color.getHex().toString(16).padStart(6, "0")}`);
          svgElement.appendChild(pathElement);
        }
      });
    });

    cachedSVGData = {
      data: svgData,
      boundingBox: { minX, minY, maxX, maxY, width: finalWidth, height: finalHeight },
      svgElement
    };
    
    svgDataCache.set(animal, cachedSVGData);
  }

  // Check texture cache
  let texture = textureCache.get(animal);
  if (!texture) {
    try {
      const textureScaleFactor = 1024 / Math.max(cachedSVGData.boundingBox.width, cachedSVGData.boundingBox.height);
      const textureWidth = cachedSVGData.boundingBox.width * textureScaleFactor;
      const textureHeight = cachedSVGData.boundingBox.height * textureScaleFactor;
      
      texture = await createSVGTexture(cachedSVGData.svgElement, textureWidth, textureHeight);
      textureCache.set(animal, texture);
    } catch (textureError) {
      console.warn("Failed to create SVG texture, using fallback:", textureError);
      const firstColor = cachedSVGData.data.paths.length > 0
        ? cachedSVGData.data.paths[0].color?.getHex() || 0x888888
        : 0x888888;
      texture = createFallbackTexture(firstColor);
      textureCache.set(animal, texture);
    }
  }

  return {
    boundingBox: cachedSVGData.boundingBox,
    svgElement: cachedSVGData.svgElement,
    texture
  };
}

// Helper function to get cached outline geometry
function getCachedOutlineGeometry(animal: string, svgData: any): { geometry: THREE.BufferGeometry; outlineShape: THREE.Shape | null } {
  let cached = outlineGeometryCache.get(animal);
  if (!cached) {
    cached = createGeometryFromOutlinePath(svgData);
    outlineGeometryCache.set(animal, cached);
  }
  return cached;
}

// Create geometry from cached outline data
function createGeometryFromCachedOutline(cachedData: CachedAnimalData): { geometry: THREE.BufferGeometry; outlineShape: THREE.Shape | null } {
  // Try to use the dedicated outline path first
  if (cachedData.outlinePath && cachedData.outlinePath.points.length > 0) {
    const points = cachedData.outlinePath.points.map(([x, y]) => new THREE.Vector2(x, y));
    const outlineShape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(outlineShape);
    geometry.scale(1, -1, 1); // Apply Y-flip like original
    return { geometry, outlineShape };
  }
  
  // Fall back to using the computed outline
  if (cachedData.outline.length > 2) {
    const points = cachedData.outline.map(([x, y]) => new THREE.Vector2(x, y));
    const outlineShape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(outlineShape);
    geometry.scale(1, -1, 1); // Apply Y-flip like original
    return { geometry, outlineShape };
  }
  
  // Last resort: create a rectangle based on bounds
  const { bounds } = cachedData;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const fallbackShape = new THREE.Shape();
  fallbackShape.moveTo(-width / 2, -height / 2);
  fallbackShape.lineTo(width / 2, -height / 2);
  fallbackShape.lineTo(width / 2, height / 2);
  fallbackShape.lineTo(-width / 2, height / 2);
  fallbackShape.closePath();
  
  const fallbackGeometry = new THREE.ShapeGeometry(fallbackShape);
  fallbackGeometry.scale(1, -1, 1);
  return { geometry: fallbackGeometry, outlineShape: fallbackShape };
}

// Create texture from cached SVG string
async function createTextureFromCachedSVG(cachedData: CachedAnimalData): Promise<THREE.Texture> {
  const targetTextureSize = 1024;
  const maxOriginalDim = Math.max(cachedData.width, cachedData.height);
  const textureScaleFactor = targetTextureSize / maxOriginalDim;
  const textureWidth = cachedData.width * textureScaleFactor;
  const textureHeight = cachedData.height * textureScaleFactor;

  // Try to use web worker for SVG processing if available
  if (svgWorkerManager.isWorkersAvailable()) {
    try {
      const workerResult = await svgWorkerManager.processSVG(
        cachedData.originalSvg,
        cachedData.animalName,
        textureScaleFactor
      );
      
      if (workerResult.success && workerResult.svgDataUrl) {
        // Create texture from worker-processed SVG
        return new Promise((resolve, reject) => {
          const loader = new THREE.TextureLoader();
          loader.load(
            workerResult.svgDataUrl,
            (texture) => {
              texture.flipY = false;
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.minFilter = THREE.NearestFilter;
              texture.magFilter = THREE.NearestFilter;
              texture.generateMipmaps = false;
              texture.needsUpdate = true;
              resolve(texture);
            },
            undefined,
            reject
          );
        });
      }
    } catch (workerError) {
      console.warn('Worker SVG processing failed, falling back to main thread:', workerError);
    }
  }

  // Fallback to main thread processing
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(cachedData.originalSvg, 'image/svg+xml');
  const svgElement = svgDoc.documentElement as unknown as SVGElement;
  
  // Update dimensions for high resolution
  svgElement.setAttribute('width', textureWidth.toString());
  svgElement.setAttribute('height', textureHeight.toString());
  
  return createSVGTexture(svgElement, textureWidth, textureHeight);
}

// Common function to finish loading animal (used by both cached and SVG loading paths)
async function finishLoadingAnimal(
  animal: Animal,
  group: THREE.Group,
  scale: number,
  isLocalPlayer: boolean,
  positionRef: React.MutableRefObject<THREE.Vector3>,
  directionRef: React.MutableRefObject<THREE.Vector3 | null>,
  initialScale: React.MutableRefObject<THREE.Vector3 | null>,
  previousRotation: React.MutableRefObject<number>,
  targetRotation: React.MutableRefObject<number>,
  svgLoaded: React.MutableRefObject<boolean>,
  previousPosition: THREE.Vector3,
  currentFlipState: React.MutableRefObject<number>,
  geometry: THREE.BufferGeometry,
  outlineShape: THREE.Shape | null,
  texture: THREE.Texture,
  _minX: number,
  _minY: number,
  _finalWidth: number,
  _finalHeight: number
): Promise<void> {
  // Create material with texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: false,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    opacity: 1.0,
    premultipliedAlpha: false,
    toneMapped: false,
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_GRAPHIC : RENDER_ORDERS.REMOTE_ANIMAL_GRAPHIC;
  mesh.position.z = isLocalPlayer ? Z_DEPTHS.LOCAL_ANIMAL_GRAPHIC : Z_DEPTHS.REMOTE_ANIMAL_GRAPHIC;

  // Center the geometry at origin and get the center offset
  geometry.computeBoundingBox();
  let centerOffset = new THREE.Vector3();
  if (geometry.boundingBox) {
    centerOffset = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
  }

  // Create LineGeometry from outline shape AFTER centering, applying the same offset
  let outlineLineGeometry: LineGeometry | null = null;
  if (outlineShape) {
    const points = outlineShape.getPoints();
    const linePositions: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const currentPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];

      linePositions.push(
        currentPoint.x - centerOffset.x,
        -currentPoint.y - centerOffset.y,
        0,
        nextPoint.x - centerOffset.x,
        -nextPoint.y - centerOffset.y,
        0
      );
    }

    outlineLineGeometry = new LineGeometry();
    outlineLineGeometry.setPositions(new Float32Array(linePositions));
  }

  group.add(mesh);

  // Cache the results
  animalGraphicsCache.set(animal, {
    texture: texture,
    geometry: geometry,
    boundingBox: new THREE.Box3().setFromObject(group),
    outlineLineGeometry: outlineLineGeometry,
  });

  // Scale the group
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y);
  const normalizeScale = 5 / maxDim;

  group.scale.multiplyScalar(normalizeScale * scale);

  // Apply initial orientation
  const orientation = ANIMAL_ORIENTATION[animal] || { rotation: 0, flipY: false };
  group.rotation.z = orientation.rotation;
  if (orientation.flipY) {
    group.scale.x = -group.scale.x;
  }

  // After scaling AND orientation, measure width and height (for reference, but not stored)
  const scaledBox = new THREE.Box3().setFromObject(group);
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  
  // Dimensions are now calculated deterministically using getAnimalDimensions()

  // Store the initial scale AFTER applying orientation flips
  initialScale.current = group.scale.clone();

  // Reset rotation references
  previousRotation.current = 0;
  targetRotation.current = 0;
  svgLoaded.current = true;

  // Set initial position
  previousPosition.copy(positionRef.current);
  group.position.copy(previousPosition);

  // Apply initial rotation based on directionRef if available
  if (directionRef.current && directionRef.current.length() > 0.01) {
    const direction = directionRef.current.clone().normalize();
    const angle = Math.atan2(direction.y, direction.x);

    previousRotation.current = angle;
    targetRotation.current = angle;
    group.rotation.z = angle;

    // Set initial flip state based on x direction
    if (direction.x < 0 && initialScale.current) {
      if (currentFlipState.current > 0) {
        currentFlipState.current = -1;
        group.scale.set(
          initialScale.current.x,
          -initialScale.current.y,
          initialScale.current.z
        );
      }
    }
  }
}

// Utility function to create edge geometry from a base geometry
export function createEdgeGeometry(
  color: THREE.Color | string | number,
  isLocalPlayer: boolean = false,
  outlineLineGeometry?: LineGeometry | null,
  fallbackGeometry?: THREE.BufferGeometry,
  renderOrder?: number
): THREE.Object3D {
  let lineSegmentsGeometry: LineGeometry;

  if (outlineLineGeometry) {
    // Use the provided LineGeometry directly
    lineSegmentsGeometry = outlineLineGeometry;
  } else if (fallbackGeometry) {
    // Fallback to EdgesGeometry
    const edgeGeometry = new THREE.EdgesGeometry(fallbackGeometry);
    const positions = new Float32Array(edgeGeometry.attributes.position.array);

    lineSegmentsGeometry = new LineGeometry();
    lineSegmentsGeometry.setPositions(positions);
  } else {
    // Create empty LineGeometry as last resort
    lineSegmentsGeometry = new LineGeometry();
    lineSegmentsGeometry.setPositions(new Float32Array([]));
  }

  const edgeMaterial = new LineMaterial({
    color: color,
    linewidth: 10.0,
    transparent: false,
    opacity: 1.0,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  const edgeLines = new LineSegments2(lineSegmentsGeometry, edgeMaterial);
  
  const finalRenderOrder = renderOrder ?? (isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_OUTLINE : RENDER_ORDERS.REMOTE_ANIMAL_OUTLINE);
  edgeLines.renderOrder = finalRenderOrder;
  
  // Set z-depth based on render order for consistent depth sorting
  if (isLocalPlayer) {
    edgeLines.position.z = Z_DEPTHS.LOCAL_ANIMAL_OUTLINE;
  } else {
    edgeLines.position.z = Z_DEPTHS.REMOTE_ANIMAL_OUTLINE;
  }

  edgeLines.matrixAutoUpdate = true;

  return edgeLines;
}

// Create a fallback texture with a solid color
function createFallbackTexture(color: number = 0x888888): THREE.Texture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 64;
  canvas.height = 64;

  if (ctx) {
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.flipY = false;

  return texture;
}

// Create texture from SVG by rendering it to canvas
function createSVGTexture(
  svgElement: SVGElement,
  _width: number,
  _height: number
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        svgString
      )}`;

      const loader = new THREE.TextureLoader();

      const _texture = loader.load(
        svgDataUrl,
        (loadedTexture) => {
          // Key color preservation settings:
          loadedTexture.flipY = false;

          // Color space - try different options:
          loadedTexture.colorSpace = THREE.SRGBColorSpace; // Try this first
          // loadedTexture.colorSpace = THREE.LinearSRGBColorSpace; // Alternative
          //   loadedTexture.colorSpace = THREE.NoColorSpace; // Last resort

          // Alpha handling - this is often the culprit:
          //   loadedTexture.premultiplyAlpha = false; // IMPORTANT: prevents color washing

          // Filtering - use nearest for exact color preservation:
          loadedTexture.minFilter = THREE.NearestFilter;
          loadedTexture.magFilter = THREE.NearestFilter;
          // Or try linear if nearest looks too pixelated:
          //   loadedTexture.minFilter = THREE.LinearFilter;
          //   loadedTexture.magFilter = THREE.LinearFilter;

          // Disable mipmaps to prevent color averaging:
          loadedTexture.generateMipmaps = false;

          loadedTexture.needsUpdate = true;
          resolve(loadedTexture);
        },
        undefined,
        (error) => {
          reject(new Error(`Failed to load SVG texture: ${error}`));
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// Improved outline extraction using concaveman for better shape detection
function createDetailedOutlineGeometry(svgData: any): THREE.BufferGeometry {
  const allPoints: [number, number][] = [];

  // Collect all points from all paths
  svgData.paths.forEach((path: any) => {
    const shapes = path.toShapes(true);
    shapes.forEach((shape: THREE.Shape) => {
      const points = shape.getPoints();
      points.forEach((point) => {
        allPoints.push([point.x, point.y]);
      });
    });
  });

  if (allPoints.length < 3) {
    console.warn("Not enough points for concave hull, using simple rectangle");
    return new THREE.PlaneGeometry(1, 1);
  }

  try {
    // Use concaveman to create a concave hull of all points
    // concavity = 2 gives a good balance between detail and simplicity
    const hullPoints = concaveman(allPoints, 5);

    if (hullPoints.length < 3) {
      throw new Error("Hull has too few points");
    }

    // Convert hull points to THREE.Vector2 for shape creation
    const shapePoints = hullPoints.map(([x, y]) => new THREE.Vector2(x, y));

    // Create a shape from the hull points
    const shape = new THREE.Shape(shapePoints);

    // Create geometry from shape
    const geometry = new THREE.ShapeGeometry(shape);

    // Flip Y coordinate to match SVG coordinate system
    geometry.scale(1, -1, 1);

    console.log(
      `[SVG LOADER] Created concave hull with ${hullPoints.length} points from ${allPoints.length} original points`
    );

    return geometry;
  } catch (error) {
    console.warn(
      "Failed to create concave hull, falling back to simple rectangle:",
      error
    );

    // Fallback: create a simple rectangle based on bounding box
    if (allPoints.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      allPoints.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });

      const width = maxX - minX;
      const height = maxY - minY;
      const fallbackShape = new THREE.Shape();
      fallbackShape.moveTo(-width / 2, -height / 2);
      fallbackShape.lineTo(width / 2, -height / 2);
      fallbackShape.lineTo(width / 2, height / 2);
      fallbackShape.lineTo(-width / 2, height / 2);
      fallbackShape.closePath();

      const fallbackGeometry = new THREE.ShapeGeometry(fallbackShape);
      fallbackGeometry.scale(1, -1, 1);
      return fallbackGeometry;
    }

    return new THREE.PlaneGeometry(1, 1);
  }
}

function createGeometryFromOutlinePath(
  svgData: any,
  outlineId: string = "outline"
): { geometry: THREE.BufferGeometry; outlineShape: THREE.Shape | null } {
  // Find the outline path specifically
  const outlinePath = svgData.paths.find(
    (path: any) =>
      path.userData && path.userData.node && path.userData.node.id === outlineId
  );

  if (!outlinePath) {
    console.warn(`No outline path found with id "${outlineId}"`);
    return {
      geometry: createDetailedOutlineGeometry(svgData),
      outlineShape: null,
    }; // fallback
  }

  

  // Create geometry from just the outline path
  const shapes = outlinePath.toShapes(true);

  if (shapes.length === 0) {
    console.warn("Outline path created no shapes");
    return {
      geometry: new THREE.PlaneGeometry(1, 1),
      outlineShape: null,
    };
  }

  // Use the first (and usually only) shape
  const outlineShape = shapes[0];
  const geometry = new THREE.ShapeGeometry(outlineShape);

  // Apply the standard transformations
  geometry.scale(1, -1, 1);

  return { geometry, outlineShape };
}

// Set up proper UV coordinates for texture mapping
function setupUVCoordinates(
  geometry: THREE.BufferGeometry,
  svgMinX: number,
  svgMinY: number,
  svgWidth: number,
  svgHeight: number
): void {
  const positions = geometry.attributes.position;
  if (!positions) {
    console.warn("Geometry has no position attribute for UV mapping");
    return;
  }

  const uvs: number[] = [];

  // Note: The geometry has been transformed with scale(1, -1, 1) and translated to center
  // We need to map the current vertex positions back to the original SVG coordinate space
  // to get proper UV coordinates

  // First, compute the current bounding box to understand the transformation
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) {
    console.warn("Could not compute bounding box for UV mapping");
    return;
  }

  const bbox = geometry.boundingBox;
  const _geoWidth = bbox.max.x - bbox.min.x;
  const _geoHeight = bbox.max.y - bbox.min.y;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);

    // // Method 1: Map based on current geometry bounds (recommended)
    // // This should work regardless of transformations applied to geometry
    // const u = (x - bbox.min.x) / geoWidth;
    // const v = (y - bbox.min.y) / geoHeight;

    // // Clamp values to 0-1 range
    // uvs.push(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));

    // Alternative Method 2: If Method 1 doesn't work, try this approach
    // Map vertices back to original SVG space (accounting for transformations)
    const originalX = x; // If geometry was translated, add back the translation
    const originalY = -y; // Account for Y flip from scale(1, -1, 1)
    const u = (originalX - svgMinX) / svgWidth;
    const v = (originalY - svgMinY) / svgHeight; // Flip V for texture
    uvs.push(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }

  // Set UV attribute
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.attributes.uv.needsUpdate = true;

}

/**
 * Batch load multiple animals using web workers for better performance
 */
export async function loadAnimalSVGBatch(
  animals: Array<{
    animal: Animal;
    group: THREE.Group;
    scale: number;
    isLocalPlayer: boolean;
    positionRef: React.MutableRefObject<THREE.Vector3>;
    directionRef: React.MutableRefObject<THREE.Vector3 | null>;
    initialScale: React.MutableRefObject<THREE.Vector3 | null>;
    previousRotation: React.MutableRefObject<number>;
    targetRotation: React.MutableRefObject<number>;
    svgLoaded: React.MutableRefObject<boolean>;
    previousPosition: THREE.Vector3;
    currentFlipState: React.MutableRefObject<number>;
  }>
): Promise<void[]> {
  // First, try to load any cached data
  const cachedLoads = animals.map(async (animalData) => {
    const cachedData = await loadCachedAnimalData(animalData.animal);
    return { ...animalData, cachedData };
  });
  
  const animalDataWithCache = await Promise.all(cachedLoads);
  
  // Separate cached and non-cached animals
  const cachedAnimals = animalDataWithCache.filter(data => data.cachedData);
  const nonCachedAnimals = animalDataWithCache.filter(data => !data.cachedData);
  
  // Process cached animals immediately
  const cachedPromises = cachedAnimals.map(async (data) => {
    return loadAnimalSVG(
      data.animal, data.group, data.scale, data.isLocalPlayer, 
      data.positionRef, data.directionRef,
      data.initialScale, data.previousRotation, data.targetRotation,
      data.svgLoaded, data.previousPosition, data.currentFlipState
    );
  });
  
  // For non-cached animals, try to use worker batch processing
  let nonCachedPromises: Promise<void>[] = [];
  
  if (nonCachedAnimals.length > 0 && svgWorkerManager.isWorkersAvailable()) {
    try {
      // Load SVG content for batch processing
      const svgContents = await Promise.all(
        nonCachedAnimals.map(async (data) => {
          try {
            const response = await fetch(`/public/animals/${data.animal}.svg`);
            const svgContent = await response.text();
            return { ...data, svgContent };
          } catch (error) {
            console.warn(`Failed to load SVG for ${data.animal}:`, error);
            return { ...data, svgContent: null };
          }
        })
      );
      
      // Filter out failed loads and prepare for batch processing
      const validSVGs = svgContents.filter(data => data.svgContent);
      
      if (validSVGs.length > 0) {
        // Use worker batch processing
        const svgBatch = validSVGs.map(data => ({
          svgContent: data.svgContent!,
          animal: data.animal,
          scale: 1, // Worker will scale, we'll handle final scaling later
        }));
        
        const batchResults = await svgWorkerManager.processSVGBatch(svgBatch);
        
        // Process results and create final animal graphics
        nonCachedPromises = validSVGs.map(async (data, index) => {
          const workerResult = batchResults[index];
          if (workerResult && workerResult.success) {
            // Use worker result to speed up texture creation
            // Fall through to regular loadAnimalSVG for now, but this could be optimized further
          }
          
          return loadAnimalSVG(
            data.animal, data.group, data.scale, data.isLocalPlayer,
            data.positionRef, data.directionRef,
            data.initialScale, data.previousRotation, data.targetRotation,
            data.svgLoaded, data.previousPosition, data.currentFlipState
          );
        });
      } else {
        // All SVG loads failed, fall back to individual loading
        nonCachedPromises = nonCachedAnimals.map(data => 
          loadAnimalSVG(
            data.animal, data.group, data.scale, data.isLocalPlayer,
            data.positionRef, data.directionRef,
            data.initialScale, data.previousRotation, data.targetRotation,
            data.svgLoaded, data.previousPosition, data.currentFlipState
          )
        );
      }
    } catch (batchError) {
      console.warn('Batch SVG processing failed, falling back to individual loading:', batchError);
      nonCachedPromises = nonCachedAnimals.map(data =>
        loadAnimalSVG(
          data.animal, data.group, data.scale, data.isLocalPlayer,
          data.positionRef, data.directionRef,
          data.initialScale, data.previousRotation, data.targetRotation,
          data.svgLoaded, data.previousPosition, data.currentFlipState
        )
      );
    }
  } else {
    // No workers available, use individual loading
    nonCachedPromises = nonCachedAnimals.map(data =>
      loadAnimalSVG(
        data.animal, data.group, data.scale, data.isLocalPlayer,
        data.positionRef, data.directionRef,
        data.initialScale, data.previousRotation, data.targetRotation,
        data.svgLoaded, data.previousPosition, data.currentFlipState
      )
    );
  }
  
  // Return all promises
  return Promise.all([...cachedPromises, ...nonCachedPromises]);
}

export function loadAnimalSVG(
  animal: Animal,
  group: THREE.Group,
  scale: number,
  isLocalPlayer: boolean,
  positionRef: React.MutableRefObject<THREE.Vector3>,
  directionRef: React.MutableRefObject<THREE.Vector3 | null>,
  initialScale: React.MutableRefObject<THREE.Vector3 | null>,
  previousRotation: React.MutableRefObject<number>,
  targetRotation: React.MutableRefObject<number>,
  svgLoaded: React.MutableRefObject<boolean>,
  previousPosition: THREE.Vector3,
  currentFlipState: React.MutableRefObject<number>
): Promise<void> {
  return new Promise(async (resolve) => {
    // Try to load from cache first
    const cachedData = await loadCachedAnimalData(animal);
    
    if (cachedData) {
      
      try {
        // Create geometry from cached outline data
        const { geometry, outlineShape } = createGeometryFromCachedOutline(cachedData);
        
        // Create texture from cached SVG
        let texture: THREE.Texture;
        try {
          texture = await createTextureFromCachedSVG(cachedData);
        } catch (textureError) {
          console.warn("Failed to create texture from cached SVG, using fallback:", textureError);
          texture = createFallbackTexture(0x888888);
        }
        
        const { bounds } = cachedData;
        const { minX, minY, width: finalWidth, height: finalHeight } = {
          minX: bounds.minX,
          minY: bounds.minY,
          width: cachedData.width,
          height: cachedData.height
        };

        // Set up UV coordinates BEFORE centering the geometry
        setupUVCoordinates(geometry, minX, minY, finalWidth, finalHeight);
        
        // Continue with the rest of the loading process using cached data
        await finishLoadingAnimal(
          animal, group, scale, isLocalPlayer,
          positionRef, directionRef, initialScale, previousRotation,
          targetRotation, svgLoaded, previousPosition, currentFlipState,
          geometry, outlineShape, texture, minX, minY, finalWidth, finalHeight
        );
        
        resolve();
        return;
      } catch (error) {
        console.warn(`Failed to load ${animal} from cache, falling back to SVG:`, error);
      }
    }

    // Fall back to original SVG loading
    
    const loader = new SVGLoader();

    loader.load(
      `/public/animals/${animal}.svg`,
      async (data) => {

        try {
          // Validate that we have paths with data
          if (!data.paths || data.paths.length === 0) {
            throw new Error(`No paths found in SVG for animal: ${animal}`);
          }

          // Use cached processing for SVG data, bounding box, and texture
          const { boundingBox, texture } = await processSVGData(animal, data);
          const { minX, minY, width: finalWidth, height: finalHeight } = boundingBox;

          // Create outline geometry using cache - always try to use the actual SVG shape
          const { geometry, outlineShape } = getCachedOutlineGeometry(animal, data);

          // Set up UV coordinates BEFORE centering the geometry
          // This ensures UV mapping corresponds to the original geometry layout
          setupUVCoordinates(geometry, minX, minY, finalWidth, finalHeight);
          
          // Continue with the rest of the loading process
          await finishLoadingAnimal(
            animal, group, scale, isLocalPlayer,
            positionRef, directionRef, initialScale, previousRotation,
            targetRotation, svgLoaded, previousPosition, currentFlipState,
            geometry, outlineShape, texture, minX, minY, finalWidth, finalHeight
          );
          
          resolve();
        } catch (error) {
          console.error("Error processing SVG:", error);

          // Create complete fallback when SVG processing fails
          console.warn(`Creating fallback graphics for animal: ${animal}`);

          // Try to create geometry from the SVG data if available
          let fallbackGeometry: THREE.BufferGeometry;
          try {
            if (data && data.paths && data.paths.length > 0) {
              fallbackGeometry = createDetailedOutlineGeometry(data);
            } else {
              throw new Error("No SVG data available");
            }
          } catch (geometryError) {
            console.warn(
              "Could not create geometry from SVG, using plane:",
              geometryError
            );
            fallbackGeometry = new THREE.PlaneGeometry(1, 1);
          }

          // Create a simple colored texture as fallback
          const fallbackTexture = createFallbackTexture(0x888888);

          // Set up basic UV coordinates for fallback geometry
          if (fallbackGeometry.attributes.position) {
            const positions = fallbackGeometry.attributes.position;
            const uvs: number[] = [];

            // Simple UV mapping for plane geometry
            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);

              // Map to 0-1 range (assuming plane is -0.5 to 0.5)
              uvs.push(x + 0.5, y + 0.5);
            }

            fallbackGeometry.setAttribute(
              "uv",
              new THREE.Float32BufferAttribute(uvs, 2)
            );
          }

          // Create material with texture
          const material = new THREE.MeshBasicMaterial({
            map: fallbackTexture,
            transparent: false,
            side: THREE.DoubleSide,
            depthWrite: true,
            depthTest: true,
            // Use green for fallback to distinguish from main case
            color: 0x00ff00,
          });

          // Create mesh
          const mesh = new THREE.Mesh(fallbackGeometry, material);
          mesh.renderOrder = isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_GRAPHIC : RENDER_ORDERS.REMOTE_ANIMAL_GRAPHIC;
          mesh.position.z = isLocalPlayer ? Z_DEPTHS.LOCAL_ANIMAL_GRAPHIC : Z_DEPTHS.REMOTE_ANIMAL_GRAPHIC;

          // Center the geometry at origin
          fallbackGeometry.computeBoundingBox();
          if (fallbackGeometry.boundingBox) {
            const center = fallbackGeometry.boundingBox.getCenter(
              new THREE.Vector3()
            );
            fallbackGeometry.translate(-center.x, -center.y, -center.z);
            console.log(
              `[SVG LOADER] Centered fallback geometry for ${animal}, was at:`,
              center.toArray()
            );
          }

          group.add(mesh);

          // Cache the fallback results
          animalGraphicsCache.set(animal, {
            texture: fallbackTexture,
            geometry: fallbackGeometry,
            boundingBox: new THREE.Box3().setFromObject(group),
            outlineLineGeometry: null,
          });

          // Scale the group
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y);
          const normalizeScale = 5 / maxDim;

          group.scale.multiplyScalar(normalizeScale * scale); // Back to normal scale

          // Apply initial orientation
          const orientation = ANIMAL_ORIENTATION[animal] || {
            rotation: 0,
            flipY: false,
          };

          group.rotation.z = orientation.rotation;
          if (orientation.flipY) {
            group.scale.x = -group.scale.x;
          }

          // After scaling AND orientation, measure width and height
          const scaledBox = new THREE.Box3().setFromObject(group);
          const scaledSize = scaledBox.getSize(new THREE.Vector3());
          
          // Dimensions are now calculated deterministically

          // Store the initial scale AFTER applying orientation flips
          initialScale.current = group.scale.clone();

          // Reset rotation references
          previousRotation.current = 0;
          targetRotation.current = 0;
          svgLoaded.current = true;

          // Set initial position
          previousPosition.copy(positionRef.current);
          group.position.copy(previousPosition);

          // Apply initial rotation based on directionRef if available
          if (directionRef.current && directionRef.current.length() > 0.01) {
            const direction = directionRef.current.clone().normalize();
            const angle = Math.atan2(direction.y, direction.x);

            previousRotation.current = angle;
            targetRotation.current = angle;
            group.rotation.z = angle;

            // Set initial flip state based on x direction
            if (direction.x < 0 && initialScale.current) {
              if (currentFlipState.current > 0) {
                currentFlipState.current = -1;
                group.scale.set(
                  initialScale.current.x,
                  -initialScale.current.y,
                  initialScale.current.z
                );
              }
            }
          }

          resolve(); // Resolve with fallback instead of rejecting
        }
      },
      undefined,
      (error) => {
        console.error("Error loading SVG:", error);
        resolve(); // Resolve with fallback instead of rejecting
      }
    );
  });
}
