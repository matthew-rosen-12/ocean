import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { NPC } from "../utils/types";
import { DEBUG } from "../utils/config";

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

export function useNPCBase(npc: NPC) {
  const group = useMemo(() => {
    const newGroup = new THREE.Group();
    // Reduced logging - only log when debugging specific issues
    if (DEBUG.NPC_MOVEMENT) {
      console.log(
        `[useNPCBase] Creating new Group ${newGroup.uuid} for NPC ${npc.id}`
      );
    }
    return newGroup;
  }, [npc.id]);
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
      console.log(
        `[NPC CACHE] Using cached texture for NPC ${npc.id}, cache size: ${textureCache.size}`
      );
      texture.current = textureCache.get(texturePath)!;

      // Check if we also have a cached material
      if (materialCache.has(texturePath)) {
        console.log(
          `[NPC CACHE] Using cached material for NPC ${npc.id}, material cache size: ${materialCache.size}`
        );
        material.current = materialCache.get(texturePath)!;
      } else {
        console.log(
          `[NPC CACHE] Creating new material for cached texture for NPC ${npc.id}`
        );
        // Create material and cache it
        material.current = new THREE.MeshBasicMaterial({
          map: texture.current,
          transparent: true,
          side: THREE.DoubleSide,
        });
        materialCache.set(texturePath, material.current);
        console.log(
          `[NPC CACHE] Material cached, new material cache size: ${materialCache.size}`
        );
      }

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
      console.log(
        `[NPC CACHE] Loading texture (not cached) for NPC ${npc.id}: ${texturePath}`
      );
      // Load texture if not cached
      textureLoader.load(
        texturePath,
        (loadedTexture) => {
          console.log(
            `[NPC CACHE] Texture loaded successfully for ${npc.id}, caching...`
          );
          // Cache the texture
          textureCache.set(texturePath, loadedTexture);
          console.log(
            `[NPC CACHE] Texture cached, new cache size: ${textureCache.size}`
          );

          // Double-check we don't already have a mesh (in case of rapid re-renders)
          if (mesh.current && mesh.current.parent === group) {
            group.remove(mesh.current);
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
      if (DEBUG.NPC_MOVEMENT) {
        console.log(
          `[useNPCBase] Cleaning up Group ${group.uuid} for NPC ${npc.id}`
        );
      }
      // Only dispose texture if it's not in the cache (i.e., if it failed to load)
      if (texture.current && !textureCache.has(`/npcs/${npc.filename}`)) {
        texture.current.dispose();
      } else if (texture.current) {
      }

      // Only dispose material if it's not in the cache
      if (material.current && !materialCache.has(`/npcs/${npc.filename}`)) {
        material.current.dispose();
      } else if (material.current) {
      }

      if (mesh.current && mesh.current.geometry) {
        mesh.current.geometry.dispose();
      }

      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          // Don't dispose materials here since they might be cached
        }
      });
      group.clear();
    };
  }, [npc.filename]);

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
