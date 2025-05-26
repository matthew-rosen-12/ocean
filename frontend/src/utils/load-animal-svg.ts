import React from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { Animal } from "../utils/types";
import concaveman from "concaveman";

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

// Create texture from SVG by rendering it to canvas
function createSVGTexture(
  svgElement: SVGElement,
  width: number,
  height: number
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    try {
      // Create a canvas to render the SVG
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Set canvas size with high resolution for crisp textures
      const scale = 2; // Higher resolution for better quality
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(svgElement);

      // Create blob and object URL
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      // Create image and load SVG
      const img = new Image();

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG texture loading timeout"));
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);

        try {
          // Clear canvas with transparent background
          ctx.clearRect(0, 0, width, height);

          // Draw SVG to canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Create Three.js texture from canvas
          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          texture.flipY = false; // Important for correct orientation

          // Clean up
          URL.revokeObjectURL(url);

          resolve(texture);
        } catch (drawError) {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to draw SVG to canvas: ${drawError}`));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG image"));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

// Extract outline from SVG paths and create a single geometry
function createOutlineGeometry(svgData: any): THREE.BufferGeometry {
  const allPoints: THREE.Vector2[] = [];

  // Process all paths to get outline points
  svgData.paths.forEach((path: any) => {
    const shapes = path.toShapes(true);

    shapes.forEach((shape: THREE.Shape) => {
      // Get points from the shape
      const points = shape.getPoints();
      allPoints.push(...points);
    });
  });

  if (allPoints.length === 0) {
    // Fallback: create a simple rectangle
    return new THREE.PlaneGeometry(1, 1);
  }

  // Find bounding box of all points
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  allPoints.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  // Center the points
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const width = maxX - minX;
  const height = maxY - minY;

  // Create a shape from the convex hull of all points
  // For simplicity, we'll use a rectangle that encompasses all shapes
  // This could be improved with actual convex hull calculation
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();

  // Create geometry from shape
  const geometry = new THREE.ShapeGeometry(shape);

  // Flip Y coordinate to match SVG coordinate system
  geometry.scale(1, -1, 1);

  return geometry;
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
    const hullPoints = concaveman(allPoints, 2, 0);

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

export function loadAnimalSVG(
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
  return new Promise((resolve, reject) => {
    const loader = new SVGLoader();

    loader.load(
      `/public/animals/${animal}.svg`,
      async (data) => {
        console.log(
          `[SVG LOADER] Successfully loaded SVG for ${animal}:`,
          data
        );
        try {
          // Validate that we have paths with data
          if (!data.paths || data.paths.length === 0) {
            throw new Error(`No paths found in SVG for animal: ${animal}`);
          }

          // Calculate bounding box
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          let hasValidPoints = false;

          data.paths.forEach((path) => {
            path.subPaths.forEach((subPath) => {
              const points = subPath.getPoints();
              points.forEach((point) => {
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
          if (
            !hasValidPoints ||
            !isFinite(minX) ||
            !isFinite(minY) ||
            !isFinite(maxX) ||
            !isFinite(maxY)
          ) {
            console.warn(
              `Invalid bounding box for animal ${animal}, using fallback`
            );
            minX = 0;
            minY = 0;
            maxX = 100;
            maxY = 100;
          }

          const width = maxX - minX;
          const height = maxY - minY;

          // Ensure minimum dimensions
          const finalWidth = Math.max(width, 1);
          const finalHeight = Math.max(height, 1);
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          // Create SVG element for texture generation
          const svgElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          svgElement.setAttribute("width", finalWidth.toString());
          svgElement.setAttribute("height", finalHeight.toString());
          svgElement.setAttribute(
            "viewBox",
            `${minX} ${minY} ${finalWidth} ${finalHeight}`
          );

          // Add paths to SVG element
          data.paths.forEach((path) => {
            const color = path.color || 0x000000;
            const shapes = path.toShapes(true);

            shapes.forEach((shape) => {
              const pathElement = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
              );

              // Convert shape to SVG path data
              const points = shape.getPoints();
              if (points.length > 0) {
                let pathData = `M ${points[0].x} ${points[0].y}`;
                for (let i = 1; i < points.length; i++) {
                  pathData += ` L ${points[i].x} ${points[i].y}`;
                }
                pathData += " Z";

                pathElement.setAttribute("d", pathData);
                pathElement.setAttribute(
                  "fill",
                  `#${color.getHex().toString(16).padStart(6, "0")}`
                );
                svgElement.appendChild(pathElement);
              }
            });
          });

          // Create texture from SVG
          let texture: THREE.Texture;
          try {
            console.log(
              `[SVG LOADER] Creating texture for ${animal}, dimensions: ${finalWidth}x${finalHeight}`
            );
            texture = await createSVGTexture(
              svgElement,
              finalWidth,
              finalHeight
            );
            console.log(
              `[SVG LOADER] Successfully created texture for ${animal}`
            );
          } catch (textureError) {
            console.warn(
              "Failed to create SVG texture, using fallback:",
              textureError
            );
            // Use the first path's color for the fallback, or default gray
            const firstColor =
              data.paths.length > 0
                ? data.paths[0].color?.getHex() || 0x888888
                : 0x888888;
            texture = createFallbackTexture(firstColor);
          }

          // Create outline geometry - always try to use the actual SVG shape
          let geometry: THREE.BufferGeometry;
          try {
            console.log(`[SVG LOADER] Creating geometry for ${animal}`);
            geometry = createDetailedOutlineGeometry(data);
            console.log(
              `[SVG LOADER] Successfully created geometry for ${animal}`
            );
          } catch (geometryError) {
            console.warn(
              "Failed to create detailed geometry, using simple plane:",
              geometryError
            );
            geometry = new THREE.PlaneGeometry(
              finalWidth / 50,
              finalHeight / 50
            ); // Scale down to reasonable size
          }

          // Create material with solid color (no texture for now)
          const material = new THREE.MeshBasicMaterial({
            // map: texture, // Commented out for debugging
            transparent: false,
            side: THREE.DoubleSide,
            depthWrite: true,
            color: 0xff0000, // Bright red for visibility
            opacity: 1.0,
          });

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = isLocalPlayer ? 1 : 0;
          mesh.position.z = 0.1; // Ensure it's in front

          // Center the geometry at origin
          geometry.computeBoundingBox();
          if (geometry.boundingBox) {
            const center = geometry.boundingBox.getCenter(new THREE.Vector3());
            geometry.translate(-center.x, -center.y, -center.z);
            console.log(
              `[SVG LOADER] Centered geometry for ${animal}, was at:`,
              center.toArray()
            );
          }

          group.add(mesh);

          console.log(
            `[SVG LOADER] Successfully created mesh for ${animal}, added to group`
          );

          // Log detailed geometry information
          const bbox = new THREE.Box3().setFromObject(group);
          console.log(`[SVG LOADER] Geometry details for ${animal}:`, {
            geometryType: geometry.type,
            vertexCount: geometry.attributes.position
              ? geometry.attributes.position.count
              : "no vertices",
            boundingBoxMin: bbox.min.toArray(),
            boundingBoxMax: bbox.max.toArray(),
            boundingBoxSize: bbox.getSize(new THREE.Vector3()).toArray(),
            meshVisible: mesh.visible,
            meshPosition: mesh.position.toArray(),
            materialColor: material.color.getHex(),
          });

          // Cache the results
          animalGraphicsCache.set(animal, {
            texture: texture,
            geometry: geometry,
            boundingBox: new THREE.Box3().setFromObject(group),
          });

          console.log(`[SVG LOADER] Cached graphics for ${animal}`);

          // Scale the group
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y);
          const normalizeScale = 5 / maxDim;

          group.scale.multiplyScalar(normalizeScale * scale); // Back to normal scale

          // After scaling, measure width and set if not set
          const scaledBox = new THREE.Box3().setFromObject(group);
          const scaledSize = scaledBox.getSize(new THREE.Vector3());
          setAnimalWidth(animal, scaledSize.x);

          // Apply initial orientation
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

          console.log(`[SVG LOADER] Final setup for ${animal}:`, {
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

          // Create material with texture
          const material = new THREE.MeshBasicMaterial({
            // map: fallbackTexture, // Commented out for debugging
            transparent: false,
            side: THREE.DoubleSide,
            depthWrite: true,
            color: 0x00ff00, // Green for fallback to distinguish from main case
          });

          // Create mesh
          const mesh = new THREE.Mesh(fallbackGeometry, material);
          mesh.renderOrder = isLocalPlayer ? 1 : 0;
          mesh.position.z = 0.1; // Ensure it's in front

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
          });

          // Scale the group
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y);
          const normalizeScale = 5 / maxDim;

          group.scale.multiplyScalar(normalizeScale * scale); // Back to normal scale

          // After scaling, measure width and set if not set
          const scaledBox = new THREE.Box3().setFromObject(group);
          const scaledSize = scaledBox.getSize(new THREE.Vector3());
          setAnimalWidth(animal, scaledSize.x);

          // Apply initial orientation
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

          console.log(`[SVG LOADER] Final setup for ${animal}:`, {
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

          resolve(); // Resolve with fallback instead of rejecting
        }
      },
      undefined,
      (error) => {
        console.error("Error loading SVG:", error);
        reject(error);
      }
    );
  });
}
