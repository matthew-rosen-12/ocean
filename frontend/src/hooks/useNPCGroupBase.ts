import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { DEBUG } from "../utils/config";
import { NPCGroup, UserInfo } from "shared/types";
import { calculateNPCGroupScale } from "../utils/npc-group-utils";
import { getAnimalColor, getAnimalIndicatorColor } from "../utils/animal-colors";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";

// Create a global texture cache
const textureCache = new Map<string, THREE.Texture>();
// Create a global material cache
const materialCache = new Map<string, THREE.MeshBasicMaterial>();
// Create a single shared loader
const textureLoader = new THREE.TextureLoader();

console.log(
  `[NPC CACHE] Texture cache initialized, size: ${textureCache.size}`
);

// Use the specific debug flag
const debug = DEBUG.NPC_MOVEMENT;

export function useNPCGroupBase(npcGroup: NPCGroup, user?: UserInfo) {
  const group = useMemo(() => {
    const newGroup = new THREE.Group();
    return newGroup;
  }, [npcGroup.id]);
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const textureLoaded = useRef(false);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  const meshVersion = useRef(0);
  const outline = useRef<THREE.Object3D | null>(null);

  // Add a function to track position changes
  const updatePositionWithTracking = (
    newPos: THREE.Vector3,
    source: string
  ) => {
    if (!positionRef.current.equals(newPos)) {
      if (debug) {
        console.log(`Position updated from ${source}:`, {
          npcGroupId: npcGroup.id,
          from: positionRef.current.clone(),
          to: newPos.clone(),
          phase: npcGroup.phase,
          isFollowing: false, // Each component will determine this
        });
      }
      positionRef.current.copy(newPos);
    }
  };

  // Helper function to create outline (mirroring CapturedNPCGroupGraphic approach)
  const createOutline = (scale: number, borderColor: THREE.Color) => {
    
    // Create a square outline (1x1) like the original, then scale it
    const halfWidth = 0.5;
    const halfHeight = 0.5;
    
    // Create square outline points (clockwise)
    const linePositions = [
      // Bottom edge
      -halfWidth, -halfHeight, 0,
      halfWidth, -halfHeight, 0,
      // Right edge  
      halfWidth, -halfHeight, 0,
      halfWidth, halfHeight, 0,
      // Top edge
      halfWidth, halfHeight, 0,
      -halfWidth, halfHeight, 0,
      // Left edge
      -halfWidth, halfHeight, 0,
      -halfWidth, -halfHeight, 0,
    ];
    
    // Use LineGeometry and LineMaterial for thick lines like the original
    const lineGeometry = new LineGeometry();
    lineGeometry.setPositions(new Float32Array(linePositions));
    
    const edgeMaterial = new LineMaterial({
      color: borderColor,
      linewidth: 10.0,
      transparent: true,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
    });
    
    const outlineObj = new LineSegments2(lineGeometry, edgeMaterial);
    outlineObj.renderOrder = 9; // NPCs are never local player
    outlineObj.scale.set(scale, scale, 1); // Square scaling like the original
    outlineObj.position.z = -0.01; // Behind the image, like the original
    
    return outlineObj;
  };

  // Return text info for React component to render (like original)
  const getTextInfo = (count: number, scale: number) => {
    if (count <= 1) return null;
    
    // Always show text for groups > 1, use lightened user color if available, otherwise gray
    const baseColor = user ? getAnimalIndicatorColor(user) : new THREE.Color('#888888');
    
    return {
      count,
      position: [0, scale / 2 + 2.3, 0] as [number, number, number],
      fontSize: 2.8,
      color: baseColor
    };
  };

  // Regular useEffect for texture loading and setup
  useEffect(() => {
    // Reset texture loaded flag when NPC changes
    textureLoaded.current = false;

    // Position update
    previousPosition.copy(positionRef.current);
    group.position.copy(previousPosition);

    // Check if mesh is already set up and attached to the group
    if (
      mesh.current &&
      mesh.current.parent === group &&
      textureLoaded.current
    ) {
      return;
    }

    // If we get here, we need to set up the mesh
    const texturePath = `/npcs/${npcGroup.faceFileName}`;
    // Clean up any existing elements first to avoid adding duplicates
    if (mesh.current && mesh.current.parent === group) {
      group.remove(mesh.current);
      if (mesh.current.geometry) {
        mesh.current.geometry.dispose();
      }
    }
    if (outline.current && outline.current.parent === group) {
      group.remove(outline.current);
      if (outline.current instanceof LineSegments2) {
        outline.current.geometry?.dispose();
        (outline.current.material as LineMaterial).dispose();
      }
    }

    if (textureCache.has(texturePath)) {
      texture.current = textureCache.get(texturePath)!;

      // Check if we also have a cached material
      if (materialCache.has(texturePath)) {
        material.current = materialCache.get(texturePath)!;
      } else {
        // Create material and cache it
        material.current = new THREE.MeshBasicMaterial({
          map: texture.current,
          transparent: true,
          side: THREE.DoubleSide,
        });
        materialCache.set(texturePath, material.current);
      }

      const geometry = new THREE.PlaneGeometry(1, 1);
      mesh.current = new THREE.Mesh(geometry, material.current);

      // Scale based on texture aspect ratio and fileNames count
      const imageAspect =
        texture.current.image.width / texture.current.image.height;
      const scale = calculateNPCGroupScale(npcGroup.fileNames.length);
      mesh.current.scale.set(scale * imageAspect, scale, 1);

      group.add(mesh.current);
      
      // Get the color for outline
      const borderColor = user ? getAnimalColor(user) : new THREE.Color('#888888');
      
      // Create and add outline
      outline.current = createOutline(scale, borderColor);
      if (outline.current) {
        group.add(outline.current);
      }
      
      textureLoaded.current = true;
      meshVersion.current += 1;
    } else {
      // Load texture if not cached
      textureLoader.load(
        texturePath,
        (loadedTexture) => {
          // Cache the texture
          textureCache.set(texturePath, loadedTexture);

          // Double-check we don't already have elements (in case of rapid re-renders)
          if (mesh.current && mesh.current.parent === group) {
            group.remove(mesh.current);
            if (mesh.current.geometry) {
              mesh.current.geometry.dispose();
            }
          }
          if (outline.current && outline.current.parent === group) {
            group.remove(outline.current);
            if (outline.current instanceof LineSegments2) {
              outline.current.geometry?.dispose();
              (outline.current.material as LineMaterial).dispose();
            }
          }

          texture.current = loadedTexture;

          // Create material and cache it
          material.current = new THREE.MeshBasicMaterial({
            map: loadedTexture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          materialCache.set(texturePath, material.current);

          const geometry = new THREE.PlaneGeometry(1, 1);
          mesh.current = new THREE.Mesh(geometry, material.current);

          // Scale based on texture aspect ratio and fileNames count
          const imageAspect =
            loadedTexture.image.width / loadedTexture.image.height;
          const scale = calculateNPCGroupScale(npcGroup.fileNames.length);
          mesh.current.scale.set(scale * imageAspect, scale, 1);

          group.add(mesh.current);
          
          // Get the color for outline
          const borderColor = user ? getAnimalColor(user) : new THREE.Color('#888888');
          
          // Create and add outline
          outline.current = createOutline(scale, borderColor);
          if (outline.current) {
            group.add(outline.current);
          }
          
          textureLoaded.current = true;
          meshVersion.current += 1;
        },
        undefined,
        (error) => {
          console.error(`Error loading NPC texture: ${texturePath}`, error);
        }
      );
    }

    return () => {
      // Only dispose texture if it's not in the cache (i.e., if it failed to load)
      if (texture.current && !textureCache.has(`/npcs/${npcGroup.faceFileName}`)) {
        texture.current.dispose();
      }

      // Only dispose material if it's not in the cache
      if (material.current && !materialCache.has(`/npcs/${npcGroup.faceFileName}`)) {
        material.current.dispose();
      }

      // Clean up our elements specifically, not the entire group
      if (mesh.current) {
        if (mesh.current.geometry) {
          mesh.current.geometry.dispose();
        }
        if (mesh.current.parent === group) {
          group.remove(mesh.current);
        }
      }
      if (outline.current) {
        if (outline.current instanceof LineSegments2) {
          outline.current.geometry?.dispose();
          if (outline.current.material) {
            (outline.current.material as LineMaterial).dispose();
          }
        }
        if (outline.current.parent === group) {
          group.remove(outline.current);
        }
      }
    };
  }, [npcGroup.faceFileName, npcGroup.fileNames.length]);

  // Calculate current scale for text positioning
  const currentScale = useMemo(() => {
    return calculateNPCGroupScale(npcGroup.fileNames.length);
  }, [npcGroup.fileNames.length]);

  return {
    group,
    mesh,
    positionRef,
    targetPositionRef,
    textureLoaded,
    updatePositionWithTracking,
    previousPosition,
    meshVersion,
    textInfo: getTextInfo(npcGroup.fileNames.length, currentScale),
  };
}

export function useMount(callback: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
}
