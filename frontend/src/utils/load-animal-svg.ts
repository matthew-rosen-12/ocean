import React from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { Animal } from "../utils/types";
import concaveman from "concaveman";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";

export const animalGraphicsCache = new Map<
  string,
  {
    texture: THREE.Texture;
    geometry: THREE.BufferGeometry;
    boundingBox: THREE.Box3;
    outlineLineGeometry: LineGeometry | null;
  }
>();

export const ANIMAL_ORIENTATION = {
  WOLF: { rotation: 0, flipY: true },
  DOLPHIN: { rotation: 0, flipY: false },
};

// Utility function to create edge geometry from a base geometry
export function createEdgeGeometry(
  color: THREE.Color | string | number,
  isLocalPlayer: boolean = false,
  outlineLineGeometry?: LineGeometry | null,
  fallbackGeometry?: THREE.BufferGeometry
): THREE.Object3D {
  let lineSegmentsGeometry: LineGeometry;

  if (outlineLineGeometry) {
    // Use the provided LineGeometry directly
    console.log(
      `[EDGE GEOMETRY] Using provided LineGeometry for edge creation`
    );
    lineSegmentsGeometry = outlineLineGeometry;
  } else if (fallbackGeometry) {
    // Fallback to EdgesGeometry
    console.log(
      `[EDGE GEOMETRY] No LineGeometry provided, using EdgesGeometry fallback`
    );
    const edgeGeometry = new THREE.EdgesGeometry(fallbackGeometry);
    const positions = new Float32Array(edgeGeometry.attributes.position.array);

    lineSegmentsGeometry = new LineGeometry();
    lineSegmentsGeometry.setPositions(positions);
  } else {
    console.error(`[EDGE GEOMETRY] No geometry provided for edge creation`);
    // Create empty LineGeometry as last resort
    lineSegmentsGeometry = new LineGeometry();
    lineSegmentsGeometry.setPositions(new Float32Array([]));
  }

  const edgeMaterial = new LineMaterial({
    color: color,
    linewidth: 10.0,
    transparent: true,
    opacity: 1.0,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  const edgeLines = new LineSegments2(lineSegmentsGeometry, edgeMaterial);
  edgeLines.renderOrder = isLocalPlayer ? 10 : 9;
  edgeLines.position.z = 0.09;

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
  width: number,
  height: number
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        svgString
      )}`;

      const loader = new THREE.TextureLoader();

      const texture = loader.load(
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

  console.log(`[OUTLINE] Using dedicated outline path with id: ${outlineId}`);

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
  const geoWidth = bbox.max.x - bbox.min.x;
  const geoHeight = bbox.max.y - bbox.min.y;

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

  console.log(
    `[UV MAPPING] Set up UV coordinates for ${positions.count} vertices`
  );
}

export function loadAnimalSVG(
  animal: Animal,
  group: THREE.Group,
  scale: number,
  isLocalPlayer: boolean,
  setAnimalDimensions: (
    animal: string,
    dimensions: { width: number; height: number }
  ) => void,
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

          // Calculate texture scale factor for high resolution
          // Target texture size (you can adjust this value)
          const targetTextureSize = 1024; // pixels
          const maxOriginalDim = Math.max(finalWidth, finalHeight);
          const textureScaleFactor = targetTextureSize / maxOriginalDim;

          // Scaled dimensions for high-resolution texture
          const textureWidth = finalWidth * textureScaleFactor;
          const textureHeight = finalHeight * textureScaleFactor;

          // Create SVG element for texture generation with high resolution
          const svgElement = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          svgElement.setAttribute("width", textureWidth.toString());
          svgElement.setAttribute("height", textureHeight.toString());
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
              `[SVG LOADER] Creating high-res texture for ${animal}, dimensions: ${textureWidth}x${textureHeight} (scale factor: ${textureScaleFactor.toFixed(
                2
              )})`
            );
            texture = await createSVGTexture(
              svgElement,
              textureWidth,
              textureHeight
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
          const { geometry, outlineShape } =
            createGeometryFromOutlinePath(data);

          console.log(
            `[SVG LOADER] Successfully created geometry for ${animal}`
          );

          // Set up UV coordinates BEFORE centering the geometry
          // This ensures UV mapping corresponds to the original geometry layout
          setupUVCoordinates(geometry, minX, minY, finalWidth, finalHeight);

          // Create material with texture
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true, // Try setting this to false if you don't need transparency
            alphaTest: 0.1, // Add this to handle semi-transparent pixels better
            side: THREE.DoubleSide,
            depthWrite: true,
            opacity: 1.0,

            // Try these additional settings:
            premultipliedAlpha: false, // Match texture setting
            toneMapped: false, // Prevent tone mapping from affecting colors
          });

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = isLocalPlayer ? 1 : 0;
          mesh.position.z = 0.1; // Ensure it's in front

          // Center the geometry at origin and get the center offset
          geometry.computeBoundingBox();
          let centerOffset = new THREE.Vector3();
          if (geometry.boundingBox) {
            centerOffset = geometry.boundingBox.getCenter(new THREE.Vector3());
            geometry.translate(
              -centerOffset.x,
              -centerOffset.y,
              -centerOffset.z
            );
            console.log(
              `[SVG LOADER] Centered geometry for ${animal}, was at:`,
              centerOffset.toArray()
            );
          }

          // Create LineGeometry from outline shape AFTER centering, applying the same offset
          let outlineLineGeometry: LineGeometry | null = null;
          if (outlineShape) {
            const points = outlineShape.getPoints();
            const linePositions: number[] = [];

            for (let i = 0; i < points.length; i++) {
              const currentPoint = points[i];
              const nextPoint = points[(i + 1) % points.length]; // Wrap around to close the loop

              // Apply the same transformations as the main geometry:
              // 1. Y-flip (scale(1, -1, 1))
              // 2. Center offset (translate(-centerOffset.x, -centerOffset.y, -centerOffset.z))
              linePositions.push(
                currentPoint.x - centerOffset.x,
                -currentPoint.y - centerOffset.y, // Apply Y-flip here
                0,
                nextPoint.x - centerOffset.x,
                -nextPoint.y - centerOffset.y, // Apply Y-flip here
                0
              );
            }

            outlineLineGeometry = new LineGeometry();
            outlineLineGeometry.setPositions(new Float32Array(linePositions));
            console.log(
              `[SVG LOADER] Created centered LineGeometry with ${points.length} outline segments`
            );
          }

          group.add(mesh);

          console.log(
            `[SVG LOADER] Successfully created mesh for ${animal}, added to group`
          );

          // Log detailed geometry information
          const bbox = new THREE.Box3().setFromObject(group);

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
          setAnimalDimensions(animal, {
            width: scaledSize.x,
            height: scaledSize.y,
          });
          console.log(
            `[SVG LOADER] Final dimensions for ${animal}: width=${scaledSize.x.toFixed(
              2
            )}, height=${scaledSize.y.toFixed(
              2
            )} (after orientation: rotation=${orientation.rotation}, flipY=${
              orientation.flipY
            })`
          );

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
            // Use green for fallback to distinguish from main case
            color: 0x00ff00,
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
          setAnimalDimensions(animal, {
            width: scaledSize.x,
            height: scaledSize.y,
          });

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
        reject(error);
      }
    );
  });
}
