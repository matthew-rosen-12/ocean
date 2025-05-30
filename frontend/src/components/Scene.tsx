// nature_v_npc/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Direction,
  NPCGroup,
  npcId,
  NPCPhase,
  pathData,
  userId,
  UserInfo,
} from "../utils/types";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { socket } from "../socket";
import { Socket } from "socket.io-client";
import WaveGrid from "./WaveGrid";
import { ANIMAL_SCALES, DIRECTION_OFFSET } from "../utils/user-info";
import { NPC } from "../utils/types";
import AnimalGraphic from "./AnimalGraphic";
import { DefaultMap } from "../utils/types";
import { throttle } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { serialize } from "../utils/serializers";
import NPCGraphicWrapper from "./npc-graphics/NPCGraphicWrapper";
import NPCGroupGraphic from "./npc-graphics/NPCGroupGraphic";
import { useMount } from "../hooks/useNPCBase";
import * as THREE from "three";
import { removeNPCFromGroup, addNPCToGroup } from "../utils/npc-group-utils";
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

    // Use the utility function to preserve group object identity
    const updatedNpcGroups = removeNPCFromGroup(npcGroups, myUser.id, npc.id);

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
  setNpcs: (npcs: Map<npcId, NPC>) => void
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

    if (change.x !== 0 || change.y !== 0) {
      setPosition((current) => current.clone().add(change));
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

  const { position, direction } = useKeyboardMovement(
    initialPosition,
    initialDirection,
    myUser,
    npcGroups,
    npcs,
    paths,
    setPaths,
    setNpcGroups,
    setNpcs
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
    (npc: NPC) => {
      // Only handle collision if NPC is still in IDLE phase

      const currentSocket = socket();
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
        return addNPCToGroup(prevNpcGroups, myUser.id, updatedNpc.id);
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
      // Calculate flee direction (away from player)
      const fleeDirection = normalizeDirection({
        x: npcPosition.x - myUser.position.x,
        y: npcPosition.y - myUser.position.y,
      });

      // Create new objects instead of mutating
      const updatedNpc: NPC = {
        ...npc,
        phase: NPCPhase.path,
      };

      // Normalize the direction

      // get current path data, update timestamp and add flee direction to current direction
      const currentPathData = paths.get(npc.id);
      const newPathData: pathData = currentPathData
        ? {
            ...currentPathData,
            direction: {
              x: currentPathData.direction.x + fleeDirection.x,
              y: currentPathData.direction.y + fleeDirection.y,
            },
            pathDuration: 1500 + Date.now() - currentPathData.timestamp,
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
            pathDuration: 1500, // Shorter flee duration
            timestamp: Date.now(),
            // No captorId - this is a flee path
            direction: fleeDirection,
            velocity: 0.25, // Moderate flee speed
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
    [myUser, npcs, paths, setPaths, setNpcs]
  );

  // Function to check for collisions with NPCs
  const checkForNPCCollision = useCallback(
    (npc: NPC, npcPosition?: THREE.Vector3) => {
      // Get the animal width for dynamic thresholds
      const animalWidth = animalWidths[myUser.animal] || 2.0; // Fallback to 2.0 if width not yet measured

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
          handleNPCCollision(npc);
        } else if (distance < FLEE_THRESHOLD) {
          // Far enough to not capture, but close enough to flee
          makeNPCFlee(npc, npcPos);
        }
      }
    },
    [handleNPCCollision, makeNPCFlee]
  );

  // Animal width map (per animal type)
  const [animalWidths, setAnimalWidths] = useState<{
    [animal: string]: number;
  }>({});

  const setAnimalWidth = useCallback(
    (animal: string, width: number) => {
      if (!animalWidths[animal]) {
        // Create a new object to ensure React detects the change
        setAnimalWidths((prev) => ({
          ...prev,
          [animal]: width,
        }));
      }
    },
    [animalWidths]
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
      <WaveGrid />
      {/* Render all users with their NPCs */}
      {Array.from(users.values()).map((user) => (
        <AnimalGraphic
          key={user.id}
          user={user}
          myUserId={myUser.id}
          setAnimalWidth={setAnimalWidth}
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
            animalWidth={animalWidths[user.animal]}
            isLocalUser={user.id === myUser.id}
          />
        );
      })}
    </Canvas>
  );
}
