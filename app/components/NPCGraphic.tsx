import React, { useRef, useEffect, useMemo } from "react";
import { NPC, NPCPhase, throwData, UserInfo } from "../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../utils/movement";

// Create a global texture cache
const textureCache = new Map<string, THREE.Texture>();
// Create a single shared loader
const textureLoader = new THREE.TextureLoader();

interface NPCGraphicProps {
  npc: NPC;
  myUser: UserInfo;
  isLocalUser?: boolean;
  followingUser?: UserInfo;
  onCollision?: (npc: NPC) => void;
  throw?: throwData;
  offsetIndex?: number;
}

// Add this custom hook at the top of your file or in a separate hooks file
const useMount = (callback: () => void) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
};

const NPCGraphic: React.FC<NPCGraphicProps> = ({
  npc,
  myUser,
  isLocalUser,
  followingUser,
  onCollision,
  throw: throwData,
  offsetIndex,
}) => {
  const group = useMemo(() => new THREE.Group(), []);
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
      console.log(`Position updated from ${source}:`, {
        npcId: npc.id,
        from: positionRef.current.clone(),
        to: newPos.clone(),
        phase: npc.phase,
        isFollowing: !!followingUser,
      });
      positionRef.current.copy(newPos);
    }
  };

  // This will run only once on initial render
  useMount(() => {
    // Initial position setup logic
    if (npc.position && npc.phase !== NPCPhase.CAPTURED) {
      updatePositionWithTracking(
        new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z),
        "useMount-position"
      );
    }

    if (followingUser) {
      // Calculate position using the helper function
      const position = calculateFollowPosition(followingUser, offsetIndex || 0);
      // Set initial position directly
      updatePositionWithTracking(position, "useMount-followingUser");
    }

    // Update previous position and group position
    previousPosition.copy(positionRef.current);
    group.position.copy(previousPosition);
  });

  // Add this helper function inside the component
  const calculateFollowPosition = (
    followingUser: UserInfo,
    offsetIndex: number,
    offsetDistance: number = 4.0
  ): THREE.Vector3 => {
    // Get user direction
    // Get user direction
    const dx = followingUser.direction?.x || 0;
    const dy = followingUser.direction?.y || 0;

    // Normalize direction
    const dirLength = Math.sqrt(dx * dx + dy * dy) || 1;
    const normalizedDx = dx / dirLength;
    const normalizedDy = dy / dirLength;

    // Calculate base position behind player
    let posX =
      followingUser.position.x -
      normalizedDx * offsetDistance * (offsetIndex + 1);
    let posY =
      followingUser.position.y -
      normalizedDy * offsetDistance * (offsetIndex + 1);

    // For staggered formation, use perpendicular vector
    if (offsetIndex > 0) {
      const perpDx = -normalizedDy;
      const perpDy = normalizedDx;
      const spreadFactor =
        (offsetIndex % 2 === 0 ? 1 : -1) * Math.ceil(offsetIndex / 2) * 1.2;
      posX += perpDx * spreadFactor;
      posY += perpDy * spreadFactor;
    }

    return new THREE.Vector3(posX, posY, 0);
  };

  // Add this function to calculate position for thrown NPCs - straight line
  const calculateThrowPosition = (
    throwData: throwData,
    currentTime: number
  ) => {
    if (!throwData) return new THREE.Vector3();

    // Calculate elapsed time in seconds
    const elapsedTime = (currentTime - throwData.timestamp) / 1000;
    const throwDurationSec = throwData.throwDuration / 1000;
    const progress = Math.min(elapsedTime / throwDurationSec, 1);

    // If we've reached the end of the throw, use exact same calculation as server
    if (progress >= 1) {
      const finalDistance = throwData.velocity * throwDurationSec;
      return new THREE.Vector3(
        throwData.startPosition.x + throwData.direction.x * finalDistance,
        throwData.startPosition.y + throwData.direction.y * finalDistance,
        0
      );
    }

    // For animation, calculate intermediate position
    const distance = throwData.velocity * elapsedTime;
    return new THREE.Vector3(
      throwData.startPosition.x + throwData.direction.x * distance,
      throwData.startPosition.y + throwData.direction.y * distance,
      0
    );
  };

  // Regular useEffect for texture loading and updates that need to respond to prop changes
  useEffect(() => {
    // Position update
    previousPosition.copy(positionRef.current);
    group.position.copy(previousPosition);

    // Log that this useEffect ran
    // Check if mesh is already set up and attached to the group
    if (
      mesh.current &&
      mesh.current.parent === group &&
      textureLoaded.current
    ) {
      // Still update target position if needed
      if (npc.phase === NPCPhase.THROWN || npc.phase === NPCPhase.IDLE) {
        targetPositionRef.current.copy(npc.position);
      }
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
          console.log("Newly loaded texture for", npc.filename);
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

    if (npc.phase === NPCPhase.THROWN || npc.phase === NPCPhase.IDLE) {
      targetPositionRef.current.copy(npc.position);
    }

    return () => {
      if (texture.current) texture.current.dispose();
      if (material.current) material.current.dispose();
      if (mesh.current && mesh.current.geometry)
        mesh.current.geometry.dispose();
    };
  }, [group, npc.filename, npc.id, npc.phase, npc.position, previousPosition]);

  // Handle updates and collisions
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    if (npc.phase === NPCPhase.THROWN && throwData) {
      // Calculate current position based on simple linear motion
      const throwPosition = calculateThrowPosition(throwData, Date.now());
      // Set position directly for smoother throws
      updatePositionWithTracking(throwPosition, "useFrame-thrown");
      group.position.copy(positionRef.current);
    } else if (npc.phase === NPCPhase.IDLE) {
      // Normal following behavior
      if (isLocalUser) {
        updatePositionWithTracking(
          new THREE.Vector3(npc.position.x, npc.position.y, 0),
          "useFrame-idle-local"
        );
      } else {
        updatePositionWithTracking(
          smoothMove(
            positionRef.current.clone(),
            new THREE.Vector3(npc.position.x, npc.position.y, 0)
          ),
          "useFrame-idle-remote"
        );
      }

      group.position.copy(positionRef.current);
      // Fixed upright rotation - NPCs don't rotate with captor
      group.rotation.z = 0;
    } else {
      if (followingUser) {
        const targetPosition = calculateFollowPosition(
          followingUser,
          offsetIndex || 0
        );

        if (!positionRef.current.equals(targetPosition)) {
          if (isLocalUser) {
            updatePositionWithTracking(targetPosition, "useFrame-follow-local");
          } else {
            updatePositionWithTracking(
              smoothMove(positionRef.current.clone(), targetPosition),
              "useFrame-follow-remote"
            );
          }
          group.position.copy(positionRef.current);

          npc.position.x = positionRef.current.x;
          npc.position.y = positionRef.current.y;

          // Fixed upright rotation - NPCs don't rotate with captor
          group.rotation.z = 0;
        }
      }
    }
    if (!followingUser && onCollision) {
      const COLLISION_THRESHOLD = 2.5;

      if (myUser.position) {
        const userPos = new THREE.Vector3(
          myUser.position.x,
          myUser.position.y,
          myUser.position.z
        );
        const distance = positionRef.current.distanceTo(userPos);

        if (distance < COLLISION_THRESHOLD) {
          onCollision(npc);
        }
      }
    }
  });

  return <primitive object={group} />;
};

export default NPCGraphic;
