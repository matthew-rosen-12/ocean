// ocean/app/components/Animal.tsx

import React, { useMemo, useEffect, useRef } from "react";
import { UserInfo } from "../utils/types/user";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { useFrame } from "@react-three/fiber";
import { Animal } from "../utils/types/user";
import { ANIMAL_SCALES } from "../api/utils/user-info";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// Define base rotations for each animal type
const ANIMAL_BASE_ROTATIONS = {
  wolf: Math.PI, // 0 degrees - facing left by default
  dolphin: 0, // 0 degrees - facing right by default
  // Add other animals as needed
};

function AnimalSprite({
  animal,
  scale = 1,
  positionRef,
  isLocalPlayer,
  keysPressed,
}: {
  animal: Animal;
  scale?: number;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  isLocalPlayer: boolean;
  keysPressed?: Set<string>;
}) {
  const group = useMemo(() => new THREE.Group(), []);
  const currentPosition = useMemo(() => new THREE.Vector3(), []);
  const lastDirection = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0));
  const currentRotation = useRef(0);
  const targetRotation = useRef(0);
  const MOVE_SPEED = 0.5;
  const ROTATION_SPEED = 0.15;
  const baseRotation = ANIMAL_BASE_ROTATIONS[animal] || 0;
  const targetFlipY = useRef(1);
  const initialScale = useRef<THREE.Vector3 | null>(null);
  const svgLoaded = useRef(false);
  const flipProgress = useRef(0);
  const isFlipping = useRef(false);
  const FLIP_SPEED = 0.1;
  const currentFlipState = useRef(1); // Track current flip state (1 or -1)

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

        // NOW store the initial scale after everything is loaded and scaled
        initialScale.current = group.scale.clone();
        console.log(
          `Initial scale set after loading: ${initialScale.current.x}, ${initialScale.current.y}, ${initialScale.current.z}`
        );
        svgLoaded.current = true;

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
  }, [animal, scale, group, currentPosition, positionRef, isLocalPlayer]);

  useFrame(() => {
    // Skip if SVG isn't loaded yet
    if (!svgLoaded.current || !initialScale.current) return;

    if (isLocalPlayer) {
      // Local player: direct positioning
      group.position.copy(positionRef.current);

      // Calculate movement direction from keys
      if (keysPressed && keysPressed.size > 0) {
        const direction = new THREE.Vector3(0, 0, 0);

        if (keysPressed.has("ArrowUp") || keysPressed.has("w")) {
          direction.y += 1;
        }
        if (keysPressed.has("ArrowDown") || keysPressed.has("s")) {
          direction.y -= 1;
        }
        if (keysPressed.has("ArrowLeft") || keysPressed.has("a")) {
          direction.x -= 1;
        }
        if (keysPressed.has("ArrowRight") || keysPressed.has("d")) {
          direction.x += 1;
        }

        // Only update direction if actually moving
        if (direction.length() > 0) {
          direction.normalize();
          lastDirection.current = direction;

          // Calculate angle between direction and base direction (1,0,0)
          let angle = Math.atan2(direction.y, direction.x);

          // Apply base rotation offset
          angle -= baseRotation;

          // Set target rotation
          targetRotation.current = angle;

          // Check if we need to flip
          const needsFlip =
            (direction.x < 0 && currentFlipState.current > 0) ||
            (direction.x > 0 && currentFlipState.current < 0);

          if (needsFlip) {
            isFlipping.current = true;
            // Set target flip direction
            targetFlipY.current = direction.x < 0 ? -1 : 1;
          }
        }
      }

      // Handle flipping animation
      if (isFlipping.current) {
        // Progress the flip
        if (targetFlipY.current < 0) {
          // Flipping to negative (left-facing)
          flipProgress.current = Math.min(1, flipProgress.current + FLIP_SPEED);

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
          // Flipping to positive (right-facing)
          flipProgress.current = Math.min(1, flipProgress.current + FLIP_SPEED);

          // Apply scale based on flip progress
          if (flipProgress.current < 0.5) {
            // First half of flip - scale down y
            const scaleY =
              initialScale.current.y * (1 - flipProgress.current * 2) * -1;
            group.scale.setY(scaleY);
          } else {
            // Second half of flip - scale up y with positive sign
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

      // Interpolate rotation
      if (currentRotation.current !== targetRotation.current) {
        // Find the shortest path to the target angle
        let delta = targetRotation.current - currentRotation.current;

        // Normalize delta to [-PI, PI]
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;

        // Apply rotation with easing
        if (Math.abs(delta) < ROTATION_SPEED) {
          currentRotation.current = targetRotation.current;
        } else {
          currentRotation.current += Math.sign(delta) * ROTATION_SPEED;
        }

        group.rotation.z = currentRotation.current;
      }
    } else {
      // Non-local players: move at constant speed toward target
      const direction = new THREE.Vector3()
        .subVectors(positionRef.current, currentPosition)
        .normalize();
      const distance = currentPosition.distanceTo(positionRef.current);

      if (distance > 0.01) {
        // Only move if we're not basically there
        const movement = Math.min(MOVE_SPEED, distance);
        currentPosition.addScaledVector(direction, movement);
        group.position.copy(currentPosition);

        // Update rotation for non-local players too
        if (direction.length() > 0.01) {
          lastDirection.current = direction;

          // Calculate angle between direction and base direction (1,0,0)
          let angle = Math.atan2(direction.y, direction.x);

          // Apply base rotation offset
          angle -= baseRotation;

          // Set target rotation
          targetRotation.current = angle;

          // Set target flip
          if (direction.x < 0) {
            targetFlipY.current = -1;
          } else if (direction.x > 0) {
            targetFlipY.current = 1;
          }
        }

        // Interpolate rotation (same as for local player)
        if (currentRotation.current !== targetRotation.current) {
          let delta = targetRotation.current - currentRotation.current;

          // Normalize delta to [-PI, PI]
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;

          if (Math.abs(delta) < ROTATION_SPEED) {
            currentRotation.current = targetRotation.current;
          } else {
            currentRotation.current += Math.sign(delta) * ROTATION_SPEED;
          }

          group.rotation.z = currentRotation.current;
        }

        // Handle flipping - direct approach
        if (Math.sign(group.scale.y) !== targetFlipY.current) {
          group.scale.y = targetFlipY.current * initialScale.current.y;
        }
      }
    }
  });

  return <primitive object={group} />;
}

export default function AnimalGraphic({
  user,
  isLocalPlayer = false,
  keysPressed,
}: {
  user: UserInfo;
  isLocalPlayer?: boolean;
  keysPressed?: Set<string>;
}) {
  const positionRef = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z)
  );

  // Update the ref for ALL players when position changes
  useEffect(() => {
    positionRef.current.set(user.position.x, user.position.y, user.position.z);
  }, [user.position.x, user.position.y, user.position.z]);

  const sprite = useMemo(
    () => (
      <AnimalSprite
        animal={user.animal as Animal}
        scale={ANIMAL_SCALES[user.animal as Animal]}
        positionRef={positionRef}
        isLocalPlayer={isLocalPlayer}
        keysPressed={isLocalPlayer ? keysPressed : undefined}
      />
    ),
    [user.animal, isLocalPlayer, keysPressed]
  );

  return sprite;
}
