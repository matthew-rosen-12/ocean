"use client";
import { useRef, useState } from "react";
import * as THREE from "three";
import { MeshProps } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";
import Dolphin from "../graphics/dolphin";
import Dog from "../graphics/dog";
import interpolateAnimal from "../graphics/interpolate-animal";

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
      scale={active ? 0.3 : 0.4}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? "hotpink" : color} />
    </mesh>
  );
}

function GraphicFromAnimal(animal: string) {
  let animalGraphic;
  switch (animal) {
    case "dolphin":
      animalGraphic = Dolphin();
      break;
    case "dog":
      animalGraphic = Dog();
    // Add other cases as needed
    default:
      animalGraphic = Dog(); // or some default graphic
  }
  return animalGraphic;
}

export default function Animal({
  user,
  myUser,
}: {
  user: UserInfo;
  myUser: UserInfo;
}) {
  // TODO render myUser at constant scale, other users at relative scale
  // TODO user current position only used for interaction with other objects, should always be rendered at center
  // TODO maybe use camera and set camera to current position always
  const animalGraphic = GraphicFromAnimal(user.animal);
  const myUserAnimalGraphic = GraphicFromAnimal(myUser.animal);
  const relativeScale = animalGraphic.scale / myUserAnimalGraphic.scale;
  const scaledAndInterpolatedAnimalGraphic = interpolateAnimal(
    animalGraphic.coords,
    relativeScale
  );
  return (
    <group>
      {scaledAndInterpolatedAnimalGraphic.map(
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
