"use client";
import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, MeshProps } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";
import Dolphin from "../graphics/dolphin";
import Dog from "../graphics/dog";

interface AnimatedSquareProps extends MeshProps {
  color: string;
}

function AnimatedSquare({ color, ...props }: AnimatedSquareProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 0.75 : 0.5}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? "hotpink" : color} />
    </mesh>
  );
}

export default function Animal({ user }: { user: UserInfo }) {
  const animalCoords = user.animal.length % 2 == 1 ? Dolphin() : Dog();
  return (
    <group>
      {animalCoords.map(
        (coord: { x: number; y: number; color: string }, index: number) => (
          <AnimatedSquare
            key={index}
            position={[user.position.x + coord.x, user.position.y + coord.y, 0]}
            color={coord.color}
          />
        )
      )}
    </group>
  );
}
