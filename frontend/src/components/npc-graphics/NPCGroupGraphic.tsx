import React, { useEffect, useMemo, useRef } from "react";
import { NPC, NPCGroup, UserInfo } from "../../utils/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { smoothMove } from "../../utils/movement";
import { useNPCBase } from "../../hooks/useNPCBase";
import {
  getAnimalBorderColor,
  getAnimalIndicatorColor,
} from "../../utils/animal-colors";

// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user
const OUTLINE_WIDTH = 0.2; // Width of the outline effect

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
  console.log("rendering npc group graphic");
  if (!user || group.npcIds.size === 0) {
    console.log("skipping npc group graphic 1");
    return null;
  }

  // If animal width is not set, don't render
  console.log("animalWidth", animalWidth);
  if (!animalWidth) {
    console.log("skipping npc group graphic 2");
    return null;
  }

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

  // Add a badge showing the number of NPCs in the group
  const npcsCount = group.npcIds.size;

  // Reference to store the indicator position
  const indicatorRef = useRef<THREE.Group>(null);

  // Create a border color for the NPC group
  const outlineColor = useMemo(() => getAnimalBorderColor(user), [user]);

  // Reference for the outline mesh
  const outlineRef = useRef<THREE.Mesh | null>(null);

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

  // Create outline shape from mesh dimensions
  const createOutline = (width: number, height: number) => {
    if (outlineRef.current) {
      threeGroup.remove(outlineRef.current);
    }

    // Create a slightly larger rectangle for the outline
    const outlineWidth = width + OUTLINE_WIDTH;
    const outlineHeight = height + OUTLINE_WIDTH;

    // Create a shape with a hole for the outline effect
    const outlineShape = new THREE.Shape();
    outlineShape.moveTo(-outlineWidth / 2, -outlineHeight / 2);
    outlineShape.lineTo(outlineWidth / 2, -outlineHeight / 2);
    outlineShape.lineTo(outlineWidth / 2, outlineHeight / 2);
    outlineShape.lineTo(-outlineWidth / 2, outlineHeight / 2);
    outlineShape.lineTo(-outlineWidth / 2, -outlineHeight / 2);

    // Create inner hole (slightly smaller than the actual NPC image)
    const innerWidth = width - 1.5;
    const innerHeight = height - 1.5;

    const hole = new THREE.Path();
    hole.moveTo(-innerWidth / 2, -innerHeight / 2);
    hole.lineTo(innerWidth / 2, -innerHeight / 2);
    hole.lineTo(innerWidth / 2, innerHeight / 2);
    hole.lineTo(-innerWidth / 2, innerHeight / 2);
    hole.lineTo(-innerWidth / 2, -innerHeight / 2);

    outlineShape.holes.push(hole);

    // Create geometry from shape
    const geometry = new THREE.ShapeGeometry(outlineShape);
    const material = new THREE.MeshBasicMaterial({
      color: outlineColor,
      side: THREE.DoubleSide,
    });

    outlineRef.current = new THREE.Mesh(geometry, material);
    outlineRef.current.renderOrder = 1; // Ensure it renders behind the NPC but visible
    threeGroup.add(outlineRef.current);
  };

  // Set initial position
  useEffect(() => {
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

      // Create outline based on mesh size
      const width = mesh.current.scale.x * 1.1; // Slightly larger than the NPC
      const height = mesh.current.scale.y * 1.1;

      createOutline(width, height);
    }
  }, [
    user.position,
    user.direction,
    scaleFactor,
    threeGroup,
    positionRef,
    updatePositionWithTracking,
    mesh,
    outlineColor,
  ]);

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

      // Update outline to match the mesh size if it exists
      if (outlineRef.current) {
        const width = mesh.current.scale.x * 1.1;
        const height = mesh.current.scale.y * 1.1;

        // Remove and recreate the outline with the new dimensions
        createOutline(width, height);
      }
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Counter indicator showing the number of NPCs */}
      {npcsCount > 1 && (
        <group ref={indicatorRef}>
          {/* Background circle */}
          <mesh>
            <circleGeometry args={[1.5, 32]} />
            <meshBasicMaterial color={getAnimalIndicatorColor(user)} />
          </mesh>
          {/* Outline for the counter */}
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
  return (
    prevProps.group.npcIds.size === nextProps.group.npcIds.size &&
    prevProps.animalWidth !== undefined &&
    prevProps.user === nextProps.user
  );
});
