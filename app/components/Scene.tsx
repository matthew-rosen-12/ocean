// ocean/app/components/Scene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";
import Animal from "./Animal";
import { useMemo, useEffect, useState } from "react";
import { Vector3 } from "three";

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
}

// Speed of movement per keypress/frame
const MOVE_SPEED = 1;

// Use tuple type for fixed-length arrays
const CanvasConfig = {
  camera: {
    position: [0, 0, 10] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  style: {
    border: "1px solid white",
    width: "100%",
    height: "100%",
  },
} as const; // Make the config readonly

export function useKeyboardMovement(user: UserInfo) {
  const [position, setPosition] = useState(
    new Vector3(user.position.x, user.position.y, user.position.z)
  );
  const [keysPressed, setKeysPressed] = useState(new Set());

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
        setPosition((current) => {
          const newPos = current.clone().add(change);
          // Update the user's position object
          user.position.x = newPos.x;
          user.position.y = newPos.y;
          user.position.z = newPos.z;
          return newPos;
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
  }, [keysPressed, user.position]);

  // Update users Map whenever position changes
  useEffect(() => {
    user.position.x = position.x;
    user.position.y = position.y;
    user.position.z = position.z;
  }, [position, user]);
}

export default function Scene({ users, myUser }: Props) {
  useKeyboardMovement(myUser);

  // Memoize the Canvas setup
  const canvasSetup = useMemo(
    () => ({
      ...CanvasConfig,
    }),
    []
  );

  // Memoize lights setup to prevent recreation
  const lights = useMemo(
    () => (
      <>
        <ambientLight intensity={Math.PI / 2} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={Math.PI}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      </>
    ),
    []
  );
  console.log(myUser.position);

  return (
    <Canvas {...canvasSetup}>
      {lights}
      {Array.from(users.values()).map((user) => (
        <Animal key={user.id} user={user} myUser={myUser} />
      ))}
    </Canvas>
  );
}

/* TODO: 
- set animal rendered position by user position
- send message to update position of one user to all users
- is database broken? (ngrok forwarding is not constant)
- zooming
- create content
  - education
  - travel around the world
  - LLM for interactions
  - start with few number of organisms
 

sometime:
- enter channel vieweable on someone else's profile to join channel
- time stamped tokens for routes from client to server
*/
