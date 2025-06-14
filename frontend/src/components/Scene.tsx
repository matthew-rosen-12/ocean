// nature_v_npc/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Direction,
  NPCGroup,
  npcGroupId,
  NPCPhase,
  PathPhase,
  pathData,
  userId,
  UserInfo,
  DefaultMap,
  fileName,
} from "shared/types";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { socket } from "../socket";
import { Socket } from "socket.io-client";
import { ANIMAL_SCALES, DIRECTION_OFFSET } from "../utils/user-info";
import AnimalGraphic from "./AnimalGraphic";
import { throttle } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { serialize } from "../utils/serializers";
import NPCGraphicWrapper from "./npc-graphics/NPCGroupGraphicWrapper";
import NPCGroupGraphic from "./npc-graphics/CapturedNPCGroupGraphic";
import { useMount } from "../hooks/useNPCGroupBase";
import * as THREE from "three";
// Note: These functions may no longer be needed since NPCs are now NPCGroups
// import { removeFileNameFromGroup, addFileNameToGroup } from "../utils/npc-group-utils";
import { TerrainConfig } from "../utils/terrain";
("@react-three/fiber");
// Extend Performance interface for Chrome's memory API
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

// Speed of movement per keypress/frame
const MOVEMENT_SPEED = 0.5;
// Min distance before broadcasting position change
const POSITION_THRESHOLD = 0.01;
// Throttle duration in milliseconds
const THROTTLE_MS = 100;

interface CameraControllerProps {
  targetPosition: THREE.Vector3;
  animalScale: number;
}

function CameraController({ targetPosition }: CameraControllerProps) {
  const { camera } = useThree();
  const zdistance = 30;

  useEffect(() => {
    camera.position.set(targetPosition.x, targetPosition.y, zdistance);
  }, [camera, targetPosition.x, targetPosition.y, zdistance]);

  return null;
}

async function pathNPC(
  myUser: UserInfo,
  npc: NPC,
  npcs: Map<npcId, NPC>,
  npcGroups: DefaultMap<userId, NPCGroup>,
  paths: Map<npcId, pathData>,
  socket: Socket | null,
  setPaths: (paths: Map<npcId, pathData>) => void,
  setNpcGroups: (npcGroups: DefaultMap<userId, NPCGroup>) => void,
  setNpcs: (npcs: Map<npcId, NPC>) => void
) {
  try {
    // Create new objects instead of mutating
    const updatedNpc: NPC = {
      ...npc,
      position: myUser.position,
      phase: NPCPhase.path,
    };

    // TODO: This function may no longer be needed with NPCGroup structure
    // const updatedNpcGroups = removeNPCFromGroup(npcGroups, myUser.id, npc.id);

    // Create new path data
    const newpathData: pathData = {
      id: uuidv4(),
      room: myUser.room,
      npc: updatedNpc,
      startPosition: {
        x: myUser.position.x,
        y: myUser.position.y,
      },
      pathDuration: 2000,
      timestamp: Date.now(),
      captorId: myUser.id,
      direction: {
        x: Math.round(myUser.direction.x),
        y: Math.round(myUser.direction.y),
      },
      velocity: 20,
      pathPhase: PathPhase.THROWN, // This is a thrown NPC
    };

    // Create new paths map
    const updatedpaths = new Map(paths);
    updatedpaths.set(npc.id, newpathData);

    // Socket call to path the NPC
    if (socket) {
      socket.emit(
        "path-npc",
        serialize({ pathData: newpathData }),
        (response: { success: boolean }) => {
          if (!response.success) console.error("NPC path failed");
        }
      );
    }

    setPaths(updatedpaths);
    setNpcGroups(updatedNpcGroups);
    const updatedNpcs = new Map(npcs);
    updatedNpcs.set(npc.id, updatedNpc);
    setNpcs(updatedNpcs);
  } catch (error) {
    console.error("Error pathing NPC:", error);
  }
}

function useKeyboardMovement(
  initialPosition: THREE.Vector3,
  initialDirection: Direction,
  myUser: UserInfo,
  npcGroups: DefaultMap<userId, NPCGroup>,
  npcs: Map<npcId, NPC>,
  paths: Map<npcId, pathData>,
  setPaths: (paths: Map<npcId, pathData>) => void,
  setNpcGroups: (npcGroups: DefaultMap<userId, NPCGroup>) => void,
  setNpcs: (npcs: Map<npcId, NPC>) => void,
  terrain: TerrainConfig,
  animalDimensions: { [animal: string]: { width: number; height: number } },
  checkBoundaryCollision: (
    position: THREE.Vector3,
    change: THREE.Vector3,
    rotation: number,
    dimensions: { width: number; height: number }
  ) => THREE.Vector3
) {
  const [position, setPosition] = useState(initialPosition);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [keysPressed, setKeysPressed] = useState(new Set<string>());
  const animationFrameRef = useRef<number>();

  const handleKeyDown = (event: KeyboardEvent) => {
    setKeysPressed((prev) => new Set(prev).add(event.key));

    // Handle space bar press for pathing NPCs
    if (
      (event.key === " " || event.key === "Spacebar") &&
      npcGroups.get(myUser.id).npcIds.size > 0
    ) {
      // Get the first NPC ID from the set
      const npcIdTopath = npcGroups.get(myUser.id).npcIds.values().next().value;

      if (npcIdTopath) {
        const npc = npcs.get(npcIdTopath);
        if (npc) {
          pathNPC(
            myUser,
            npc,
            npcs,
            npcGroups,
            paths,
            socket(),
            setPaths,
            setNpcGroups,
            setNpcs
          );
        }
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    setKeysPressed((prev) => {
      const next = new Set(prev);
      next.delete(event.key);
      return next;
    });
  };

  const updatePosition = () => {
    const change = new THREE.Vector3(0, 0, 0);

    // Check which keys are pressed
    const up = keysPressed.has("ArrowUp") || keysPressed.has("w");
    const down = keysPressed.has("ArrowDown") || keysPressed.has("s");
    const left = keysPressed.has("ArrowLeft") || keysPressed.has("a");
    const right = keysPressed.has("ArrowRight") || keysPressed.has("d");

    // Update position vector
    if (up) change.y += MOVEMENT_SPEED;
    if (down) change.y -= MOVEMENT_SPEED;
    if (left) change.x -= MOVEMENT_SPEED;
    if (right) change.x += MOVEMENT_SPEED;

    // Primary direction logic
    let newDirection = { x: 0, y: 0 };

    // True diagonal movement - both components active
    if (!left && !right && up && !down) {
      newDirection = {
        x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: 1,
      };
    } else if (!left && !right && !up && down) {
      newDirection = {
        x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: -1,
      };
    } else {
      if (left && !right) {
        newDirection.x -= 1;
      } else if (right && !left) {
        newDirection.x += 1;
      }
      if (up && !down) {
        newDirection.y += 1;
      } else if (down && !up) {
        newDirection.y -= 1;
      }
    }

    // Normalize diagonal movement to maintain consistent speed
    if (newDirection.x !== 0 && newDirection.y !== 0) {
      const length = Math.sqrt(
        newDirection.x * newDirection.x + newDirection.y * newDirection.y
      );
      newDirection.x /= length;
      newDirection.y /= length;
    }

    // Apply boundary constraints with rotated bounding box
    if (change.x !== 0 || change.y !== 0) {
      setPosition((current) => {
        // Get animal dimensions
        const dimensions = animalDimensions[myUser.animal];
        if (!dimensions) {
          // Fallback to simple position blocking if dimensions not available
          const newPosition = current.clone().add(change);
          newPosition.x = Math.max(
            terrain.boundaries.minX,
            Math.min(terrain.boundaries.maxX, newPosition.x)
          );
          newPosition.y = Math.max(
            terrain.boundaries.minY,
            Math.min(terrain.boundaries.maxY, newPosition.y)
          );
          return newPosition;
        }

        // Calculate current rotation based on direction
        const currentRotation = Math.atan2(newDirection.y, newDirection.x);

        // Use rotated bounding box collision detection
        return checkBoundaryCollision(
          current,
          change,
          currentRotation,
          dimensions
        );
      });
      setDirection(newDirection);
    }
  };

  const updatePositionRef = useRef(updatePosition);
  const handleKeyDownRef = useRef(handleKeyDown);
  const handleKeyUpRef = useRef(handleKeyUp);

  useEffect(() => {
    updatePositionRef.current = updatePosition;
    handleKeyDownRef.current = handleKeyDown;
    handleKeyUpRef.current = handleKeyUp;
  });

  useMount(() => {
    const updatePositionWrapper = () => {
      updatePositionRef.current();
    };

    const handleKeyDownWrapper = (event: KeyboardEvent) => {
      handleKeyDownRef.current?.(event);
    };

    const handleKeyUpWrapper = (event: KeyboardEvent) => {
      handleKeyUpRef.current?.(event);
    };

    const animate = () => {
      updatePositionWrapper();
      // Store the ID so we can cancel it properly
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop once
    animationFrameRef.current = requestAnimationFrame(animate);
    window.addEventListener("keydown", handleKeyDownWrapper);
    window.addEventListener("keyup", handleKeyUpWrapper);

    return () => {
      window.removeEventListener("keydown", handleKeyDownWrapper);
      window.removeEventListener("keyup", handleKeyUpWrapper);
    };
  });

  return { position, direction };
}

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
  npcs: Map<string, NPC>;
  paths: Map<string, pathData>;
  npcGroups: DefaultMap<string, NPCGroup>;
  setPaths: (
    value:
      | Map<npcId, pathData>
      | ((prev: Map<npcId, pathData>) => Map<npcId, pathData>)
  ) => void;
  setNpcGroups: (
    value:
      | DefaultMap<userId, NPCGroup>
      | ((prev: DefaultMap<userId, NPCGroup>) => DefaultMap<userId, NPCGroup>)
  ) => void;
  setNpcs: (
    npcs: Map<npcId, NPC> | ((prev: Map<npcId, NPC>) => Map<npcId, NPC>)
  ) => void;
  terrain: TerrainConfig;
}

export default function Scene({
  users,
  myUser,
  npcs,
  paths,
  npcGroups,
  setPaths,
  setNpcGroups,
  setNpcs,
  terrain,
}: Props) {
  const initialPosition = new THREE.Vector3(
    myUser.position.x,
    myUser.position.y,
    0 // Explicitly set z to 0
  );

  const initialDirection = {
    x: myUser.direction.x,
    y: myUser.direction.y,
  };

  const [animalWidths, setAnimalWidths] = useState<{
    [animal: string]: number;
  }>({});

  const [animalDimensions, setAnimalDimensions] = useState<{
    [animal: string]: { width: number; height: number };
  }>({});

  // Helper function to check simple center-based collision with terrain boundaries
  const checkBoundaryCollision = (
    position: THREE.Vector3,
    change: THREE.Vector3,
    rotation: number,
    dimensions: { width: number; height: number }
  ): THREE.Vector3 => {
    const newPosition = position.clone().add(change);

    // Use a simple buffer distance from the center

    // Check boundaries and clamp position
    let adjustedX = newPosition.x;
    let adjustedY = newPosition.y;

    // Check X boundaries
    if (newPosition.x < terrain.boundaries.minX) {
      adjustedX = terrain.boundaries.minX;
    } else if (newPosition.x > terrain.boundaries.maxX) {
      adjustedX = terrain.boundaries.maxX;
    }

    // Check Y boundaries
    if (newPosition.y < terrain.boundaries.minY) {
      adjustedY = terrain.boundaries.minY;
    } else if (newPosition.y > terrain.boundaries.maxY) {
      adjustedY = terrain.boundaries.maxY;
    }

    return new THREE.Vector3(adjustedX, adjustedY, newPosition.z);
  };

  const { position, direction } = useKeyboardMovement(
    initialPosition,
    initialDirection,
    myUser,
    npcGroups,
    npcs,
    paths,
    setPaths,
    setNpcGroups,
    setNpcs,
    terrain,
    animalDimensions,
    checkBoundaryCollision
  );

  // --- REFACTOR: Use refs for last broadcasted position/direction ---
  const lastBroadcastPosition = useRef(position.clone());
  const lastBroadcastDirection = useRef({ ...direction });

  // Only broadcast if position or direction actually changed
  const broadcastPosition = useCallback(() => {
    const positionDelta = new THREE.Vector3()
      .copy(position)
      .sub(lastBroadcastPosition.current);
    const positionChanged = positionDelta.length() >= POSITION_THRESHOLD;

    const directionChanged =
      lastBroadcastDirection.current.x !== direction.x ||
      lastBroadcastDirection.current.y !== direction.y;

    if (positionChanged || directionChanged) {
      // Emit socket event
      const currentSocket = socket();
      currentSocket.emit(
        "user-updated",
        serialize({
          user: {
            ...myUser,
            position: position.clone(),
            direction: { ...direction },
          },
        }),
        (response: { success: boolean }) => {
          if (!response.success) console.error("Broadcast failed");
        }
      );
      lastBroadcastPosition.current.copy(position);
      lastBroadcastDirection.current = { ...direction };
    }
  }, [position, direction, myUser]);

  // Throttle the broadcast function ONCE, not per render
  const throttledBroadcast = useMemo(() => {
    return throttle(broadcastPosition, THROTTLE_MS, {
      leading: true,
      trailing: true,
    });
  }, [broadcastPosition]);

  // Effect to broadcast position/direction changes
  useEffect(() => {
    myUser.position = position.clone();
    myUser.direction = { ...direction };
    users.set(myUser.id, myUser);
    throttledBroadcast();
  }, [position, direction]);

  const handleNPCCollision = useCallback(
    (npc: NPC, localUser: boolean) => {
      // Only handle collision if NPC is still in IDLE phase

      const currentSocket = socket();
      if (localUser) {
      currentSocket.emit(
        "capture-npc",
        serialize({
          npcId: npc.id,
          room: myUser.room,
          captorId: myUser.id,
        }),
        (response: { success: boolean }) => {
            if (!response.success) console.error("Capture failed");
          }
        );
      }

      // create new npc
      const updatedNpc: NPC = {
        ...npc,
        position: myUser.position,
        phase: NPCPhase.CAPTURED,
      };
      setPaths((prev: Map<npcId, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.delete(npc.id); // remove the path data for the captured NPC
        return newPaths as Map<npcId, pathData>;
      });

      setNpcGroups((prevNpcGroups: DefaultMap<userId, NPCGroup>) => {
        // Use the utility function to preserve group object identity
        // TODO: This function may no longer be needed with NPCGroup structure
        // return addNPCToGroup(prevNpcGroups, myUser.id, updatedNpc.id);
        return prevNpcGroups;
      });

      setNpcs((prev) => {
        const newNpcs = new Map(prev);
        newNpcs.set(npc.id, updatedNpc);
        return newNpcs;
      });
    },
    [npcGroups, myUser.id, myUser.room]
  );

  const normalizeDirection = useCallback((direction: Direction) => {
    const length = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y
    );
    return { x: direction.x / length, y: direction.y / length };
  }, []);

  // Function to make an NPC flee from the player
  const makeNPCFlee = useCallback(
    (npc: NPC, npcPosition: THREE.Vector3) => {
      // Create new objects instead of mutating
      const updatedNpc: NPC = {
        ...npc,
        phase: NPCPhase.path,
      };

      // Get current path data
      const currentPathData = paths.get(npc.id);

      // Calculate flee direction from all nearby users using weighted averaging
      let totalFleeForce = { x: 0, y: 0 };
      let totalWeight = 0;

      // Check all users for flee influence
      Array.from(users.values()).forEach((user) => {
        const distance = Math.sqrt(
          (npcPosition.x - user.position.x) ** 2 +
            (npcPosition.y - user.position.y) ** 2
        );

        // Only consider users within flee range
        // Calculate flee direction away from this user
        const fleeDirection = {
          x: npcPosition.x - user.position.x,
          y: npcPosition.y - user.position.y,
        };

        // Normalize the flee direction
        const length = Math.sqrt(fleeDirection.x ** 2 + fleeDirection.y ** 2);
        if (length > 0) {
          fleeDirection.x /= length;
          fleeDirection.y /= length;

          // Weight inversely by distance (closer users have more influence)
          const weight = 1.0 / (distance * distance);

          totalFleeForce.x += fleeDirection.x * weight;
          totalFleeForce.y += fleeDirection.y * weight;
          totalWeight += weight;
        }
      });

      // If no flee forces, don't create a flee path
      if (totalWeight === 0) {
        return;
      }

      // Average the flee forces
      const averageFleeDirection = {
        x: totalFleeForce.x / totalWeight,
        y: totalFleeForce.y / totalWeight,
      };

      // Normalize the final direction
      const finalLength = Math.sqrt(
        averageFleeDirection.x ** 2 + averageFleeDirection.y ** 2
      );

      let finalFleeDirection: { x: number; y: number };
      if (finalLength > 0) {
        finalFleeDirection = {
          x: averageFleeDirection.x / finalLength,
          y: averageFleeDirection.y / finalLength,
        };
      } else {
        // Fallback to flee from primary user
        finalFleeDirection = normalizeDirection({
          x: npcPosition.x - myUser.position.x,
          y: npcPosition.y - myUser.position.y,
        });
      }

      // Add stability: if already fleeing, blend with current direction
      if (currentPathData && currentPathData.pathPhase === PathPhase.FLEEING) {
        const timeSinceLastUpdate = Date.now() - currentPathData.timestamp;
        const MIN_UPDATE_INTERVAL = 300; // Update more frequently but still stable

        // Only update if enough time has passed
        if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
          return;
        }

        // Blend current direction with new flee direction for stability
        const currentDir = currentPathData.direction;
        finalFleeDirection = normalizeDirection({
          x: currentDir.x * 0.4 + finalFleeDirection.x * 0.6,
          y: currentDir.y * 0.4 + finalFleeDirection.y * 0.6,
        });
      }

      const newPathData: pathData = currentPathData
        ? {
            ...currentPathData,
            startPosition: {
              x: npcPosition.x,
              y: npcPosition.y,
            },
            direction: finalFleeDirection,
            timestamp: Date.now(),
            pathPhase: PathPhase.FLEEING,
            velocity: 3.0, // Consistent flee speed
          }
        : {
            // create new path data
            id: uuidv4(),
            room: myUser.room,
            npc: updatedNpc,
            startPosition: {
              x: npcPosition.x,
              y: npcPosition.y,
            },
            pathDuration: 1500,
            timestamp: Date.now(),
            direction: finalFleeDirection,
            velocity: 3.0, // Consistent flee speed
            pathPhase: PathPhase.FLEEING,
          };

      // Socket call to create the flee path
      const currentSocket = socket();
      if (currentSocket) {
        currentSocket.emit(
          "path-npc",
          serialize({ pathData: newPathData }),
          (response: { success: boolean }) => {
            if (!response.success) console.error("NPC flee path failed");
          }
        );
      }

      setPaths((prev: Map<npcId, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.set(npc.id, newPathData);
        return newPaths as Map<npcId, pathData>;
      });

      setNpcs((prev: Map<npcId, NPC>) => {
        const newNpcs = new Map(prev);
        newNpcs.set(npc.id, updatedNpc);
        return newNpcs;
      });
    },
    [myUser, npcs, paths, setPaths, setNpcs, normalizeDirection, users]
  );

  // Function to check for collisions with NPCs
  const checkForNPCCollision = useCallback(
    (npc: NPC, npcPosition?: THREE.Vector3, isLocalUser: boolean = true) => {
      // Get the animal dimensions for dynamic thresholds
      const dimensions = animalDimensions[myUser.animal];
      const animalWidth = dimensions?.width || 2.0; // Fallback to 2.0 if dimensions not yet measured

      // Use animal width as base for thresholds
      const CAPTURE_THRESHOLD = animalWidth * 0.5; // Slightly larger than animal width for capture
      const FLEE_THRESHOLD = animalWidth * 5.0; // Much larger range for flee behavior

      const userPos = new THREE.Vector3(
        myUser.position.x,
        myUser.position.y,
        myUser.position.z
      );

      const npcPos = npcPosition
        ? npcPosition
        : new THREE.Vector3(npc.position.x, npc.position.y, npc.position.z);

      const distance = npcPos.distanceTo(userPos);

      // Only trigger actions for IDLE NPCs
      if (npc.phase === NPCPhase.IDLE || npc.phase === NPCPhase.path) {
        if (distance < CAPTURE_THRESHOLD) {
          // Close enough to capture
          console.log("Capturing NPC");
          handleNPCCollision(npc, isLocalUser);
          return true;
        } else if (distance < FLEE_THRESHOLD) {
          // Far enough to not capture, but close enough to flee
          makeNPCFlee(npc, npcPos);
        }
      }
      return false
    },
    [handleNPCCollision, makeNPCFlee, animalDimensions, myUser.animal]
  );

  const setAnimalDimensionsCallback = useCallback(
    (animal: string, dimensions: { width: number; height: number }) => {
      if (!animalDimensions[animal]) {
        // Create a new object to ensure React detects the change
        setAnimalDimensions((prev) => ({
          ...prev,
          [animal]: dimensions,
        }));
      }
    },
    [animalDimensions]
  );

  return (
    <Canvas
      style={{
        border: "1px solid white",
        width: "100%",
        height: "100%",
      }}
    >
      <CameraController
        targetPosition={position}
        animalScale={ANIMAL_SCALES[myUser.animal]}
      />
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      {terrain.renderBackground()}
      {/* Render all users with their NPCs */}
      {Array.from(users.values()).map((user) => (
        <AnimalGraphic
          key={user.id}
          user={user}
          myUserId={myUser.id}
          setAnimalDimensions={setAnimalDimensionsCallback}
        />
      ))}

      {Array.from(npcs.values())
        .filter((npc: NPC) => npc.phase !== NPCPhase.CAPTURED)
        .map((npc) => (
          <NPCGraphicWrapper
            key={npc.id}
            npc={npc}
            checkForCollision={checkForNPCCollision}
            pathData={paths.get(npc.id)}
            users={users}
            allNPCs={npcs}
            allPaths={paths}
            npcGroups={npcGroups}
            myUserId={myUser.id}
            setPaths={setPaths}
            setNpcs={setNpcs}
          />
        ))}
      {Array.from(npcGroups.values()).map((group) => {
        const user = users.get(group.captorId);
        if (!user) return null;

        return (
          <NPCGroupGraphic
            key={`${group.captorId}-group`}
            group={group}
            user={user}
            npcs={npcs}
            allPaths={paths}
            allNPCs={npcs}
            npcGroups={npcGroups}
            users={users}
            setPaths={setPaths}
            setNpcs={setNpcs}
            setNpcGroups={setNpcGroups}
            animalWidth={
              animalDimensions[user.animal]?.width || animalWidths[user.animal]
            }
            isLocalUser={user.id === myUser.id}
          />
        );
      })}
    </Canvas>
  );
}
