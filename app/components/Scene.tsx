"use client";
import { useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, ThreeElements } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";

interface Props {
  users: Map<string, UserInfo>;
}

function Box(props: ThreeElements["mesh"]) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);
  useFrame((state, delta) => (meshRef.current.rotation.x += delta));
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? "hotpink" : "#2f74c0"} />
    </mesh>
  );
}

export default function Scene({ users }: Props) {
  return (
    <Canvas>
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      {Array.from(users.values()).map((user) => (
        <Box key={user.id} position={[...user.position, 0]} />
      ))}
    </Canvas>
  );
}

/* TODO: 
- send message to update position of one user to all users
- create content
  - LLM for interactions
  - it's education!
  - start with few number of organisms

sometime:
- enter channel vieweable on someone else's profile to join channel
- time stamped tokens for routes
*/
