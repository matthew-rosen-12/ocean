// ocean/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";
import AnimalGraphic from "./AnimalGraphic";
import { useEffect, useState, useRef } from "react";
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

function useKeyboardMovement(initialPosition: Vector3) {
  const [position, setPosition] = useState(initialPosition);
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

      if (keysPressed.has("ArrowUp") || keysPressed.has("w")) {
        change.y += MOVE_SPEED;
      }
      if (keysPressed.has("ArrowDown") || keysPressed.has("s")) {
        change.y -= MOVE_SPEED;
      }
      if (keysPressed.has("ArrowLeft") || keysPressed.has("a")) {
        change.x -= MOVE_SPEED;
      }
      if (keysPressed.has("ArrowRight") || keysPressed.has("d")) {
        change.x += MOVE_SPEED;
      }

      if (change.x !== 0 || change.y !== 0) {
        setPosition((current) => current.clone().add(change));
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

  return { position, keysPressed };
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

  const { position, keysPressed } = useKeyboardMovement(initialPosition);
  const lastSentPosition = useRef(new Vector3());
  const lastDirection = useRef<string>("none");
  const DISTANCE_THRESHOLD = 0.1;
  const UPDATES_PER_SECOND = 10;
  const UPDATE_INTERVAL_MS = 1000 / UPDATES_PER_SECOND;

  // Effect to update myUser position continuously
  useEffect(() => {
    myUser.position.x = position.x;
    myUser.position.y = position.y;
    myUser.position.z = position.z;
  }, [position, myUser]);

  // Separate effect for rate-limited position broadcasting
  useEffect(() => {
    const intervalId = setInterval(() => {
      let currentDirection = "none";
      const keys = Array.from(keysPressed);
      if (keys.length > 0) {
        currentDirection = keys.sort().join("-");
      }

      const distance = lastSentPosition.current.distanceTo(position);
      if (
        distance > DISTANCE_THRESHOLD ||
        currentDirection !== lastDirection.current
      ) {
        const channel = getChannel(myUser.channel_name);
        channel.trigger("client-user-modified", {
          id: myUser.id,
          info: {
            ...myUser,
            position: {
              x: position.x,
              y: position.y,
              z: position.z,
            },
          },
        });
        lastSentPosition.current.copy(position);
        lastDirection.current = currentDirection;
      }
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [position, keysPressed, UPDATE_INTERVAL_MS, myUser]);

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
          keysPressed={user.id === myUser.id ? keysPressed : undefined}
        />
      ))}
    </Canvas>
  );
}

/*
TODO:
refractor
land and sea, make grid infinite (or not)

center the animal sprite within the camera view
debug user not being added to first room without saturation (likely Pusher not configured to send member_deleted to local instance)
debug db rows not being deleted properly (likely same issue as previous)

__EDUCATIONAL__
crab, dolphin, wolf, 

basic world interactions between them
lots of facts throughout the day
*/
