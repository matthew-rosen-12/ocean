import React, { useRef, useEffect, useMemo } from "react";
import { NPC, UserInfo } from "../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface NPCGraphicProps {
  npc: NPC;
  users: Map<string, UserInfo>;
  localUserId?: string; // Add this to identify local user
  followingUser?: UserInfo; // The user this NPC is following (if any)
  onCollision?: (npc: NPC) => void;
}

const NPCGraphic: React.FC<NPCGraphicProps> = ({
  npc,
  users,
  localUserId,
  followingUser,
  onCollision,
}) => {
  const group = useMemo(() => new THREE.Group(), []);
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector2());
  const collisionSet = useRef<Set<string>>(new Set());
  const textureLoaded = useRef(false);
  const currentPosition = useMemo(() => new THREE.Vector3(), []);

  // Set initial position and direction
  useEffect(() => {
    if (npc.position && followingUser === undefined) {
      positionRef.current.set(npc.position.x, npc.position.y, npc.position.z);
    }
    if (npc.direction) {
      directionRef.current.set(npc.direction.x, npc.direction.y);
    }
  }, [followingUser, npc]);

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

  // Modify the useEffect that sets up the mesh
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    // Check if this is the first setup by looking at currentPosition
    const isFirstSetup = currentPosition.lengthSq() === 0;

    if (isFirstSetup && followingUser && followingUser.position) {
      // Calculate position using the helper function
      const position = calculateFollowPosition(followingUser, npc.id);

      // Set initial position directly
      positionRef.current.copy(position);
      currentPosition.copy(positionRef.current);
      group.position.copy(currentPosition);
    } else {
      // Default behavior
      currentPosition.copy(positionRef.current);
      group.position.copy(currentPosition);
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

    return () => {
      if (texture.current) texture.current.dispose();
      if (material.current) material.current.dispose();
      if (mesh.current && mesh.current.geometry)
        mesh.current.geometry.dispose();
    };
  }, [currentPosition, group, npc.filename, followingUser, npc.id]);

  // Handle updates and collisions
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

    if (followingUser && followingUser.position) {
      // Calculate current target position
      const targetPosition = calculateFollowPosition(followingUser, npc.id);

      // Apply appropriate movement based on whether it's a local player's NPC
      const isLocalPlayerNPC = followingUser.id === localUserId;

      if (isLocalPlayerNPC) {
        positionRef.current.copy(targetPosition);
      } else {
        const LERP_FACTOR = 0.1;
        positionRef.current.lerp(targetPosition, LERP_FACTOR);
      }

      // Update group position
      group.position.copy(positionRef.current);

      // Update NPC position data
      npc.position.x = positionRef.current.x;
      npc.position.y = positionRef.current.y;
      npc.position.z = positionRef.current.z;
    }

    // Fixed upright rotation - NPCs don't rotate with captor
    group.rotation.z = 0;

    // Only check for collisions if we're not already following a user
    if (!followingUser && onCollision && localUserId) {
      const COLLISION_THRESHOLD = 2.5;
      const localUser = users.get(localUserId);

      if (localUser?.position) {
        const userPos = new THREE.Vector3(
          localUser.position.x,
          localUser.position.y,
          localUser.position.z
        );

        const distance = positionRef.current.distanceTo(userPos);

        if (distance < COLLISION_THRESHOLD) {
          if (!collisionSet.current.has(localUserId)) {
            onCollision(npc);
            collisionSet.current.add(localUserId);
          }
        } else {
          collisionSet.current.delete(localUserId);
        }
      }
    }
  });

  return <primitive object={group} />;
};

export default NPCGraphic;
