import React from "react";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { Animal } from "../utils/types";

export const animalGraphicsCache = new Map<
  string,
  {
    texture: THREE.Texture;
    geometry: THREE.BufferGeometry;
    boundingBox: THREE.Box3;
  }
>();

export const ANIMAL_ORIENTATION = {
  WOLF: { rotation: 0, flipY: true },
  DOLPHIN: { rotation: 0, flipY: false },
};

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

// Create a cutting shape from PNG alpha channel
function createShapeFromPNGAlpha(
  imageData: ImageData,
  threshold: number = 128
): THREE.Shape[] {
  const { width, height, data } = imageData;

  // Find contours of opaque regions
  const visited = new Array(width * height).fill(false);
  const shapes: THREE.Shape[] = [];

  // Simple flood-fill to find connected opaque regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (visited[index]) continue;

      const pixelIndex = index * 4;
      const alpha = data[pixelIndex + 3];

      if (alpha > threshold) {
        // Found an opaque pixel, trace its boundary
        const boundary = traceBoundary(imageData, x, y, threshold);
        if (boundary.length > 3) {
          // Convert pixel coordinates to normalized coordinates
          const normalizedPoints = boundary.map(
            (point) =>
              new THREE.Vector2(
                point.x / width - 0.5, // Center and normalize X
                -(point.y / height - 0.5) // Center, normalize, and flip Y
              )
          );

          const shape = new THREE.Shape(normalizedPoints);
          shapes.push(shape);
        }

        // Mark this region as visited
        floodFillVisited(imageData, x, y, threshold, visited, width, height);
      }
    }
  }

  return shapes;
}

// Simple boundary tracing (Moore neighborhood)
function traceBoundary(
  imageData: ImageData,
  startX: number,
  startY: number,
  threshold: number
): Array<{ x: number; y: number }> {
  const { width, height, data } = imageData;
  const boundary: Array<{ x: number; y: number }> = [];

  // Find the boundary by walking around the shape
  // This is a simplified version - for complex shapes you'd want a proper algorithm
  const visited = new Set<string>();
  const queue = [{ x: startX, y: startY }];

  while (queue.length > 0 && boundary.length < 1000) {
    // Limit to prevent infinite loops
    const current = queue.shift()!;
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) continue;
    visited.add(key);

    const pixelIndex = (current.y * width + current.x) * 4;
    const alpha = data[pixelIndex + 3];

    if (alpha > threshold) {
      // Check if this is a boundary pixel (has transparent neighbors)
      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
      ];

      const hasTransparentNeighbor = neighbors.some((neighbor) => {
        if (
          neighbor.x < 0 ||
          neighbor.x >= width ||
          neighbor.y < 0 ||
          neighbor.y >= height
        ) {
          return true; // Edge of image counts as transparent
        }
        const neighborIndex = (neighbor.y * width + neighbor.x) * 4;
        return data[neighborIndex + 3] <= threshold;
      });

      if (hasTransparentNeighbor) {
        boundary.push(current);
      }

      // Add opaque neighbors to queue
      neighbors.forEach((neighbor) => {
        if (
          neighbor.x >= 0 &&
          neighbor.x < width &&
          neighbor.y >= 0 &&
          neighbor.y < height
        ) {
          const neighborIndex = (neighbor.y * width + neighbor.x) * 4;
          if (data[neighborIndex + 3] > threshold) {
            queue.push(neighbor);
          }
        }
      });
    }
  }

  return boundary;
}

// Flood fill to mark visited pixels
function floodFillVisited(
  imageData: ImageData,
  startX: number,
  startY: number,
  threshold: number,
  visited: boolean[],
  width: number,
  height: number
) {
  const stack = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const index = y * width + x;
    if (visited[index]) continue;

    const pixelIndex = index * 4;
    const alpha = imageData.data[pixelIndex + 3];

    if (alpha > threshold) {
      visited[index] = true;

      // Add neighbors
      stack.push(
        { x: x - 1, y: y },
        { x: x + 1, y: y },
        { x: x, y: y - 1 },
        { x: x, y: y + 1 }
      );
    }
  }
}

// Create cut geometry using CSG
async function createCutGeometryFromPNG(pngUrl: string): Promise<{
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Create texture
        const texture = new THREE.Texture(img);
        texture.needsUpdate = true;
        // texture.transparent = true;
        texture.flipY = false;

        console.log(
          `[CSG LOADER] Created texture from ${pngUrl}, dimensions: ${img.width}x${img.height}`
        );

        // Analyze pixels to create cutting shapes
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        console.log(
          `[CSG LOADER] Analyzing ${canvas.width}x${canvas.height} pixels`
        );

        const shapes = createShapeFromPNGAlpha(imageData);
        console.log(`[CSG LOADER] Found ${shapes.length} shapes`);

        if (shapes.length === 0) {
          throw new Error("No shapes found in PNG");
        }

        // Create the base textured plane
        const planeGeometry = new THREE.PlaneGeometry(1, 1);
        const planeMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

        // Create cutting geometry from shapes
        const cuttingGeometries: THREE.BufferGeometry[] = [];

        shapes.forEach((shape) => {
          const shapeGeometry = new THREE.ShapeGeometry(shape);
          cuttingGeometries.push(shapeGeometry);
        });

        // Merge all cutting shapes if there are multiple
        let cuttingGeometry: THREE.BufferGeometry;
        if (cuttingGeometries.length === 1) {
          cuttingGeometry = cuttingGeometries[0];
        } else {
          // Simple approach: use the first shape for now
          // You could merge them with BufferGeometryUtils if needed
          cuttingGeometry = cuttingGeometries[0];
          console.log(
            `[CSG LOADER] Using first of ${cuttingGeometries.length} shapes`
          );
        }

        const cuttingMaterial = new THREE.MeshBasicMaterial({
          color: 0xff0000,
        });
        const cuttingMesh = new THREE.Mesh(cuttingGeometry, cuttingMaterial);

        // Perform CSG intersection
        try {
          console.log(`[CSG LOADER] Performing CSG intersection`);

          const planeCSG = CSG.fromMesh(planeMesh);
          const cuttingCSG = CSG.fromMesh(cuttingMesh);
          const resultCSG = planeCSG.intersect(cuttingCSG);
          const resultMesh = CSG.toMesh(resultCSG, new THREE.Matrix4());

          // Apply the material to the result mesh
          resultMesh.material = planeMaterial;

          console.log(`[CSG LOADER] CSG operation successful`);

          resolve({
            geometry: resultMesh.geometry,
            texture: texture,
          });
        } catch (csgError) {
          console.warn(
            "CSG operation failed, using simple approach:",
            csgError
          );

          // Fallback: use the cutting geometry directly with texture
          const fallbackMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
          });

          resolve({
            geometry: cuttingGeometry,
            texture: texture,
          });
        }
      } catch (error) {
        console.error("Error processing PNG for CSG:", error);
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load PNG: ${pngUrl}`));
    };

    img.src = pngUrl;
  });
}

export function loadAnimalPNG(
  animal: Animal,
  group: THREE.Group,
  scale: number,
  isLocalPlayer: boolean,
  setAnimalWidth: (animal: string, width: number) => void,
  positionRef: React.MutableRefObject<THREE.Vector3>,
  directionRef: React.MutableRefObject<THREE.Vector3 | null>,
  initialScale: React.MutableRefObject<THREE.Vector3 | null>,
  previousRotation: React.MutableRefObject<number>,
  targetRotation: React.MutableRefObject<number>,
  svgLoaded: React.MutableRefObject<boolean>,
  previousPosition: THREE.Vector3,
  currentFlipState: React.MutableRefObject<number>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[CSG LOADER] Loading PNG for ${animal}`);

      // Load PNG and create cut geometry + texture
      let geometry: THREE.BufferGeometry;
      let texture: THREE.Texture;

      try {
        const result = await createCutGeometryFromPNG(
          `/public/animals/${animal}.png`
        );
        geometry = result.geometry;
        texture = result.texture;
        console.log(
          `[CSG LOADER] Successfully created cut geometry and texture for ${animal}`
        );
      } catch (pngError) {
        console.warn(
          `Failed to load PNG for ${animal}, using fallback:`,
          pngError
        );

        // Fallback to simple geometry and texture
        geometry = new THREE.PlaneGeometry(1, 1);
        texture = createFallbackTexture(0x888888);
      }

      // Create main mesh with cut geometry
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
        opacity: 1.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = isLocalPlayer ? 1 : 0;
      mesh.position.z = 0.1;

      // Create outline using EdgeGeometry - this will follow the cut shape!
      const edges = new THREE.EdgesGeometry(geometry);
      const outlineMaterial = new THREE.LineBasicMaterial({
        color: "white", // Black outline
        linewidth: 2,
      });
      const outline = new THREE.LineSegments(edges, outlineMaterial);
      outline.renderOrder = isLocalPlayer ? 2 : 1; // Render outline on top
      outline.position.z = 0.11; // Slightly in front of the main mesh

      // Add both to group
      group.add(mesh);
      group.add(outline);

      console.log(
        `[CSG LOADER] Successfully created cut mesh and outline for ${animal}, added to group`
      );

      // Log detailed geometry information
      const bbox = new THREE.Box3().setFromObject(group);
      console.log(`[CSG LOADER] Geometry details for ${animal}:`, {
        geometryType: geometry.type,
        vertexCount: geometry.attributes.position
          ? geometry.attributes.position.count
          : "no vertices",
        boundingBoxMin: bbox.min.toArray(),
        boundingBoxMax: bbox.max.toArray(),
        boundingBoxSize: bbox.getSize(new THREE.Vector3()).toArray(),
        meshVisible: mesh.visible,
        meshPosition: mesh.position.toArray(),
        materialHasTexture: !!material.map,
      });

      // Cache the results
      animalGraphicsCache.set(animal, {
        texture: texture,
        geometry: geometry,
        boundingBox: new THREE.Box3().setFromObject(group),
      });

      console.log(`[CSG LOADER] Cached graphics for ${animal}`);

      // Scale the group
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y);
      const normalizeScale = 5 / maxDim;

      group.scale.multiplyScalar(normalizeScale * scale);

      // After scaling, measure width and set if not set
      const scaledBox = new THREE.Box3().setFromObject(group);
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      setAnimalWidth(animal, scaledSize.x);

      // Apply initial orientation to the entire group
      const orientation = ANIMAL_ORIENTATION[animal] || {
        rotation: 0,
        flipY: false,
      };

      group.rotation.z = orientation.rotation;
      if (orientation.flipY) {
        group.scale.x = -group.scale.x;
      }

      // Store the initial scale AFTER applying orientation flips
      initialScale.current = group.scale.clone();

      // Reset rotation references
      previousRotation.current = 0;
      targetRotation.current = 0;
      svgLoaded.current = true;

      // Set initial position
      previousPosition.copy(positionRef.current);
      group.position.copy(previousPosition);

      console.log(`[CSG LOADER] Final setup for ${animal}:`, {
        position: group.position.toArray(),
        scale: group.scale.toArray(),
        rotation: group.rotation.z,
        meshCount: group.children.length,
        boundingBox: new THREE.Box3().setFromObject(group),
      });

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

      resolve();
    } catch (error) {
      console.error("Error loading animal PNG:", error);

      // Create complete fallback when everything fails
      console.warn(`Creating complete fallback graphics for animal: ${animal}`);

      try {
        // Create fallback texture and geometry
        const fallbackTexture = createFallbackTexture(0x888888);
        const fallbackGeometry = new THREE.PlaneGeometry(1, 1);

        // Create fallback material
        const material = new THREE.MeshBasicMaterial({
          map: fallbackTexture,
          transparent: false,
          side: THREE.DoubleSide,
          depthWrite: true,
          color: 0x00ff00, // Green for fallback to distinguish from main case
        });

        // Create mesh
        const mesh = new THREE.Mesh(fallbackGeometry, material);
        mesh.renderOrder = isLocalPlayer ? 1 : 0;
        mesh.position.z = 0.1;

        // Create fallback outline
        const edges = new THREE.EdgesGeometry(fallbackGeometry);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
          linewidth: 2,
        });
        const outline = new THREE.LineSegments(edges, outlineMaterial);
        outline.renderOrder = isLocalPlayer ? 2 : 1;
        outline.position.z = 0.11;

        group.add(mesh);
        group.add(outline);

        // Cache the fallback results
        animalGraphicsCache.set(animal, {
          texture: fallbackTexture,
          geometry: fallbackGeometry,
          boundingBox: new THREE.Box3().setFromObject(group),
        });

        // Apply all the same scaling and positioning logic as above...
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y);
        const normalizeScale = 5 / maxDim;

        group.scale.multiplyScalar(normalizeScale * scale);

        const scaledBox = new THREE.Box3().setFromObject(group);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        setAnimalWidth(animal, scaledSize.x);

        const orientation = ANIMAL_ORIENTATION[animal] || {
          rotation: 0,
          flipY: false,
        };

        group.rotation.z = orientation.rotation;
        if (orientation.flipY) {
          group.scale.x = -group.scale.x;
        }

        initialScale.current = group.scale.clone();
        previousRotation.current = 0;
        targetRotation.current = 0;
        svgLoaded.current = true;

        previousPosition.copy(positionRef.current);
        group.position.copy(previousPosition);

        if (directionRef.current && directionRef.current.length() > 0.01) {
          const direction = directionRef.current.clone().normalize();
          const angle = Math.atan2(direction.y, direction.x);

          previousRotation.current = angle;
          targetRotation.current = angle;
          group.rotation.z = angle;

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
      } catch (fallbackError) {
        console.error("Even fallback failed:", fallbackError);
        reject(fallbackError);
      }
    }
  });
}
