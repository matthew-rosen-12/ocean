// ocean/app/components/Animal.tsx

import React, { useMemo, useEffect } from "react";
import { UserInfo } from "../utils/types/user";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

type Animal = "dolphin" | "wolf";

const ANIMAL_SCALES: Record<Animal, number> = {
  dolphin: 15,
  wolf: 1.0,
};

function AnimalSprite({
  animal,
  scale = 1,
  position,
}: {
  animal: Animal;
  scale?: number;
  position: THREE.Vector3;
}) {
  const group = useMemo(() => new THREE.Group(), []);

  useEffect(() => {
    const loader = new SVGLoader();

    loader.load(
      `/animals/${animal}.svg`,
      (data) => {
        const paths = data.paths;

        paths.forEach((path) => {
          const material = new THREE.MeshBasicMaterial({
            color: path.color || 0x000000, // Use original SVG colors
            side: THREE.DoubleSide,
            depthWrite: false,
            transparent: true, // Enable transparency if SVG has it
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
        // Apply position if provided
        if (position) {
          group.position.copy(position);
        }
      },
      undefined,
      (error) => {
        console.error("Error loading SVG:", error);
      }
    );

    return () => {
      group.clear();
    };
  }, [animal, scale, position, group]);

  return <primitive object={group} />;
}

export default function Animal({
  user,
  myUser,
}: {
  user: UserInfo;
  myUser: UserInfo;
}) {
  const getRelativeScale = (userAnimal: Animal, myUserAnimal: Animal) => {
    const userScale = ANIMAL_SCALES[userAnimal] || 1.0;
    const myUserScale = ANIMAL_SCALES[myUserAnimal] || 1.0;
    return userScale / myUserScale;
  };

  const relativeScale = getRelativeScale(
    user.animal as Animal,
    myUser.animal as Animal
  );
  const relativePosition = new THREE.Vector3().subVectors(
    user.position,
    myUser.position
  );
  return (
    <group>
      <AnimalSprite
        animal={user.animal as Animal}
        scale={relativeScale}
        position={relativePosition}
      />
    </group>
  );
}
