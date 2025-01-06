import { Text, Billboard } from "@react-three/drei";
import { UserInfo } from "../utils/types/user";
import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function TitleBox({ user }: { user: UserInfo }) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosition = useRef(
    new THREE.Vector3(user.position.x, user.position.y + 2, user.position.z)
  );

  useFrame(() => {
    if (groupRef.current) {
      currentPosition.current.lerp(
        new THREE.Vector3(
          user.position.x,
          user.position.y + 2,
          user.position.z
        ),
        0.01
      );
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
  const currentPosition = useRef(
    new THREE.Vector3(user.position.x, user.position.y + 3, user.position.z)
  );

  useFrame(() => {
    if (groupRef.current) {
      currentPosition.current.lerp(
        new THREE.Vector3(
          user.position.x,
          user.position.y + 3,
          user.position.z
        ),
        0.01
      );
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
          Dolphin has 4 flippers
        </Text>
      </Billboard>
    </group>
  );
}
