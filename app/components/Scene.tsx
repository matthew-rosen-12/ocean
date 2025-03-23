// ocean/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { Direction, UserInfo } from "../utils/types/user";
import AnimalGraphic from "./AnimalGraphic";
import { useEffect, useState, useRef, useCallback } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { getChannel } from "../utils/pusher-instance";
import WaveGrid from "./WaveGrid";
import { ANIMAL_SCALES } from "../api/utils/user-info";

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

function useKeyboardMovement(
  initialPosition: Vector3,
  initialDirection: Direction
) {
  const [position, setPosition] = useState(initialPosition);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [keysPressed, setKeysPressed] = useState(new Set<string>());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setKeysPressed((prev) => new Set(prev).add(event.key));
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
      const newDirection = { x: 0, y: 0 };

      if (keysPressed.has("ArrowUp") || keysPressed.has("w")) {
        change.y += MOVE_SPEED;
        newDirection.y += 1;
      }
      if (keysPressed.has("ArrowDown") || keysPressed.has("s")) {
        change.y -= MOVE_SPEED;
        newDirection.y -= 1;
      }
      if (keysPressed.has("ArrowLeft") || keysPressed.has("a")) {
        change.x -= MOVE_SPEED;
        newDirection.x -= 1;
      }
      if (keysPressed.has("ArrowRight") || keysPressed.has("d")) {
        change.x += MOVE_SPEED;
        newDirection.x += 1;
      }

      if (change.x !== 0 || change.y !== 0) {
        setPosition((current) => current.clone().add(change));

        const length = Math.sqrt(
          newDirection.x * newDirection.x + newDirection.y * newDirection.y
        );
        setDirection({
          x: newDirection.x / length,
          y: newDirection.y / length,
        });
      }
    };

    let animationFrameId: number;
    const animate = () => {
      if (keysPressed.size > 0) {
        updatePosition();
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [keysPressed]);

  return { position, direction, keysPressed };
}

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
}

export default function Scene({ users, myUser }: Props) {
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
    initialDirection
  );
  const lastBroadcastPosition = useRef(initialPosition);
  const lastBroadcastDirection = useRef(initialDirection);
  const POSITION_THRESHOLD = 0.01;

  // Throttled broadcast function using useState and useCallback
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
          info: {
            ...myUser,
            position: {
              x: position.x,
              y: position.y,
              z: position.z,
            },
            direction: direction,
          },
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
    if (users.has(myUser.id)) {
      const userInMap = users.get(myUser.id);
      if (userInMap) {
        userInMap.position.x = myUser.position.x;
        userInMap.position.y = myUser.position.y;
        userInMap.position.z = myUser.position.z;

        userInMap.direction = { ...myUser.direction };
      }
    }

    // Attempt to broadcast whenever position/direction changes
    throttledBroadcast();
  }, [position, direction, myUser, throttledBroadcast, users]);

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
      {Array.from(users.values()).map((user) => (
        <AnimalGraphic
          key={user.id}
          user={user}
          isLocalPlayer={user.id === myUser.id}
        />
      ))}
    </Canvas>
  );
}

/*
TODO:
add NPCs to capture
refractor into more functions
debug user not being added to first room without saturation (likely Pusher not configured to send member_deleted to local instance)
debug db rows not being deleted properly (likely same issue as previous)
center the animal sprite within the camera view
*/
