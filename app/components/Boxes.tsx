import { Text, Billboard } from "@react-three/drei";
import { UserInfo } from "../utils/types/user";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ANIMAL_FACTS } from "@/public/facts";

export function TitleBox({ user }: { user: UserInfo }) {
  const groupRef = useRef<THREE.Group>(null);
  const offset = new THREE.Vector3(8, 7, 0);

  const currentPosition = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z).add(
      offset
    )
  );

  const targetPosition = new THREE.Vector3(
    user.position.x,
    user.position.y,
    user.position.z
  ).add(offset);

  useFrame(() => {
    if (groupRef.current) {
      currentPosition.current.lerp(targetPosition, 0.01);
      groupRef.current.position.copy(currentPosition.current);
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          color="white"
          fontSize={0.5}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="black"
        >
          {user.animal}
        </Text>
      </Billboard>
    </group>
  );
}

export function StatsBox({ user }: { user: UserInfo }) {
  const groupRef = useRef<THREE.Group>(null);
  const offset = new THREE.Vector3(6, 7, 0);

  const currentPosition = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z).add(
      offset
    )
  );

  const targetPosition = new THREE.Vector3(
    user.position.x,
    user.position.y,
    user.position.z
  ).add(offset);

  useFrame(() => {
    if (groupRef.current) {
      currentPosition.current.lerp(targetPosition, 0.01);
      groupRef.current.position.copy(currentPosition.current);
    }
  });

  return (
    <group ref={groupRef}>
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          color="white"
          fontSize={0.5}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.1}
          outlineColor="black"
        >
          {ANIMAL_FACTS[user.animal]}
        </Text>
      </Billboard>
    </group>
  );
}
