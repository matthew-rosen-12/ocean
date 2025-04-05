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

async function throwNPC(myUser: UserInfo, npc: NPC) {
  try {
    // First remove the NPC from the myUser's NPC group immediately
    if (myUser.npcGroup?.npcs) {
      myUser.npcGroup.npcs = myUser.npcGroup.npcs.filter(
        (n) => n.id !== npc.id
      );

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
  myUser: UserInfo
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
          throwNPC(myUser, npcToThrow);
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
  }, [direction, keysPressed, myUser]);

  return { position, direction };
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
    myUser
  );
  users.set(myUser.id, myUser);

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

      const channel = getChannel(myUser.channel_name);

      try {
        // Use the existing direction directly
        await channel.trigger("client-user-modified", {
          id: myUser.id,
          info: myUser,
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
      if (npc.phase == NPCPhase.FREE) {
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
          myUserId={myUser.id}
          users={users}
        />
      ))}
      {npcs.size > 0 &&
        Array.from(npcs.values()).map((npc) => (
          <NPCGraphic
            key={npc.id}
            npc={npc}
            users={users}
            myUserId={myUser.id}
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
  - add NPC images (fix texture loading)

clean up!
avoid slowdown when npcs are thrown - too much lerping? less frequent broadcast updates?

debug user not being added to first room without saturation (likely Pusher not configured to send member_deleted to local instance)
debug db rows not being deleted properly (likely same issue as previous)
center the animal sprite within the camera view
* refractor / cleanup
*/
