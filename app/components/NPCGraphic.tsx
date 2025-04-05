import React, { useRef, useEffect, useMemo } from "react";
import { NPC, NPCPhase, throwData, UserInfo } from "../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { smoothMove } from "../utils/movement";

interface NPCGraphicProps {
  npc: NPC;
  users: Map<string, UserInfo>;
  myUserId: string; // Add this to identify local user
  followingUser?: UserInfo; // The user this NPC is following (if any)
  onCollision?: (npc: NPC) => void;
  throw?: throwData;
}

const NPCGraphic: React.FC<NPCGraphicProps> = ({
  npc,
  users,
  myUserId,
  followingUser,
  onCollision,
  throw: throwData,
}) => {
  const group = useMemo(() => new THREE.Group(), []);
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const textureLoaded = useRef(false);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);

  // Add this helper function inside the component
  const calculateFollowPosition = (
    followingUser: UserInfo,
    npcId: string,
    offsetDistance: number = 4.0
  ): THREE.Vector3 => {
    // Find index of this NPC in the follower's group
    const offsetIndex =
      followingUser.npcGroup?.npcs.findIndex((n) => n.id === npcId) || 0;

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
    const progress = Math.min(
      elapsedTime / (throwData.throwDuration / 1000),
      1
    );

    // Calculate distance based on velocity and time
    const distance = throwData.velocity * progress;

    // Calculate the position - straight line
    return new THREE.Vector3(
      throwData.startPosition.x + throwData.direction.x * distance,
      throwData.startPosition.y + throwData.direction.y * distance,
      0
    );
  };

  // Modify the useEffect that sets up the mesh
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    // Check if this is the first setup by looking at previousPosition
    const isFirstSetup = previousPosition.lengthSq() === 0;

    if (isFirstSetup && npc.position && followingUser === undefined) {
      positionRef.current.set(npc.position.x, npc.position.y, npc.position.z);
    }

    if (isFirstSetup && followingUser && followingUser.position) {
      // Calculate position using the helper function
      const position = calculateFollowPosition(followingUser, npc.id);

      // Set initial position directly
      positionRef.current.copy(position);
      previousPosition.copy(positionRef.current);
      group.position.copy(previousPosition);
    } else {
      // Default behavior
      previousPosition.copy(positionRef.current);
      group.position.copy(previousPosition);
    }
    // Load texture
    textureLoader.load(
      `/npcs/${npc.filename}`,
      (loadedTexture) => {
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

    if (npc.phase === NPCPhase.THROWN || npc.phase === NPCPhase.IDLE) {
      targetPositionRef.current.copy(npc.position);
    }
    return () => {
      if (texture.current) texture.current.dispose();
      if (material.current) material.current.dispose();
      if (mesh.current && mesh.current.geometry)
        mesh.current.geometry.dispose();
    };
  }, [
    previousPosition,
    group,
    npc.filename,
    npc.phase,
    followingUser,
    npc.id,
    npc.position,
  ]);

  // Handle updates and collisions
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    if (npc.phase === NPCPhase.THROWN && throwData) {
      // Calculate current position based on simple linear motion
      const throwPosition = calculateThrowPosition(throwData, Date.now());

      // Set position directly for smoother throws
      positionRef.current.copy(throwPosition);
      group.position.copy(positionRef.current);
    } else if (npc.phase === NPCPhase.IDLE) {
      // Normal following behavior
      if (followingUser) {
        const targetPosition = calculateFollowPosition(followingUser, npc.id);

        if (positionRef.current != targetPosition) {
          const isLocalPlayerNPC =
            followingUser && followingUser.id === myUserId;

          if (isLocalPlayerNPC) {
            positionRef.current.copy(targetPosition);
          } else {
            positionRef.current.copy(
              smoothMove(positionRef.current.clone(), targetPosition)
            );
          }

          group.position.copy(positionRef.current);
          // Fixed upright rotation - NPCs don't rotate with captor
          group.rotation.z = 0;
        }
      }
    } else {
      // Normal following behavior
      if (followingUser) {
        const targetPosition = calculateFollowPosition(followingUser, npc.id);

        if (positionRef.current != targetPosition) {
          const isLocalPlayerNPC =
            followingUser && followingUser.id === myUserId;

          if (isLocalPlayerNPC) {
            positionRef.current.copy(targetPosition);
          } else {
            positionRef.current.copy(
              smoothMove(positionRef.current.clone(), targetPosition)
            );
          }

          group.position.copy(positionRef.current);

          // Update NPC position data
          if (npc.phase === NPCPhase.CAPTURED && followingUser) {
            npc.position.x = positionRef.current.x;
            npc.position.y = positionRef.current.y;
            npc.position.z = positionRef.current.z;
          }

          // Fixed upright rotation - NPCs don't rotate with captor
          group.rotation.z = 0;
        }
      }
    }
    if (!followingUser && onCollision) {
      const COLLISION_THRESHOLD = 2.5;
      const localUser = users.get(myUserId);

      if (localUser?.position) {
        const userPos = new THREE.Vector3(
          localUser.position.x,
          localUser.position.y,
          localUser.position.z
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
