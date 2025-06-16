import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  NPCGroup,
  pathData,
  UserInfo,
  PathPhase,
  NPCPhase,
  NPCGroupsBiMap,
} from "shared/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
// @ts-ignore - troika-three-text doesn't have TypeScript definitions
import { preloadFont } from "troika-three-text";
import { smoothMove } from "../../utils/movement";
import { useNPCGroupBase, useMount } from "../../hooks/useNPCGroupBase";
import { getAnimalBorderColor } from "../../utils/animal-colors";
import { createEdgeGeometry } from "../../utils/load-animal-svg";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { TerrainBoundaries } from "../../utils/terrain";
import {
  calculateNPCGroupScale,
  calculateNPCGroupPosition,
} from "../../utils/npc-group-utils";
import { socket } from "../../socket";
import { serialize } from "../../utils/typed-socket";
import { v4 as uuidv4 } from "uuid";
// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user
const FONT_URL = "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff";

// Preload the font at module level with common characters
let fontPreloaded = false;
const preloadFontSafely = () => {
  if (!fontPreloaded) {
    try {
      preloadFont({ 
        font: FONT_URL, 
        characters: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
      }, () => {
        fontPreloaded = true;
      });
    } catch (error) {
      console.warn("Font preloading failed:", error);
      fontPreloaded = true; // Allow text to render anyway
    }
  }
};

// Call preload function
preloadFontSafely();

// Deterministic random function that produces consistent results across all clients
function getRandom(input: Record<string, any>): number {
  // Create deterministic hash from server-synchronized data only
  const hashInput = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort keys for consistency
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
    
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to a value between -0.5 and 0.5
  return ((hash % 1000) / 1000) - 0.5;
}

interface CapturedNPCGroupGraphicProps {
  group: NPCGroup;
  user: UserInfo;
  npcGroups: NPCGroupsBiMap;
  allPaths: Map<string, pathData>;
  setPaths: (
    paths:
      | Map<string, pathData>
      | ((prev: Map<string, pathData>) => Map<string, pathData>)
  ) => void;
  setNpcGroups: (
    npcGroups:
      | NPCGroupsBiMap
      | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  animalWidth: number | undefined;
  isLocalUser: boolean; // Add flag to distinguish local vs non-local users
  terrainBoundaries?: TerrainBoundaries; // Add terrain boundaries for wrapping
  users: Map<string, UserInfo>; // All users for getting group positions
}

const CapturedNPCGroupGraphic: React.FC<CapturedNPCGroupGraphicProps> = ({
  group,
  user,
  npcGroups,
  allPaths,
  setPaths,
  setNpcGroups,
  animalWidth,
  isLocalUser = false, // Default to false for non-local users
}) => {
  // State to track if text is ready to render
  const [textReady, setTextReady] = useState(false);
  
  // Skip rendering if no user or no NPCs
  if (!user || group.fileNames.length === 0) {
    return null;
  }

  // If animal width is not set, don't render
  if (!animalWidth) {
    return null;
  }

  // Calculate logarithmic scale factor based on number of NPCs
  const scaleFactor = useMemo(() => {
    return calculateNPCGroupScale(group.fileNames.length);
  }, [group.fileNames.length]);


  // Get the real face NPC from the npcs map
  // Use the NPCBase hook with the face NPC
  const {
    group: threeGroup,
    positionRef,
    textureLoaded,
    updatePositionWithTracking,
    mesh,
  } = useNPCGroupBase(group);

  // Add a badge showing the number of NPCs in the group
  const npcsCount = group.fileNames.length;

  // Reference to store the indicator position
  const indicatorRef = useRef<THREE.Group>(null);
  // Reference for the edge geometry outline
  const edgeGeometryRef = useRef<THREE.Object3D | null>(null);
  // Reference for smooth movement interpolation (non-local users)
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  // Memoize target position calculation to avoid unnecessary recalculations
  // Only memoize for non-local users since local users need real-time updates
  const memoizedTargetPosition = useMemo(() => {
    if (isLocalUser) return null; // Don't memoize for local users
    return calculateNPCGroupPosition(user, animalWidth, scaleFactor);
  }, [
    isLocalUser,
    user.position.x,
    user.position.y,
    user.direction.x,
    user.direction.y,
    animalWidth,
    scaleFactor,
  ]);

  // Export position and scale calculation functions for collision detection
  const calculateTargetPosition = (): THREE.Vector3 => {
    // For local users, always calculate fresh to ensure real-time updates
    // For non-local users, use memoized value for performance
    if (isLocalUser) {
      return calculateNPCGroupPosition(user, animalWidth, scaleFactor);
    }
    return memoizedTargetPosition!;
  };

  const getCurrentScale = (): number => {
    return scaleFactor;
  };

  const handleNPCGroupReflection = (
    npcGroup: NPCGroup,
    pathData: pathData,
    currentPathPosition: THREE.Vector3
  ) => {
    if (!setPaths || !setNpcGroups || pathData.pathPhase !== PathPhase.THROWN) return;


    // Calculate reflection direction (away from the group)
    const npcGroupPosition = calculateNPCGroupPosition(user, animalWidth, scaleFactor);
    if (!npcGroupPosition) return;
    const reflectionDirection = {
      x: currentPathPosition.x - npcGroupPosition.x,
      y: currentPathPosition.y - npcGroupPosition.y,
    };


    // Normalize reflection direction
    const length = Math.sqrt(
      reflectionDirection.x * reflectionDirection.x +
        reflectionDirection.y * reflectionDirection.y
    );
    
    // Get deterministic random value based on server-synchronized data only
    const normalizedHash = getRandom({
      pathId: pathData.id,
      npcGroupId: npcGroup.id,
      captorId: group.captorId,
      timestamp: pathData.timestamp
    });
    
    // Handle edge case where collision is exactly at center
    let normalizedDirection = length > 0 ? {
      x: reflectionDirection.x / length,
      y: reflectionDirection.y / length,
    } : {
      x: normalizedHash, // Deterministic direction if collision at exact center
      y: normalizedHash * 0.7, // Use different multiplier for y to avoid purely diagonal movement
    };

    // Add deterministic offset to reflection for more interesting bounces (consistent across clients)
    const randomOffset = 0.3; // Adjust this value to control randomness (0 = no randomness, 1 = very random)
    const randomAngle = normalizedHash * Math.PI * randomOffset; // Deterministic angle between -π*offset/2 and π*offset/2
    
    // Apply rotation to the normalized direction
    const cos = Math.cos(randomAngle);
    const sin = Math.sin(randomAngle);
    normalizedDirection = {
      x: normalizedDirection.x * cos - normalizedDirection.y * sin,
      y: normalizedDirection.x * sin + normalizedDirection.y * cos,
    };

    // Create reflection path for the thrown NPC
    const reflectionPathData: pathData = {
      id: uuidv4(),
      room: pathData.room,
      npcGroup: npcGroup,
      startPosition: {
        x: currentPathPosition.x,
        y: currentPathPosition.y,
      },
      direction: normalizedDirection,
      pathDuration: 1200, // Reflection duration
      velocity:pathData.velocity, // Fast reflection speed
      timestamp: Date.now(),
      pathPhase: PathPhase.BOUNCING,
    };

    setPaths((prev: Map<string, pathData>) => {
      const newPaths = new Map(prev);
      newPaths.set(npcGroup.id, reflectionPathData);
      console.log("newPaths", newPaths);
      return newPaths;
    });

    // Send reflection to server
    const currentSocket = socket();
    if (currentSocket) {
      currentSocket.emit(
        "path-npc",
        serialize({ pathData: reflectionPathData }),
        (response: { success: boolean }) => {
          if (!response.success) console.error("NPC reflection failed");
        }
      );
    }


      const groupPosition = calculateTargetPosition();
             // split npc group into 2 groups - one with no captor Id and just the face npc, and the other with the captor id and the rest of the filenames
       const faceFileName = group.faceFileName;
       if (!faceFileName) return;
       
       const emittedNPCGroup = new NPCGroup({
        ...group,
         id: uuidv4(),
         fileNames: [faceFileName],
         captorId: undefined,
         phase: NPCPhase.PATH,
         direction: normalizedDirection,
         position: groupPosition,
       });

       const restOfNPCs = group.fileNames.filter((fileName) => fileName !== faceFileName);
       const restOfNPCsGroup = new NPCGroup({
         ...group,
         fileNames: restOfNPCs,
       });


      if (emittedNPCGroup) {
        // Update local state
        const emissionPathData: pathData = {
          id: uuidv4(),
          room: pathData.room,
          npcGroup: emittedNPCGroup,
          startPosition: group.position,
          direction: normalizedDirection,
          pathDuration: 1500, // Longer emission duration
          velocity: 5, // Very fast emission speed
          timestamp: Date.now(),
          pathPhase: PathPhase.BOUNCING,
        };
        setPaths((prev: Map<string, pathData>) => {
          const newPaths = new Map(prev);
          newPaths.set(emittedNPCGroup.id, emissionPathData);
          return newPaths;
        });
        setNpcGroups((prev: NPCGroupsBiMap) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          newNpcGroups.setByNpcGroupId(emittedNPCGroup.id, emittedNPCGroup);
          newNpcGroups.setByNpcGroupId(restOfNPCsGroup.id, restOfNPCsGroup);
          return newNpcGroups;
        });

        currentSocket.emit(
          "path-npc",
          serialize({ pathData: emissionPathData }),
          (response: { success: boolean }) => {
            if (!response.success) console.error("NPC emission failed");
          }
        );
    }
  };

  const checkForPathNPCCollision = (npcGroup: NPCGroup, pathData: pathData) => {
    if (pathData.pathPhase !== PathPhase.THROWN) return false;

    const calculatePathPosition = (pathData: pathData, currentTime: number) => {
      // Calculate elapsed time in seconds
      const elapsedTime = (currentTime - pathData.timestamp) / 1000;
      const pathDurationSec = pathData.pathDuration / 1000;
      const progress = Math.min(elapsedTime / pathDurationSec, 1);

      let position: THREE.Vector3;

      // If we've reached the end of the path, use exact same calculation as server
      if (progress >= 1) {
        const finalDistance = pathData.velocity * pathDurationSec;
        position = new THREE.Vector3(
          pathData.startPosition.x + pathData.direction.x * finalDistance,
          pathData.startPosition.y + pathData.direction.y * finalDistance,
          0
        );
      } else {
        // For animation, calculate intermediate position
        const distance = pathData.velocity * elapsedTime;
        position = new THREE.Vector3(
          pathData.startPosition.x + pathData.direction.x * distance,
          pathData.startPosition.y + pathData.direction.y * distance,
          0
        );
      }

      return position;
    };

    // Check npc group collsiion with the path data, using npc group position and scale and path data calculated position
    const currentPathPostion = calculatePathPosition(pathData, Date.now());
    const npcGroupPosition = calculateNPCGroupPosition(
      user,
      animalWidth,
      scaleFactor
    );

    const npcGroupScale = scaleFactor;
    const npcGroupRadius = npcGroupScale;
    const distance = npcGroupPosition ? npcGroupPosition.distanceTo(currentPathPostion) : Infinity;
    if (distance < npcGroupRadius && group.fileNames.length > 0) {
      handleNPCGroupReflection(npcGroup, pathData, currentPathPostion);
      return true;
    }

    return false;
  };

  // Add effect to track component lifecycle
  useEffect(() => {
    return () => {
      // Cleanup edge geometry
      if (edgeGeometryRef.current) {
        // Dispose of edge geometry materials and geometry
        edgeGeometryRef.current.traverse((child) => {
          if (
            child instanceof THREE.Mesh ||
            child instanceof THREE.LineSegments
          ) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });

        // Remove from parent if still attached
        if (edgeGeometryRef.current.parent) {
          edgeGeometryRef.current.parent.remove(edgeGeometryRef.current);
        }

        edgeGeometryRef.current = null;
      }
    };
  }, []);

  // Add effect to recreate outline when group size changes
  useEffect(() => {
    // Remove existing edge geometry when group size changes
    if (edgeGeometryRef.current) {
      // Dispose of edge geometry materials and geometry
      edgeGeometryRef.current.traverse((child) => {
        if (
          child instanceof THREE.Mesh ||
          child instanceof THREE.LineSegments
        ) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      // Remove from parent if still attached
      if (edgeGeometryRef.current.parent) {
        edgeGeometryRef.current.parent.remove(edgeGeometryRef.current);
      }

      edgeGeometryRef.current = null;
    }
  }, [group.fileNames.length, scaleFactor]);

  // Effect to handle text preloading
  useEffect(() => {
    // Check if font is preloaded and mark text as ready
    const checkFontReady = () => {
      if (fontPreloaded) {
        setTextReady(true);
      } else {
        setTimeout(checkFontReady, 50);
      }
    };
    
    // Start checking after a small delay
    const timer = setTimeout(checkFontReady, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Set initial position
  useMount(() => {
    // Start with initial position behind user
    const initialPosition = calculateTargetPosition();

    updatePositionWithTracking(initialPosition, "NPCGroup-initial");
    threeGroup.position.copy(positionRef.current);

    // Initialize previousPosition for smooth interpolation
    previousPosition.copy(positionRef.current);

    // Apply the scale based on number of NPCs
    if (mesh.current) {
      // Apply our logarithmic scaling
      mesh.current.scale.set(scaleFactor, scaleFactor, 1);

      // Create edge geometry outline for the NPC
      const borderColor = getAnimalBorderColor(user);

      // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
      const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
      const edgeGeometry = createEdgeGeometry(
        borderColor,
        false, // NPCs are never local player
        squareOutlineGeometry, // Use our custom square outline
        undefined // No fallback needed
      );

      // Position the outline behind the NPC
      edgeGeometry.position.z = -0.01;

      // Add the edge geometry to the group
      threeGroup.add(edgeGeometry);
      edgeGeometryRef.current = edgeGeometry;

      // Scale the edge geometry to match the mesh
      edgeGeometry.scale.set(scaleFactor, scaleFactor, 1);
    }
  });

  // Handle position updates to follow the user
  useFrame(() => {
    if (!threeGroup || !textureLoaded.current) return;

    // Calculate target position with offset from user
    const targetPosition = calculateTargetPosition();

    // Check for collisions with path NPCs if we have the required props

    // Both local and non-local users use smoothMove for nice interpolated following:
    // - Local: interpolates towards target calculated from immediate user position
    // - Non-local: interpolates towards target calculated from discrete socket user position
    // For non-local users, we need SLOWER interpolation so NPC group lags behind
    // the already-interpolated animal position
    if (!positionRef.current.equals(targetPosition)) {
      const interpolationParams = isLocalUser
        ? {
            // Local users: standard interpolation creates nice lag relative to immediate movement
            lerpFactor: 0.2,
            moveSpeed: 0.5,
            minDistance: 0.01,
            useConstantSpeed: true,
          }
        : {
            lerpFactor: 0.07,
            moveSpeed: 0.5,
            minDistance: 0.01,
            useConstantSpeed: true,
          };

      updatePositionWithTracking(
        smoothMove(
          positionRef.current.clone(),
          targetPosition,
          interpolationParams
        ),
        "NPCGroup"
      );
      threeGroup.position.copy(positionRef.current);
    }

    // Always update indicator position to follow the group
    if (indicatorRef.current && mesh.current) {
      indicatorRef.current.position.copy(threeGroup.position);
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

      // Create or update edge geometry if needed
      if (!edgeGeometryRef.current && textureLoaded.current) {
        const borderColor = getAnimalBorderColor(user);

        // Create a square outline instead of using EdgesGeometry to avoid diagonal lines
        const squareOutlineGeometry = createSquareOutlineGeometry(1, 1); // 1x1 square, will be scaled
        const edgeGeometry = createEdgeGeometry(
          borderColor,
          false, // NPCs are never local player
          squareOutlineGeometry, // Use our custom square outline
          undefined // No fallback needed
        );

        // Position the outline behind the NPC
        edgeGeometry.position.z = -0.01;

        // Add the edge geometry to the group
        threeGroup.add(edgeGeometry);
        edgeGeometryRef.current = edgeGeometry;

        // Scale the edge geometry to match the mesh
        edgeGeometry.scale.set(scaleFactor, scaleFactor, 1);
      }
    }
    // only check for collision for local npc group
    if (isLocalUser) {
             Array.from(allPaths.entries()).forEach(([npcId, pathData]) => {
         if (
           pathData.pathPhase === PathPhase.THROWN &&
           pathData.npcGroup.captorId !== group.captorId
         ) {
           const pathNPC = npcGroups.getByNpcGroupId(npcId)!;

           checkForPathNPCCollision(pathNPC, pathData);
         }
       });
    }
  });

  return (
    <>
      <primitive object={threeGroup} />

      {/* Counter indicator showing the number of NPCs */}
      {npcsCount > 1 && textReady && (
        <group ref={indicatorRef}>
          {/* Text showing count with outline */}
          <Text
            position={[0, -0.5, 0]}
            fontSize={2.8}
            color={getAnimalBorderColor(user)}
            anchorX="center"
            anchorY="middle"
            font={FONT_URL}
            outlineWidth={0.1}
            outlineColor="white"
          >
            {npcsCount}
          </Text>
        </group>
      )}
    </>
  );
};

export default React.memo(CapturedNPCGroupGraphic, (prevProps, nextProps) => {
  // Compare group properties
  const captorIdSame = prevProps.group.captorId === nextProps.group.captorId;
  const sizeSame = prevProps.group.fileNames.length === nextProps.group.fileNames.length;
  const prevNpcIds = Array.from(prevProps.group.fileNames).sort();
  const nextNpcIds = Array.from(nextProps.group.fileNames).sort();
  const npcIdsSame = prevNpcIds.every((id, index) => id === nextNpcIds[index]);

  const groupsSame = captorIdSame && sizeSame && npcIdsSame;

  // Compare other props including user position
  const userSame = prevProps.user.id === nextProps.user.id;
  const userPositionSame =
    prevProps.user.position.x === nextProps.user.position.x &&
    prevProps.user.position.y === nextProps.user.position.y 
  const userDirectionSame =
    prevProps.user.direction.x === nextProps.user.direction.x &&
    prevProps.user.direction.y === nextProps.user.direction.y;
  const animalWidthSame = prevProps.animalWidth === nextProps.animalWidth;

  // Compare allPaths - this is critical for collision detection
  const allPathsSame = prevProps.allPaths.size === nextProps.allPaths.size &&
    Array.from(prevProps.allPaths.entries()).every(([npcId, pathData]) => {
      const nextPathData = nextProps.allPaths.get(npcId);
      return nextPathData && 
        pathData.id === nextPathData.id &&
        pathData.timestamp === nextPathData.timestamp &&
        pathData.pathPhase === nextPathData.pathPhase;
    });

  const shouldNotRerender =
    groupsSame &&
    userSame &&
    userPositionSame &&
    userDirectionSame &&
    animalWidthSame &&
    allPathsSame;

  return shouldNotRerender;
});

// Function to create a square outline geometry
function createSquareOutlineGeometry(
  width: number,
  height: number
): LineGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Create square outline points (clockwise)
  const linePositions = [
    // Bottom edge
    -halfWidth,
    -halfHeight,
    0,
    halfWidth,
    -halfHeight,
    0,
    // Right edge
    halfWidth,
    -halfHeight,
    0,
    halfWidth,
    halfHeight,
    0,
    // Top edge
    halfWidth,
    halfHeight,
    0,
    -halfWidth,
    halfHeight,
    0,
    // Left edge
    -halfWidth,
    halfHeight,
    0,
    -halfWidth,
    -halfHeight,
    0,
  ];

  const lineGeometry = new LineGeometry();
  lineGeometry.setPositions(new Float32Array(linePositions));
  return lineGeometry;
}
