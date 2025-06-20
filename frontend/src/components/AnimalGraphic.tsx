import React, { useMemo, useEffect, useRef } from "react";
import { UserInfo, Animal, ANIMAL_SCALES } from "shared/types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { smoothMove } from "../utils/movement";
import { useMount } from "../hooks/use-npc-group-base";
import {
  loadAnimalSVG,
  animalGraphicsCache,
  ANIMAL_ORIENTATION,
  createEdgeGeometry,
} from "../utils/load-animal-svg";
import { getAnimalBorderColor } from "../utils/animal-colors";
import { TerrainBoundaries } from "../utils/terrain";

// Global cache for animal graphics

export const MOVE_SPEED = 0.5;
const ROTATION_SPEED = 0.25;
const FLIP_SPEED = 0.5;

// Initialize post-processing effects

function AnimalSprite({
  animal,
  scale = 1,
  positionRef,
  directionRef,
  isLocalPlayer,
  user,
  setAnimalDimensions,
  terrainBoundaries: _terrainBoundaries,
}: {
  animal: Animal;
  scale?: number;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  directionRef: React.MutableRefObject<THREE.Vector3 | null>;
  isLocalPlayer: boolean;
  user: UserInfo;
  setAnimalDimensions: (
    animal: string,
    dimensions: { width: number; height: number }
  ) => void;
  terrainBoundaries?: TerrainBoundaries;
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

  // Get outline effect functions

  useMount(() => {
    const cacheKey = animal;

    // Check if we have cached graphics for this animal
    if (animalGraphicsCache.has(cacheKey)) {
      const cached = animalGraphicsCache.get(cacheKey)!;

      // Create material with cached texture
      const material = new THREE.MeshBasicMaterial({
        map: cached.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      // Create mesh with cached geometry
      const mesh = new THREE.Mesh(cached.geometry.clone(), material);
      mesh.renderOrder = isLocalPlayer ? 1 : 0;
      group.add(mesh);

      // Create edge geometry with user-specific color
      const borderColor = getAnimalBorderColor(user);
      const edgeLines = createEdgeGeometry(
        borderColor,
        isLocalPlayer,
        cached.outlineLineGeometry,
        cached.geometry
      );
      group.add(edgeLines);

      // Apply initial scale and positioning
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y);
      const normalizeScale = 5 / maxDim;
      group.scale.multiplyScalar(normalizeScale * scale);

      // Measure and set width and height
      const scaledBox = new THREE.Box3().setFromObject(group);
      const scaledSize = scaledBox.getSize(new THREE.Vector3());
      setAnimalDimensions(animal, {
        width: scaledSize.x,
        height: scaledSize.y,
      });

      // Apply orientation
      const orientation = ANIMAL_ORIENTATION[animal] || {
        rotation: 0,
        flipY: false,
      };
      initialOrientation.current = orientation;
      group.rotation.z = orientation.rotation;
      if (orientation.flipY) {
        group.scale.x = -group.scale.x;
      }

      initialScale.current = group.scale.clone();
      previousRotation.current = 0;
      targetRotation.current = 0;
      svgLoaded.current = true;

      previousPosition.copy(positionRef.current);
      group.position.copy(previousPosition);

      // Apply initial rotation if available
      if (directionRef.current && directionRef.current.length() > 0.01) {
        const direction = directionRef.current.clone().normalize();
        const angle = Math.atan2(direction.y, direction.x);
        previousRotation.current = angle;
        targetRotation.current = angle;
        group.rotation.z = angle;

        if (direction.x < 0 && initialScale.current) {
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

      return;
    }

    loadAnimalSVG(
      animal,
      group,
      scale,
      isLocalPlayer,
      setAnimalDimensions,
      positionRef,
      directionRef,
      initialScale,
      previousRotation,
      targetRotation,
      svgLoaded,
      previousPosition,
      currentFlipState
    )
      .then(() => {
        // After SVG is loaded, add edge geometry with user-specific color
        if (animalGraphicsCache.has(animal)) {
          const cached = animalGraphicsCache.get(animal)!;
          const borderColor = getAnimalBorderColor(user);
          const edgeLines = createEdgeGeometry(
            borderColor,
            isLocalPlayer,
            cached.outlineLineGeometry,
            cached.geometry
          );
          group.add(edgeLines);
        }
      })
      .catch(() => {
        // SVG loading failed - silently handle
      });

    return () => {
      // Only dispose if this animal type is NOT cached (i.e., loading failed)
      if (!animalGraphicsCache.has(animal)) {
        // Properly dispose of all geometries and materials
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
          if (child instanceof THREE.LineSegments) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }

      group.clear();
    };
  });

  // Track component lifecycle
  useEffect(() => {
    return () => {
      // Component cleanup
    };
  }, []);

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
  setAnimalDimensions,
  animalDimensions,
  terrainBoundaries: _terrainBoundaries,
}: {
  user: UserInfo;
  myUserId: string;
  setAnimalDimensions: (
    animal: string,
    dimensions: { width: number; height: number }
  ) => void;
  animalDimensions?: { [animal: string]: { width: number; height: number } };
  terrainBoundaries?: TerrainBoundaries;
}) {
  
  // Calculate the highest point of the animal considering rotation and dimensions
  const calculateHighestPoint = () => {
    const dimensions = animalDimensions?.[user.animal as Animal];
    if (!dimensions) {
      return 3.0; // Fallback distance if dimensions not available
    }

    const { width, height } = dimensions;
    
    // Get the current direction to calculate rotation
    const direction = user.direction;
    let rotation = Math.atan2(direction.y, direction.x);
    
    // Apply initial animal orientation
    const orientation = ANIMAL_ORIENTATION[user.animal as Animal] || { rotation: 0, flipY: false };
    rotation += orientation.rotation;
    
    // Calculate the four corners of the animal's bounding box
    const halfWidth = width / 2;
    
    // Account for potential Y-axis flipping
    const effectiveHeight = orientation.flipY ? height : height;
    const effectiveHalfHeight = effectiveHeight / 2;
    
    const corners = [
      { x: -halfWidth, y: -effectiveHalfHeight },
      { x: halfWidth, y: -effectiveHalfHeight },
      { x: halfWidth, y: effectiveHalfHeight },
      { x: -halfWidth, y: effectiveHalfHeight }
    ];
    
    // If the animal is flipped horizontally (direction.x < 0), we might also have Y-flipping
    const isFlippedHorizontally = direction.x < 0;
    
    // Rotate each corner and find the highest Y coordinate
    let maxY = -Infinity;
    corners.forEach(corner => {
      let { x, y } = corner;
      
      // Apply Y-flip if the animal is facing left and has flipY behavior
      if (isFlippedHorizontally && orientation.flipY) {
        y = -y;
      }
      
      // Apply rotation
      const rotatedY = x * Math.sin(rotation) + y * Math.cos(rotation);
      maxY = Math.max(maxY, rotatedY);
    });
    
    // Add padding above the highest point
    return maxY + 1.5;
  };

  // Get text info for nickname
  const getNicknameTextInfo = () => {
    const baseColor = new THREE.Color('#FFFFFF'); // White for nickname
    const outlineColor = getAnimalBorderColor(user); // Player's color for outline
    
    // Calculate position based on the actual highest point of the rotated animal
    const yOffset = calculateHighestPoint();
    
    return {
      text: user.nickname,
      position: [0, yOffset, 0] as [number, number, number], // Position above the highest point
      fontSize: 1.8, // Slightly smaller font
      color: baseColor,
      outlineColor: outlineColor
    };
  };
  
  const nicknameTextInfo = getNicknameTextInfo();
  // Create position ref as Vector3
  const isLocalPlayer = myUserId === user.id;
  const positionRef = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z ?? 0)
  );

  // Create direction ref as Vector3
  const directionRef = useRef<THREE.Vector3>(
    new THREE.Vector3(user.direction.x, user.direction.y, 0)
  );

  // Update refs when user data changes
  useEffect(() => {
    positionRef.current.set(user.position.x, user.position.y, user.position.z ?? 0);

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
        user={user}
        setAnimalDimensions={setAnimalDimensions}
        terrainBoundaries={_terrainBoundaries}
      />
      {/* Nickname */}
      {nicknameTextInfo && (
        <Text
          position={[
            user.position.x + nicknameTextInfo.position[0],
            user.position.y + nicknameTextInfo.position[1],
            nicknameTextInfo.position[2]
          ]}
          fontSize={nicknameTextInfo.fontSize}
          color={nicknameTextInfo.color}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
          outlineWidth={0.2}
          outlineColor={nicknameTextInfo.outlineColor}
        >
          {nicknameTextInfo.text}
        </Text>
      )}
      {/* Captured NPCs count */}
    </>
  );
}
