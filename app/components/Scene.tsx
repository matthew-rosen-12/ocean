// ocean/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { Member, UserInfo } from "../utils/types/user";
import AnimalGraphic from "./AnimalGraphic";
import { TitleBox, StatsBox } from "./Boxes";
import { useEffect, useState, useRef } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { getChannel } from "../utils/pusher-instance";

// Speed of movement per keypress/frame
const MOVE_SPEED = 1;

function CameraController({ targetPosition }: { targetPosition: Vector3 }) {
  const { camera } = useThree();
  const currentPosition = useRef(
    new Vector3(targetPosition.x, targetPosition.y, 10)
  );

  useFrame(() => {
    currentPosition.current.lerp(
      new Vector3(targetPosition.x, targetPosition.y, 10),
      0.01
    );
    camera.position.copy(currentPosition.current);
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
        change.x -= MOVE_SPEED; // Inverted x-axis movement
      }
      if (keysPressed.has("ArrowRight") || keysPressed.has("d")) {
        change.x += MOVE_SPEED; // Inverted x-axis movement
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

  return position;
}

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
}

export default function Scene({ users, myUser }: Props) {
  // Initialize position from myUser
  const initialPosition = new Vector3(
    myUser.position.x,
    myUser.position.y,
    myUser.position.z
  );

  const position = useKeyboardMovement(initialPosition);

  // Update myUser position whenever it changes
  useEffect(() => {
    myUser.position.x = position.x;
    myUser.position.y = position.y;
    myUser.position.z = position.z;
    const channel = getChannel(myUser.channel_name);
    channel.trigger("client-user-modified", {
      id: myUser.id,
      info: myUser,
    } as Member);
  }, [position, myUser]);

  return (
    <Canvas
      style={{
        border: "1px solid white",
        width: "100%",
        height: "100%",
      }}
    >
      <CameraController targetPosition={position} />

      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

      <TitleBox user={myUser} />

      <StatsBox user={myUser} />

      {Array.from(users.values()).map((user) => (
        <AnimalGraphic key={user.id} user={user} myUser={myUser} />
      ))}
    </Canvas>
  );
}

/*
TODO:

land and sea

graphics improvements:
  only render non-black part of SVG

__EDUCATIONAL__
crab, dolphin, wolf, 

basic world interactions between them
lots of facts throughout the day
*/
