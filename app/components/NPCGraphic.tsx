import React, { useRef, useEffect, useMemo } from "react";
import { NPC, UserInfo } from "../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MOVE_SPEED } from "./AnimalGraphic";

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

  // Load texture
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();
    currentPosition.copy(positionRef.current);
    group.position.copy(currentPosition);

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
  }, [currentPosition, group, npc.filename]);

  // Handle updates and collisions
  useFrame(() => {
    if (!group || !textureLoaded.current) return;

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

      positionRef.current.set(posX, posY, 0);
      // Update position
      const isLocalPlayer = followingUser.id === localUserId;
      if (!isLocalPlayer) {
        const positionDelta = new THREE.Vector3().subVectors(
          positionRef.current,
          currentPosition
        );
        const distance = currentPosition.distanceTo(positionRef.current);

        // Handle movement with adaptive approach
        if (distance > 0.01) {
          const LERP_FACTOR = 0.1; // How fast to lerp (0-1)

          // Calculate how far we would move with LERP
          const lerpPosition = currentPosition
            .clone()
            .lerp(positionRef.current, LERP_FACTOR);
          const lerpDistance = currentPosition.distanceTo(lerpPosition);

          // Calculate how far we would move with constant speed
          const constantSpeedDistance = Math.min(MOVE_SPEED, distance);

          // Use whichever method moves us farther
          if (lerpDistance > constantSpeedDistance) {
            currentPosition.copy(lerpPosition);
          } else {
            // Constant speed is faster - use it
            currentPosition.addScaledVector(
              positionDelta.normalize(),
              constantSpeedDistance
            );
          }

          // Apply the calculated position
          group.position.copy(currentPosition);
        }
      } else {
        group.position.copy(positionRef.current);
      }
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
