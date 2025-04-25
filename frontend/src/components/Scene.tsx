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
import { useEffect, useState, useRef, useCallback } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { socket } from "../socket";
import { Socket } from "socket.io-client";
import WaveGrid from "./WaveGrid";
import { ANIMAL_SCALES, DIRECTION_OFFSET } from "../utils/user-info";
import { NPC } from "../utils/types";
import AnimalGraphic from "./AnimalGraphic";
import { DefaultMap } from "../utils/types";
import CapturedNPCGraphic from "./npc-graphics/CapturedNPCGraphic";
import IdleNPCGraphic from "./npc-graphics/IdleNPCGraphic";
import ThrownNPCGraphic from "./npc-graphics/ThrownNPCGraphic";

// Speed of movement per keypress/frame
const MOVE_SPEED = 0.5;

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
  npcGroups: DefaultMap<userId, NPCGroup>,
  socket: Socket | null
) {
  try {
    // First remove the NPC from the myUser's NPC group immediately
    console.log("throwing npc", npc);
    npc.position = myUser.position;
    if (npcGroups.get(myUser.id)) {
      npcGroups.get(myUser.id).npcIds.delete(npc.id);

      // Broadcast that the user has been modified
      if (socket) {
        socket.emit(
          "client-npc-group-modified",
          {
            id: myUser.id,
            info: npcGroups.get(myUser.id),
            room: myUser.room,
          },
          (response: { success: boolean }) => {
            if (!response.success)
              console.error("NPC group modification failed");
          }
        );
      }
    }

    // Then make the socket call to throw the NPC
    if (socket) {
      console.log("throwing npc on client", npc);
      socket.emit(
        "throw-npc",
        {
          npcId: npc.id,
          room: myUser.room,
          throwerId: myUser.id,
          direction: myUser.direction,
          npc: npc,
          velocity: 20,
        },
        (response: { success: boolean }) => {
          if (!response.success) console.error("NPC throw failed");
        }
      );
    }
  } catch (error) {
    console.error("Error throwing NPC:", error);
  }
}

function useKeyboardMovement(
  initialPosition: Vector3,
  initialDirection: Direction,
  myUser: UserInfo,
  npcGroups: DefaultMap<userId, NPCGroup>,
  npcs: Map<npcId, NPC>
) {
  const [position, setPosition] = useState(initialPosition);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [keysPressed, setKeysPressed] = useState(new Set<string>());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
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
            throwNPC(myUser, npc, npcGroups, socket());
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
      if (up) change.y += MOVE_SPEED;
      if (down) change.y -= MOVE_SPEED;
      if (left) change.x -= MOVE_SPEED;
      if (right) change.x += MOVE_SPEED;

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

    const animate = () => {
      if (keysPressed.size > 0) {
        updatePosition();
      }
      // Store the ID so we can cancel it properly
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop once
    animationFrameRef.current = requestAnimationFrame(animate);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Cancel the animation frame using the ref
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [direction, keysPressed, myUser, npcGroups, npcs]);

  return { position, direction };
}

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
  npcs: Map<string, NPC>;
  throws: Map<string, throwData>;
  npcGroups: DefaultMap<string, NPCGroup>;
}

export default function Scene({
  users,
  myUser,
  npcs,
  throws,
  npcGroups,
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
    npcs
  );

  const lastBroadcastPosition = useRef(initialPosition);
  const lastBroadcastDirection = useRef(initialDirection);
  const POSITION_THRESHOLD = 0.01;

  // Throttled broadcast function with forceUpdate parameter
  const isThrottledRef = useRef(false);
  const THROTTLE_MS = 100;

  const throttledBroadcast = useCallback(async () => {
    if (isThrottledRef.current) return;

    // Calculate if position changed enough to broadcast
    const positionDelta = new Vector3()
      .copy(position)
      .sub(lastBroadcastPosition.current);
    const positionChanged = positionDelta.length() >= POSITION_THRESHOLD;

    const directionChanged =
      lastBroadcastDirection.current.x !== direction.x ||
      lastBroadcastDirection.current.y !== direction.y;

    if (positionChanged || directionChanged) {
      isThrottledRef.current = true;

      try {
        // Use the existing direction directly
        const currentSocket = socket();
        await new Promise<void>((resolve, reject) => {
          currentSocket.emit(
            "user-updated",
            {
              updatedUser: myUser,
            },
            (response: { success: boolean }) => {
              if (!response.success) reject(new Error("Broadcast failed"));
              else resolve();
            }
          );
        });

        lastBroadcastPosition.current.copy(position);
        lastBroadcastDirection.current = { ...direction };
      } catch (error) {
        console.error("Broadcast failed:", error);
      }

      // Start the cooldown timer to allow next broadcast
      setTimeout(() => {
        isThrottledRef.current = false;
      }, THROTTLE_MS);
    }
  }, [position, direction, myUser]);

  // Effect to update myUser position and direction continuously
  useEffect(() => {
    myUser.position = position.clone();
    myUser.direction = { ...direction };
    users.set(myUser.id, myUser);

    // Attempt to broadcast whenever position/direction changes
    throttledBroadcast();
  }, [position, direction, myUser, throttledBroadcast, users]);

  const handleNPCCollision = useCallback(
    (npc: NPC) => {
      npc.phase = NPCPhase.CAPTURED;
      npcGroups.get(myUser.id).npcIds.add(npc.id);
      const currentSocket = socket();
      currentSocket.emit(
        "capture-npc",
        {
          npcId: npc.id,
          room: myUser.room,
          captorId: myUser.id,
        },
        (response: { success: boolean }) => {
          if (!response.success) console.error("Capture failed");
        }
      );
    },
    [npcGroups, myUser.id, myUser.room]
  );

  // Function to check for collisions with NPCs
  const checkForNPCCollision = (npc: NPC) => {
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
  };

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
        <AnimalGraphic key={user.id} user={user} myUserId={myUser.id} />
      ))}
      {Array.from(npcGroups.entries()).map(([userId, npcGroup]) =>
        Array.from(npcGroup.npcIds).map((npcId, index) => {
          const npc = npcs.get(npcId);
          if (!npc) {
            console.warn(`NPC with id ${npcId} not found in npcs map`);
            return null;
          }
          if (!users.get(userId)) {
            console.warn(`User with id ${userId} not found in users map`);
            return null;
          }
          return (
            <CapturedNPCGraphic
              key={npcId}
              npc={npc}
              isLocalUser={userId === myUser.id}
              followingUser={users.get(userId)!}
              offsetIndex={index}
            />
          );
        })
      )}
      {/* Idle NPCs with collision detection */}
      {Array.from(npcs.values())
        .filter((npc) => npc.phase === NPCPhase.IDLE)
        .map((npc) => (
          <IdleNPCGraphic
            key={npc.id}
            npc={npc}
            checkForCollision={checkForNPCCollision}
          />
        ))}
      {Array.from(npcs.values())
        .filter((npc) => npc.phase === NPCPhase.THROWN)
        .map((npc) => {
          const throwData = throws.get(npc.id);
          if (!throwData) {
            console.warn(
              `Throw data with id ${npc.id} not found in throws map`
            );
            return null;
          }
          return (
            <ThrownNPCGraphic key={npc.id} npc={npc} throwData={throwData} />
          );
        })}
    </Canvas>
  );
}
