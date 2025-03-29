import React, { useRef, useEffect } from "react";
import { NPC, UserInfo } from "../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface NPCGraphicProps {
  npc: NPC;
  users: Map<string, UserInfo>;
  followingUser?: UserInfo; // The user this NPC is following (if any)
  onCollision?: (user: UserInfo, npc: NPC) => void;
}

const NPCGraphic: React.FC<NPCGraphicProps> = ({
  npc,
  users,
  followingUser,
  onCollision,
}) => {
  const group = useRef<THREE.Group>(new THREE.Group());
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector2());
  const collisionSet = useRef<Set<string>>(new Set());
  const textureLoaded = useRef(false);

  // Set initial position and direction
  useEffect(() => {
    if (npc.position) {
      positionRef.current.set(npc.position.x, npc.position.y, npc.position.z);
    }
    if (npc.direction) {
      directionRef.current.set(npc.direction.x, npc.direction.y);
    }
  }, [npc]);

  // Load texture
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

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

        if (group.current) {
          group.current.add(mesh.current);
          textureLoaded.current = true;
        }
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
  }, [npc.filename]);

  // Handle updates and collisions
  useFrame(() => {
    if (!group.current || !textureLoaded.current) return;

    // If following a user, update position to follow
    if (followingUser && followingUser.position && followingUser.direction) {
      // Get user direction
      const dx = followingUser.direction.x;
      const dy = followingUser.direction.y;

      // Normalize direction
      const dirLength = Math.sqrt(dx * dx + dy * dy);
      const normalizedDx = dx / dirLength;
      const normalizedDy = dy / dirLength;

      // Position behind the user
      const offsetDistance = 4.5; // Distance behind user
      const offsetIndex =
        followingUser.npcGroup?.npcs.findIndex((n) => n.id === npc.id) || 0;
      const lineOffset = (offsetIndex + 1) * offsetDistance;

      // Calculate base position
      let posX = followingUser.position.x - normalizedDx * lineOffset;
      let posY = followingUser.position.y - normalizedDy * lineOffset;

      // For staggered formation, use perpendicular vector
      if (offsetIndex > 0) {
        const perpDx = -normalizedDy;
        const perpDy = normalizedDx;
        const spreadFactor =
          (offsetIndex % 2 === 0 ? 1 : -1) * Math.ceil(offsetIndex / 2) * 1.2;
        posX += perpDx * spreadFactor;
        posY += perpDy * spreadFactor;
      }

      // Update position
      positionRef.current.set(posX, posY, 0);
      npc.position.x = posX;
      npc.position.y = posY;
      npc.position.z = 0;

      // Don't update rotation or direction
      // We'll keep the NPC's original direction
    }

    // Update group position
    group.current.position.copy(positionRef.current);

    // Fixed upright rotation - NPCs don't rotate with captor
    group.current.rotation.z = 0;

    // Only check for collisions if we're not already following a user
    if (!followingUser && onCollision) {
      const COLLISION_THRESHOLD = 2.5;
      const currentlyColliding = new Set<string>();

      Array.from(users.entries()).forEach(([userId, user]) => {
        if (!user.position) return;

        const userPos = new THREE.Vector3(
          user.position.x,
          user.position.y,
          user.position.z
        );

        const distance = positionRef.current.distanceTo(userPos);

        if (distance < COLLISION_THRESHOLD) {
          currentlyColliding.add(userId);

          if (!collisionSet.current.has(userId)) {
            onCollision(user, npc);
          }
        }
      });

      collisionSet.current = currentlyColliding;
    }
  });

  return <primitive object={group.current} />;
};

export default NPCGraphic;
