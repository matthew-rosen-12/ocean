// ocean/app/components/Animal.tsx

import React, { useMemo, useEffect, useRef } from "react";
import { UserInfo } from "../utils/types";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { useFrame } from "@react-three/fiber";
import { Animal } from "../utils/types";
import { ANIMAL_SCALES } from "../api/utils/user-info";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { smoothMove } from "../utils/movement";

const ANIMAL_ORIENTATION = {
  wolf: { rotation: 0, flipY: true },
  dolphin: { rotation: 0, flipY: false },
};

export const MOVE_SPEED = 0.5;
const ROTATION_SPEED = 0.25;
const FLIP_SPEED = 0.5;

function AnimalSprite({
  animal,
  scale = 1,
  positionRef,
  directionRef,
  isLocalPlayer,
}: {
  animal: Animal;
  scale?: number;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  directionRef: React.MutableRefObject<THREE.Vector3 | null>;
  isLocalPlayer: boolean;
}) {
  const group = useMemo(() => new THREE.Group(), []);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  const previousRotation = useRef(0);
  const targetRotation = useRef(0);
  const targetFlipY = useRef(1);
  const initialScale = useRef<THREE.Vector3 | null>(null);
  const svgLoaded = useRef(false);
  const flipProgress = useRef(0);
  const isFlipping = useRef(false);
  const currentFlipState = useRef(1); // Track current flip state (1 or -1)
  const initialOrientation = useRef(
    ANIMAL_ORIENTATION[animal] || { rotation: 0, flipY: false }
  );

  useEffect(() => {
    const loader = new SVGLoader();

    loader.load(
      `/animals/${animal}.svg`,
      (data) => {
        // Group paths by color
        const geometriesByColor = new Map<number, THREE.BufferGeometry[]>();

        // Calculate the bounding box of all paths first
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        data.paths.forEach((path) => {
          path.subPaths.forEach((subPath) => {
            subPath.getPoints().forEach((point) => {
              minX = Math.min(minX, point.x);
              minY = Math.min(minY, point.y);
              maxX = Math.max(maxX, point.x);
              maxY = Math.max(maxY, point.y);
            });
          });
        });

        // Calculate center offset
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        data.paths.forEach((path) => {
          const color = path.color || 0x000000;
          const shapes = SVGLoader.createShapes(path);

          shapes.forEach((shape) => {
            const geometry = new THREE.ShapeGeometry(shape);

            // Center and flip the geometry
            geometry.translate(-centerX, -centerY, 0);
            geometry.scale(1, -1, 1);

            if (!geometriesByColor.has(color.getHex())) {
              geometriesByColor.set(color.getHex(), []);
            }
            geometriesByColor.get(color.getHex())!.push(geometry);
          });
        });

        // Merge geometries of the same color and create meshes
        geometriesByColor.forEach((geometries, color) => {
          const mergedGeometry =
            BufferGeometryUtils.mergeGeometries(geometries);
          const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            depthWrite: false,
            transparent: true,
          });

          const mesh = new THREE.Mesh(mergedGeometry, material);
          mesh.renderOrder = isLocalPlayer ? 1 : 0;
          group.add(mesh);

          // Clean up individual geometries
          geometries.forEach((g) => g.dispose());
        });

        // Scale the group
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y);
        const normalizeScale = 5 / maxDim;

        group.scale.multiplyScalar(normalizeScale * scale);

        // Apply initial orientation to make the animal face right
        const orientation = ANIMAL_ORIENTATION[animal] || {
          rotation: 0,
          flipY: false,
        };
        initialOrientation.current = orientation;

        // Apply initial rotation
        group.rotation.z = orientation.rotation;

        // Apply initial flip if needed
        if (orientation.flipY) {
          group.scale.x = -group.scale.x;
        }

        // Store the initial scale AFTER applying orientation flips
        initialScale.current = group.scale.clone();

        // Reset rotation references to 0 after applying initial orientation
        // This makes the resulting orientation the new "zero" rotation
        previousRotation.current = 0;
        targetRotation.current = 0;

        // Reset the facing direction reference based on the initial state
        svgLoaded.current = true;

        // Set initial position
        previousPosition.copy(positionRef.current);
        group.position.copy(previousPosition);

        // Apply initial rotation based on directionRef if available
        if (directionRef.current && directionRef.current.length() > 0.01) {
          // Calculate angle between direction and base direction (1,0,0)
          const direction = directionRef.current.clone().normalize();
          const angle = Math.atan2(direction.y, direction.x);

          // Set current and target rotation immediately to avoid initial jump
          previousRotation.current = angle;
          targetRotation.current = angle;
          group.rotation.z = angle;

          // Set initial flip state based on x direction
          if (direction.x < 0 && initialScale.current) {
            // If facing left and not already flipped
            if (currentFlipState.current > 0) {
              currentFlipState.current = -1;
              group.scale.set(
                initialScale.current.x,
                -initialScale.current.y,
                initialScale.current.z
              );
            }
          }
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
  }, [
    animal,
    scale,
    group,
    previousPosition,
    positionRef,
    isLocalPlayer,
    directionRef,
  ]);

  function setRotation(direction: THREE.Vector3) {
    if (direction.length() > 0) {
      direction.normalize();

      // Calculate angle between direction and base direction (1,0,0)
      const angle = Math.atan2(direction.y, direction.x);

      // Set target rotation
      targetRotation.current = angle;

      // Check if we need to flip
      const needsFlip =
        (direction.x < 0 && currentFlipState.current > 0) ||
        (direction.x > 0 && currentFlipState.current < 0);

      if (needsFlip) {
        isFlipping.current = true;
        targetFlipY.current = direction.x < 0 ? -1 : 1;
      }
    }
  }
  useFrame(() => {
    // Skip if SVG isn't loaded yet

    if (!svgLoaded.current || !initialScale.current) return;

    // Position handling - same for local and non-local
    group.position.copy(positionRef.current);

    if (directionRef.current && directionRef.current.length() > 0.01) {
      setRotation(directionRef.current);
    }

    // Handle position interpolation for non-local players
    if (!isLocalPlayer) {
      // Apply smooth movement
      previousPosition.copy(
        smoothMove(previousPosition.clone(), positionRef.current, {
          lerpFactor: 0.1,
          moveSpeed: MOVE_SPEED,
          minDistance: 0.01,
          useConstantSpeed: true,
        })
      );

      // Apply the calculated position
      group.position.copy(previousPosition);
    }

    // Rotation interpolation with faster non-local rotation
    if (Math.abs(targetRotation.current - previousRotation.current) > 0.001) {
      let delta = targetRotation.current - previousRotation.current;

      // Normalize delta to [-PI, PI]
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;

      if (
        Math.abs(targetRotation.current) == Math.PI / 2 &&
        Math.abs(delta) == Math.PI &&
        currentFlipState.current == -1
      ) {
        delta *= -1;
      }

      const rotSpeed = ROTATION_SPEED;

      if (Math.abs(delta) < rotSpeed) {
        previousRotation.current = targetRotation.current;
      } else {
        previousRotation.current += Math.sign(delta) * rotSpeed;
      }

      group.rotation.z = previousRotation.current;
    }

    // Handle flipping animation with faster non-local flipping
    if (isFlipping.current) {
      // Use faster flip speed for non-local players
      const flipSpeed = FLIP_SPEED;

      // Progress the flip
      if (targetFlipY.current < 0) {
        // Flipping to negative (left-facing)
        flipProgress.current = Math.min(1, flipProgress.current + flipSpeed);

        // Apply scale based on flip progress
        if (flipProgress.current < 0.5) {
          // First half of flip - scale down y
          const scaleY =
            initialScale.current.y * (1 - flipProgress.current * 2);
          group.scale.setY(Math.max(0.01, scaleY));
        } else {
          // Second half of flip - scale up y with negative sign
          const scaleY =
            initialScale.current.y * ((flipProgress.current - 0.5) * 2) * -1;
          group.scale.setY(scaleY);
        }

        // Complete the flip
        if (flipProgress.current >= 1) {
          isFlipping.current = false;
          flipProgress.current = 0;
          group.scale.set(
            initialScale.current.x,
            -initialScale.current.y,
            initialScale.current.z
          );

          // Update current flip state
          currentFlipState.current = -1;
        }
      } else {
        flipProgress.current = Math.min(1, flipProgress.current + flipSpeed);
        if (flipProgress.current < 0.5) {
          const scaleY =
            initialScale.current.y * (1 - flipProgress.current * 2) * -1;
          group.scale.setY(scaleY);
        } else {
          const scaleY =
            initialScale.current.y * ((flipProgress.current - 0.5) * 2);
          group.scale.setY(Math.max(0.01, scaleY));
        }

        // Complete the flip
        if (flipProgress.current >= 1) {
          isFlipping.current = false;
          flipProgress.current = 0;
          group.scale.set(
            initialScale.current.x,
            initialScale.current.y,
            initialScale.current.z
          );

          // Update current flip state
          currentFlipState.current = 1;
        }
      }
    }
  });

  return <primitive object={group} />;
}

export default function AnimalGraphic({
  user,
  myUserId,
}: {
  user: UserInfo;
  myUserId: string;
}) {
  // Create position ref as Vector3
  const isLocalPlayer = myUserId === user.id;
  const positionRef = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z)
  );

  // Create direction ref as Vector3
  const directionRef = useRef<THREE.Vector3 | null>(null);

  // Update refs when user data changes
  useEffect(() => {
    positionRef.current.set(user.position.x, user.position.y, user.position.z);

    // Update direction ref if direction exists, preserving z=0
    if (user.direction) {
      if (!directionRef.current) {
        directionRef.current = new THREE.Vector3();
      }
      directionRef.current.set(user.direction.x, user.direction.y, 0);
    }
  }, [user.position.x, user.position.y, user.position.z, user.direction]);

  return (
    <>
      <AnimalSprite
        animal={user.animal as Animal}
        scale={ANIMAL_SCALES[user.animal as Animal]}
        positionRef={positionRef}
        directionRef={directionRef}
        isLocalPlayer={isLocalPlayer}
      />
    </>
  );
}
