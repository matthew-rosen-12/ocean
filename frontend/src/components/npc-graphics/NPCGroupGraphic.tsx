import React, { useMemo, useRef, useEffect } from "react";
import { NPC, NPCGroup, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { smoothMove } from "../../utils/movement";
import { useNPCBase, useMount } from "../../hooks/useNPCBase";
import {
  getAnimalBorderColor,
  getAnimalIndicatorColor,
} from "../../utils/animal-colors";
import useOutlineEffect from "../../utils/graphics";

// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user

interface NPCGroupGraphicProps {
  group: NPCGroup;
  user: UserInfo;
  npcs: Map<string, NPC>;
  animalWidth: number | undefined;
}

const NPCGroupGraphic: React.FC<NPCGroupGraphicProps> = ({
  group,
  user,
  npcs,
  animalWidth,
}) => {
  // Skip rendering if no user or no NPCs
  if (!user || group.npcIds.size === 0) {
    return null;
  }

  // If animal width is not set, don't render
  if (!animalWidth) {
    return null;
  }

  // Add effect to track component lifecycle
  useEffect(() => {
    // Only log mounting in debug mode
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[NPCGroupGraphic] Component MOUNTED for user ${user.id}, captorId: ${
          group.captorId
        }, npcIds: ${Array.from(group.npcIds).join(",")}`
      );
    }
    return () => {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[NPCGroupGraphic] Component UNMOUNTING for user ${user.id}, captorId: ${group.captorId}`
        );
      }
    };
  }, []);

  // Get first NPC id from the group and find the actual NPC
  const firstNpcId =
    group.npcIds.size === 0 ? null : group.npcIds.values().next().value;

  // If there's no NPC in the group, don't render anything
  if (!firstNpcId) return null;

  // Get the real NPC from the npcs map
  const npc = npcs.get(firstNpcId)!;

  // Calculate logarithmic scale factor based on number of NPCs
  const scaleFactor = useMemo(() => {
    const numNpcs = group.npcIds.size;
    if (numNpcs === 0) return 0;

    // Logarithmic scaling function - log base 2 gives a nice curve
    // Scale starts at 1 for 1 NPC and roughly doubles for each doubling of NPCs
    const baseScale = 3;
    const logScale = Math.log(numNpcs) / Math.log(4);

    return baseScale * (1 + logScale);
  }, [group.npcIds.size]);

  // Use the NPCBase hook with the real NPC
  const {
    group: threeGroup,
    positionRef,
    textureLoaded,
    updatePositionWithTracking,
    mesh,
  } = useNPCBase(npc);

  const { addToOutline, removeFromOutline } = useOutlineEffect();

  // Add a badge showing the number of NPCs in the group
  const npcsCount = group.npcIds.size;

  // Reference to store the indicator position
  const indicatorRef = useRef<THREE.Group>(null);
  // Reference for the background circle
  const backgroundCircleRef = useRef<THREE.Mesh>(null);

  // Calculate target position behind the user based on their direction
  const calculateTargetPosition = (
    userPosition: THREE.Vector3
  ): THREE.Vector3 => {
    // Default direction if not specified (backward is -x)
    let directionX = -1;
    let directionY = 0;

    // If user has a direction, use the inverse of it to position behind
    if (user.direction) {
      // Normalize direction
      const length = Math.sqrt(
        user.direction.x * user.direction.x +
          user.direction.y * user.direction.y
      );
      if (length > 0.001) {
        directionX = -user.direction.x / length; // Opposite X direction
        directionY = -user.direction.y / length; // Opposite Y direction
      }
    }

    // Calculate position that is animalWidth + scaled NPC width + FOLLOW_DISTANCE units behind the user
    let npcWidth = 0;
    if (mesh.current) {
      npcWidth = mesh.current.scale.x; // width of the NPC mesh
    }
    return new THREE.Vector3(
      userPosition.x +
        directionX * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
      userPosition.y +
        directionY * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
      -0.1 // Place slightly behind in z-index
    );
  };

  // Set initial position
  useMount(() => {
    // Start with initial position behind user
    const initialPosition = calculateTargetPosition(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z)
    );

    updatePositionWithTracking(initialPosition, "NPCGroup-initial");
    threeGroup.position.copy(positionRef.current);

    // Apply the scale based on number of NPCs
    if (mesh.current) {
      // Apply our logarithmic scaling
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);
    }
  });

  // Add effect to add outline to the main group (only once)
  useEffect(() => {
    console.log(
      `[NPCGroupGraphic] Adding group ${threeGroup.uuid} to outline for user ${user.id}`
    );
    addToOutline(threeGroup, getAnimalBorderColor(user));

    return () => {
      console.log(
        `[NPCGroupGraphic] Removing group ${threeGroup.uuid} from outline for user ${user.id}`
      );
      removeFromOutline(threeGroup);
    };
  }, [threeGroup.uuid, user.id]); // Fixed: depend on threeGroup.uuid so it re-runs when Group changes

  // Separate effect for background circle outline (when count > 1)
  useEffect(() => {
    if (npcsCount > 1 && backgroundCircleRef.current) {
      console.log(
        `[NPCGroupGraphic] Adding background circle to outline for user ${user.id}, count: ${npcsCount}`
      );
      addToOutline(backgroundCircleRef.current, getAnimalBorderColor(user));

      return () => {
        if (backgroundCircleRef.current) {
          console.log(
            `[NPCGroupGraphic] Removing background circle from outline for user ${user.id}`
          );
          removeFromOutline(backgroundCircleRef.current);
        }
      };
    }
  }, [npcsCount > 1, user.id, backgroundCircleRef.current]); // Fixed: include backgroundCircleRef.current

  // Handle position updates to follow the user
  useFrame(() => {
    if (!threeGroup || !textureLoaded.current) return;

    // Calculate target position with offset from user
    const targetPosition = calculateTargetPosition(
      new THREE.Vector3(user.position.x, user.position.y, user.position.z)
    );

    if (!positionRef.current.equals(targetPosition)) {
      updatePositionWithTracking(
        smoothMove(positionRef.current.clone(), targetPosition),
        "NPCGroup"
      );
      threeGroup.position.copy(positionRef.current);
    }
    // Always update indicator position to follow the group
    if (indicatorRef.current && mesh.current) {
      indicatorRef.current.position.copy(positionRef.current);
      indicatorRef.current.position.y += mesh.current.scale.y / 2 + 2.8;
    }

    // Make a subtle oscillation to indicate this is a group
    const time = Date.now() / 1000;
    const oscillation = Math.sin(time * 2) * 0.05; // Reduced oscillation
    threeGroup.rotation.z = oscillation;

    // Keep scale constant - no more pulsing
    if (mesh.current) {
      // Ensure the mesh scale remains consistent with the scaleFactor
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Counter indicator showing the number of NPCs */}
      {npcsCount > 1 && (
        <group ref={indicatorRef}>
          {/* Background circle */}
          <mesh ref={backgroundCircleRef}>
            <circleGeometry args={[1.5, 32]} />
            <meshBasicMaterial color={getAnimalIndicatorColor(user)} />
          </mesh>
          {/* Text showing count */}
          <Text
            position={[0, -0.2, 0]}
            fontSize={2.2}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
          >
            {npcsCount}
          </Text>
        </group>
      )}
    </>
  );
};

export default React.memo(NPCGroupGraphic, (prevProps, nextProps) => {
  // Compare group properties
  const captorIdSame = prevProps.group.captorId === nextProps.group.captorId;
  const sizeSame = prevProps.group.npcIds.size === nextProps.group.npcIds.size;
  const prevNpcIds = Array.from(prevProps.group.npcIds).sort();
  const nextNpcIds = Array.from(nextProps.group.npcIds).sort();
  const npcIdsSame = prevNpcIds.every((id, index) => id === nextNpcIds[index]);

  const groupsSame = captorIdSame && sizeSame && npcIdsSame;

  // Compare other props
  const userSame = prevProps.user.id === nextProps.user.id;
  const animalWidthSame = prevProps.animalWidth === nextProps.animalWidth;

  const shouldNotRerender = groupsSame && userSame && animalWidthSame;

  // Only log when legitimately re-rendering due to content changes
  if (!shouldNotRerender && (!groupsSame || !userSame || !animalWidthSame)) {
    console.log(
      `[NPCGroupGraphic] Re-rendering for user ${nextProps.user.id}:`,
      {
        groupsSame,
        userSame,
        animalWidthSame,
        reason: !groupsSame
          ? "group changed"
          : !userSame
          ? "user changed"
          : "animalWidth changed",
      }
    );
  }

  return shouldNotRerender;
});
