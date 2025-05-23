// nature_v_npc/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Direction,
  NPCGroup,
  npcId,
  NPCPhase,
  throwData,
  userId,
  UserInfo,
} from "../utils/types";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Vector3 } from "three";
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
  targetPosition: Vector3;
  animalScale: number;
}

function CameraController({
  targetPosition,
  animalScale,
}: CameraControllerProps) {
  const { camera } = useThree();
  const baseDistance = 10;
  const zdistance = baseDistance * animalScale;

  useFrame(() => {
    camera.position.set(targetPosition.x, targetPosition.y, zdistance);
  });

  return null;
}

async function throwNPC(
  myUser: UserInfo,
  npc: NPC,
  npcs: Map<npcId, NPC>,
  npcGroups: DefaultMap<userId, NPCGroup>,
  throws: Map<npcId, throwData>,
  socket: Socket | null,
  setThrows: (throws: Map<npcId, throwData>) => void,
  setNpcGroups: (npcGroups: DefaultMap<userId, NPCGroup>) => void,
  setNpcs: (npcs: Map<npcId, NPC>) => void
) {
  try {
    // Create new objects instead of mutating
    const updatedNpc: NPC = {
      ...npc,
      position: myUser.position,
      phase: NPCPhase.THROWN,
    };

    // Use the utility function to preserve group object identity
    const updatedNpcGroups = removeNPCFromGroup(npcGroups, myUser.id, npc.id);

    // Create new throw data
    const newThrowData: throwData = {
      id: uuidv4(),
      room: myUser.room,
      npc: updatedNpc,
      startPosition: {
        x: myUser.position.x,
        y: myUser.position.y,
      },
      throwDuration: 2000,
      timestamp: Date.now(),
      throwerId: myUser.id,
      direction: {
        x: Math.round(myUser.direction.x),
        y: Math.round(myUser.direction.y),
      },
      velocity: 20,
    };

    // Create new throws map
    const updatedThrows = new Map(throws);
    updatedThrows.set(npc.id, newThrowData);

    // Socket call to throw the NPC
    if (socket) {
      socket.emit(
        "throw-npc",
        serialize({ throwData: newThrowData }),
        (response: { success: boolean }) => {
          if (!response.success) console.error("NPC throw failed");
        }
      );
    }

    setThrows(updatedThrows);
    setNpcGroups(updatedNpcGroups);
    const updatedNpcs = new Map(npcs);
    updatedNpcs.set(npc.id, updatedNpc);
    setNpcs(updatedNpcs);
  } catch (error) {
    console.error("Error throwing NPC:", error);
  }
}

function useKeyboardMovement(
  initialPosition: Vector3,
  initialDirection: Direction,
  myUser: UserInfo,
  npcGroups: DefaultMap<userId, NPCGroup>,
  npcs: Map<npcId, NPC>,
  throws: Map<npcId, throwData>,
  setThrows: (throws: Map<npcId, throwData>) => void,
  setNpcGroups: (npcGroups: DefaultMap<userId, NPCGroup>) => void,
  setNpcs: (npcs: Map<npcId, NPC>) => void
) {
  const [position, setPosition] = useState(initialPosition);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [keysPressed, setKeysPressed] = useState(new Set<string>());
  const animationFrameRef = useRef<number>();

  const handleKeyDown = (event: KeyboardEvent) => {
    setKeysPressed((prev) => new Set(prev).add(event.key));

    // Handle space bar press for throwing NPCs
    if (
      (event.key === " " || event.key === "Spacebar") &&
      npcGroups.get(myUser.id).npcIds.size > 0
    ) {
      // Get the first NPC ID from the set
      const npcIdToThrow = npcGroups
        .get(myUser.id)
        .npcIds.values()
        .next().value;

      if (npcIdToThrow) {
        const npc = npcs.get(npcIdToThrow);
        if (npc) {
          throwNPC(
            myUser,
            npc,
            npcs,
            npcGroups,
            throws,
            socket(),
            setThrows,
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
    const change = new Vector3(0, 0, 0);

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
  throws: Map<string, throwData>;
  npcGroups: DefaultMap<string, NPCGroup>;
  setThrows: (throws: Map<npcId, throwData>) => void;
  setNpcGroups: (
    value:
      | DefaultMap<userId, NPCGroup>
      | ((prev: DefaultMap<userId, NPCGroup>) => DefaultMap<userId, NPCGroup>)
  ) => void;
  setNpcs: (
    npcs: Map<npcId, NPC> | ((prev: Map<npcId, NPC>) => Map<npcId, NPC>)
  ) => void;
}

// Track texture loading without monkey-patching
const originalTextureLoader = THREE.TextureLoader.prototype.load;

// Patch TextureLoader only (this should work)
THREE.TextureLoader.prototype.load = function (
  url,
  onLoad,
  onProgress,
  onError
) {
  console.log(`[TEXTURE LOADER] Loading texture from: ${url}`);
  return originalTextureLoader.call(
    this,
    url,
    (texture) => {
      console.log(`[TEXTURE LOADED] Successfully loaded: ${url}`, {
        uuid: texture.uuid,
        dimensions: `${texture.image?.width}x${texture.image?.height}`,
      });
      if (onLoad) onLoad(texture);
    },
    onProgress,
    onError
  );
};

export default function Scene({
  users,
  myUser,
  npcs,
  throws,
  npcGroups,
  setThrows,
  setNpcGroups,
  setNpcs,
}: Props) {
  const initialPosition = new Vector3(
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
    throws,
    setThrows,
    setNpcGroups,
    setNpcs
  );

  // --- REFACTOR: Use refs for last broadcasted position/direction ---
  const lastBroadcastPosition = useRef(position.clone());
  const lastBroadcastDirection = useRef({ ...direction });

  // Only broadcast if position or direction actually changed
  const broadcastPosition = useCallback(() => {
    const positionDelta = new Vector3()
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

  // Function to check for collisions with NPCs
  const checkForNPCCollision = useCallback(
    (npc: NPC) => {
      const COLLISION_THRESHOLD = 2.5;

      const userPos = new Vector3(
        myUser.position.x,
        myUser.position.y,
        myUser.position.z
      );

      const npcPosition = new Vector3(
        npc.position.x,
        npc.position.y,
        npc.position.z
      );

      const distance = npcPosition.distanceTo(userPos);

      if (distance < COLLISION_THRESHOLD) {
        handleNPCCollision(npc);
      }
    },
    [handleNPCCollision]
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

  // Memory monitoring component
  function MemoryMonitor() {
    const { gl } = useThree();

    useEffect(() => {
      const monitorMemory = () => {
        console.log(`[Memory] Three.js Info:`, {
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length || "unknown",
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          points: gl.info.render.points,
          lines: gl.info.render.lines,
        });

        // Log Chrome's memory usage if available
        if (performance.memory) {
          console.log(
            `[Memory] JS Heap: ${Math.round(
              performance.memory.usedJSHeapSize / 1024 / 1024
            )}MB`
          );
        }
      };

      // Monitor memory every 2 seconds (reduced from 5)
      const interval = setInterval(monitorMemory, 2000);

      return () => clearInterval(interval);
    }, [gl]);

    return null;
  }

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
            throwData={throws.get(npc.id)}
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
          />
        );
      })}
      <MemoryMonitor />
    </Canvas>
  );
}
