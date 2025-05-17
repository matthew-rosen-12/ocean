import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { NPC } from "../utils/types";
import { DEBUG } from "../utils/config";

// Create a global texture cache
const textureCache = new Map<string, THREE.Texture>();
// Create a single shared loader
const textureLoader = new THREE.TextureLoader();

// Use the specific debug flag
const debug = DEBUG.NPC_MOVEMENT;

export function useNPCBase(npc: NPC) {
  const group = useMemo(() => new THREE.Group(), [npc.id]);
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const textureLoaded = useRef(false);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);

  // Add a function to track position changes
  const updatePositionWithTracking = (
    newPos: THREE.Vector3,
    source: string
  ) => {
    if (!positionRef.current.equals(newPos)) {
      if (debug) {
        console.log(`Position updated from ${source}:`, {
          npcId: npc.id,
          from: positionRef.current.clone(),
          to: newPos.clone(),
          phase: npc.phase,
          isFollowing: false, // Each component will determine this
        });
      }
      positionRef.current.copy(newPos);
    }
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
    const texturePath = `/npcs/${npc.filename}`;

    // Clean up any existing mesh first to avoid adding duplicates
    if (mesh.current && mesh.current.parent === group) {
      group.remove(mesh.current);
    }

    if (textureCache.has(texturePath)) {
      texture.current = textureCache.get(texturePath)!;

      // Create material and mesh using cached texture
      material.current = new THREE.MeshBasicMaterial({
        map: texture.current,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const geometry = new THREE.PlaneGeometry(1, 1);
      mesh.current = new THREE.Mesh(geometry, material.current);

      // Scale based on texture aspect ratio
      const imageAspect =
        texture.current.image.width / texture.current.image.height;
      const scale = 3; // Base scale
      mesh.current.scale.set(scale * imageAspect, scale, 1);

      group.add(mesh.current);
      textureLoaded.current = true;
    } else {
      // Load texture if not cached
      textureLoader.load(
        texturePath,
        (loadedTexture) => {
          // Cache the texture
          textureCache.set(texturePath, loadedTexture);

          // Double-check we don't already have a mesh (in case of rapid re-renders)
          if (mesh.current && mesh.current.parent === group) {
            group.remove(mesh.current);
          }

          texture.current = loadedTexture;

          // Create material and mesh
          material.current = new THREE.MeshBasicMaterial({
            map: loadedTexture,
            transparent: true,
            side: THREE.DoubleSide,
          });

          const geometry = new THREE.PlaneGeometry(1, 1);
          mesh.current = new THREE.Mesh(geometry, material.current);

          // Scale based on texture aspect ratio
          const imageAspect =
            loadedTexture.image.width / loadedTexture.image.height;
          const scale = 3; // Base scale
          mesh.current.scale.set(scale * imageAspect, scale, 1);

          group.add(mesh.current);
          textureLoaded.current = true;
        },
        undefined,
        (error) => {
          console.error("Error loading NPC texture:", error);
        }
      );
    }

    return () => {
      if (texture.current) texture.current.dispose();
      if (material.current) material.current.dispose();
      if (mesh.current && mesh.current.geometry)
        mesh.current.geometry.dispose();
    };
  }, [group, npc.filename, npc.id, previousPosition]);

  return {
    group,
    mesh,
    positionRef,
    targetPositionRef,
    textureLoaded,
    updatePositionWithTracking,
    previousPosition,
  };
}

export function useMount(callback: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
}
