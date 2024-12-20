// ocean/app/components/Animal.tsx

import React, { useMemo, useEffect, useRef } from "react";
import { UserInfo } from "../utils/types/user";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { useFrame } from "@react-three/fiber";

type Animal = "dolphin" | "wolf";

const ANIMAL_SCALES: Record<Animal, number> = {
  dolphin: 1.5,
  wolf: 1.0,
};

function AnimalSprite({
  animal,
  scale = 1,
  positionRef,
}: {
  animal: Animal;
  scale?: number;
  positionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const group = useMemo(() => new THREE.Group(), []);
  const currentPosition = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    // Smoothly interpolate to target position
    currentPosition.lerp(positionRef.current, 0.01);
    group.position.copy(currentPosition);
  });

  useEffect(() => {
    const loader = new SVGLoader();

    loader.load(
      `/animals/${animal}.svg`,
      (data) => {
        const paths = data.paths;

        paths.forEach((path) => {
          const material = new THREE.MeshBasicMaterial({
            color: path.color || 0x000000,
            side: THREE.DoubleSide,
            depthWrite: false,
            transparent: true,
          });

          const shapes = SVGLoader.createShapes(path);
          shapes.forEach((shape) => {
            const geometry = new THREE.ShapeGeometry(shape);
            geometry.scale(1, -1, 1);
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
          });
        });

        // Scale and center
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y);
        const normalizeScale = 1 / maxDim;

        group.scale.multiplyScalar(normalizeScale * scale);

        // Center the geometry
        box.setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        group.children.forEach((child) => {
          child.position.sub(center);
        });

        // Set initial position
        currentPosition.copy(positionRef.current);
        group.position.copy(currentPosition);
      },
      undefined,
      (error) => {
        console.error("Error loading SVG:", error);
      }
    );

    return () => {
      group.clear();
    };
  }, [animal, scale, group, currentPosition, positionRef]);

  return <primitive object={group} />;
}

export default function Animal({
  user,
  myUser,
}: {
  user: UserInfo;
  myUser: UserInfo;
}) {
  const positionRef = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z)
  );

  // Update the ref when position changes without causing a re-render
  useEffect(() => {
    positionRef.current.set(user.position.x, user.position.y, user.position.z);
  }, [user.position.x, user.position.y, user.position.z]);

  const relativeScale = useMemo(() => {
    const userScale = ANIMAL_SCALES[user.animal as Animal] || 1.0;
    const myUserScale = ANIMAL_SCALES[myUser.animal as Animal] || 1.0;
    return userScale / myUserScale;
  }, [user.animal, myUser.animal]);

  // Memoize the sprite to prevent remounting
  const sprite = useMemo(
    () => (
      <AnimalSprite
        animal={user.animal as Animal}
        scale={relativeScale}
        positionRef={positionRef}
      />
    ),
    [user.animal, relativeScale]
  );

  return sprite;
}
