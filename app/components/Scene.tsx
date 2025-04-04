// ocean/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { Direction, NPCPhase, UserInfo } from "../utils/types";
import NPCGraphic from "./NPCGraphic";
import { useEffect, useState, useRef, useCallback } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { getChannel } from "../utils/pusher-instance";
import WaveGrid from "./WaveGrid";
import { ANIMAL_SCALES, DIRECTION_OFFSET } from "../api/utils/user-info";
import { NPC } from "../utils/types";
import AnimalGraphic from "./AnimalGraphic";

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
  users: Map<string, UserInfo>
) {
  try {
    // First remove the NPC from the myUser's NPC group immediately
    if (myUser.npcGroup?.npcs) {
      myUser.npcGroup.npcs = myUser.npcGroup.npcs.filter(
        (n) => n.id !== npc.id
      );

      // Update the user in the users Map to keep it in sync
      users.set(myUser.id, myUser);

      // Broadcast that the user has been modified
      const channel = getChannel(myUser.channel_name);
      await channel.trigger("client-user-modified", {
        id: myUser.id,
        info: myUser,
      });
    }

    // Then make the API call to throw the NPC
    await fetch(`/api/npc/${npc.id}/throw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        throwerId: myUser.id,
        direction: myUser.direction,
        npc: npc,
        velocity: 8,
        channelName: myUser.channel_name,
      }),
    });
  } catch (error) {
    console.error("Error throwing NPC:", error);
  }
}

function useKeyboardMovement(
  initialPosition: Vector3,
  initialDirection: Direction,
  myUser: UserInfo,
  users: Map<string, UserInfo>
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
        myUser.npcGroup?.npcs?.length > 0
      ) {
        // Find the first captured NPC
        const capturedNpcIndex = myUser.npcGroup.npcs.findIndex(
          (npc) => npc.phase === NPCPhase.CAPTURED
        );

        if (capturedNpcIndex >= 0) {
          // Get the NPC to throw
          const npcToThrow = myUser.npcGroup.npcs[capturedNpcIndex];
          throwNPC(myUser, npcToThrow, users);
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
      let newDirection = { ...direction };

      // True diagonal movement - both components active
      if (right && !left && up && !down) {
        // Up-right diagonal
        newDirection = { x: 1, y: 1 };
      } else if (left && !right && up && !down) {
        // Up-left diagonal
        newDirection = { x: -1, y: 1 };
      } else if (right && !left && down && !up) {
        // Down-right diagonal
        newDirection = { x: 1, y: -1 };
      } else if (left && !right && down && !up) {
        // Down-left diagonal
        newDirection = { x: -1, y: -1 };
      } else if (right && !left) {
        // Moving right only
        newDirection = { x: 1, y: 0 };
      } else if (left && !right) {
        // Moving left only
        newDirection = { x: -1, y: 0 };
      } else if (up && !down) {
        // Moving up only
        if (Math.abs(direction.x) === 1 && direction.y === 0) {
          // Was previously moving horizontally - keep the DIRECTION_OFFSET
          newDirection = {
            x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
            y: 1,
          };
        } else {
          newDirection = { x: 0, y: 1 };
        }
      } else if (down && !up) {
        // Moving down only
        if (Math.abs(direction.x) === 1 && direction.y === 0) {
          // Was previously moving horizontally - keep the DIRECTION_OFFSET
          newDirection = {
            x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
            y: -1,
          };
        } else {
          newDirection = { x: 0, y: -1 };
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
  }, [direction, keysPressed, myUser, users]);

  return { position, direction, keysPressed };
}

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
  npcs: Map<string, NPC>;
}

export default function Scene({ users, myUser, npcs }: Props) {
  const initialPosition = new Vector3(
    myUser.position.x,
    myUser.position.y,
    myUser.position.z
  );

  const initialDirection = {
    x: myUser.direction.x,
    y: myUser.direction.y,
  };

  const { position, direction } = useKeyboardMovement(
    initialPosition,
    initialDirection,
    myUser,
    users
  );
  const lastBroadcastPosition = useRef(initialPosition);
  const lastBroadcastDirection = useRef(initialDirection);
  const POSITION_THRESHOLD = 0.01;

  // Throttled broadcast function with forceUpdate parameter
  const [isReady, setIsReady] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const THROTTLE_MS = 100;

  const throttledBroadcast = useCallback(async () => {
    if (!isReady || isPending) return;

    // Calculate if position changed enough to broadcast
    const positionDelta = new Vector3()
      .copy(position)
      .sub(lastBroadcastPosition.current);
    const positionChanged = positionDelta.length() >= POSITION_THRESHOLD;

    // Simply use the current direction - already calculated properly
    const directionChanged =
      lastBroadcastDirection.current.x !== direction.x ||
      lastBroadcastDirection.current.y !== direction.y;

    if (positionChanged || directionChanged) {
      // Lock the system during this broadcast attempt
      setIsReady(false);
      setIsPending(true);

      // Get the channel
      const channel = getChannel(myUser.channel_name);

      try {
        // Use the existing direction directly
        await channel.trigger("client-user-modified", {
          id: myUser.id,
          info: myUser,
        });

        // Update last broadcast values
        lastBroadcastPosition.current.copy(position);
        lastBroadcastDirection.current = { ...direction };
      } catch (error) {
        console.error("Broadcast failed:", error);
      }

      // Reset pending state
      setIsPending(false);

      // Start the cooldown timer to allow next broadcast
      setTimeout(() => setIsReady(true), THROTTLE_MS);
    }
  }, [position, direction, myUser, isReady, isPending]);

  // Effect to update myUser position and direction continuously
  useEffect(() => {
    myUser.position.x = position.x;
    myUser.position.y = position.y;
    myUser.position.z = position.z;
    myUser.direction = direction;

    // Also update the user in the users Map to keep it in sync
    users.set(myUser.id, myUser);

    // Attempt to broadcast whenever position/direction changes
    throttledBroadcast();
  }, [position, direction, myUser, throttledBroadcast, users]);

  const handleNPCCollision = useCallback(
    (npc: NPC) => {
      if (npc.phase == NPCPhase.FREE && npcs.has(npc.id)) {
        // Remove NPC from general pool
        npcs.delete(npc.id);
        npc.phase = NPCPhase.CAPTURED;

        myUser.npcGroup.npcs.push({ ...npc });
        users.set(myUser.id, myUser);
        const channel = getChannel(myUser.channel_name);
        channel.trigger("client-npc-captured", {
          npcId: npc.id,
          captorId: myUser.id,
          npcData: npc,
        });
      }
    },
    [npcs, users, myUser]
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
          localUserId={myUser.id}
          users={users}
        />
      ))}
      {npcs.size > 0 &&
        Array.from(npcs.values()).map((npc) => (
          <NPCGraphic
            key={npc.id}
            npc={npc}
            users={users}
            localUserId={myUser.id}
            onCollision={(npc) => handleNPCCollision(npc)}
          />
        ))}
    </Canvas>
  );
}

/*
TODO:
add NPCs to capture
  - adjust bounding box for interaction (to head? entire body?)
  - split into grid for faster rendering
  - throwing
  - add NPC images

clean up!
debug user not being added to first room without saturation (likely Pusher not configured to send member_deleted to local instance)
debug db rows not being deleted properly (likely same issue as previous)
center the animal sprite within the camera view
* refractor / cleanup
*/
