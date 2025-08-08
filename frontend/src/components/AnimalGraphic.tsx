import React, { useMemo, useEffect, useRef, useState } from "react";
import { UserInfo, Animal, ANIMAL_SCALES, ANIMAL_ORIENTATION } from "shared/types";
import * as THREE from "three";
import { useAnimationManagerContext } from "../contexts/AnimationManagerContext";
import { Text } from "@react-three/drei";
import { smoothMove } from "../utils/movement";
import { useMount } from "../hooks/use-npc-group-base";
import {
  loadAnimalSVG,
  animalGraphicsCache,
  createEdgeGeometry,
} from "../utils/load-animal-svg";
import { getAnimalBorderColor, getNicknameOutlineColor } from "../utils/animal-colors";
import { TerrainBoundaries } from "../utils/terrain";
import { Z_DEPTHS, RENDER_ORDERS } from "shared/z-depths";

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
  onRemotePositionUpdate,
  onLocalUserPositionUpdate,
  renderedRotationRef,
  targetPositionRef,
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
  onRemotePositionUpdate?: (position: [number, number, number]) => void;
  onLocalUserPositionUpdate?: (position: THREE.Vector3) => void;
  renderedRotationRef?: React.MutableRefObject<number>;
  targetPositionRef?: React.MutableRefObject<THREE.Vector3>;
}) {
  const animationManager = useAnimationManagerContext();
  const group = useMemo(() => new THREE.Group(), []);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  const previousRotation = useRef(0);
  const targetRotation = useRef(0);
  const initialScale = useRef<THREE.Vector3 | null>(null);
  const svgLoaded = useRef(false);
  const currentYScale = useRef(1); // Current Y scale (-1 for flipped, 1 for normal)
  const initialOrientation = useRef(
    ANIMAL_ORIENTATION[animal] || { rotation: 0, flipY: false }
  );
  const animalAnimationId = useRef<string>(`animal-${user.id}`);

  // Get outline effect functions

  useMount(() => {
    const cacheKey = animal;

    // Check if we have cached graphics for this animal
    if (animalGraphicsCache.has(cacheKey)) {
      const cached = animalGraphicsCache.get(cacheKey)!;

      // Create material with cached texture
      const material = new THREE.MeshBasicMaterial({
        map: cached.texture,
        transparent: false,
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
      });

      // Create mesh with cached geometry
      const mesh = new THREE.Mesh(cached.geometry.clone(), material);
      mesh.renderOrder = isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_GRAPHIC : RENDER_ORDERS.REMOTE_ANIMAL_GRAPHIC;
      mesh.position.z = isLocalPlayer ? Z_DEPTHS.LOCAL_ANIMAL_GRAPHIC : Z_DEPTHS.REMOTE_ANIMAL_GRAPHIC;
      group.add(mesh);

      // Create edge geometry with user-specific color (before scaling so it scales with the group)
      const borderColor = getAnimalBorderColor(user);
      const edgeLines = createEdgeGeometry(
        borderColor,
        isLocalPlayer,
        cached.outlineLineGeometry,
        cached.geometry,
        isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_OUTLINE : RENDER_ORDERS.REMOTE_ANIMAL_OUTLINE
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

      // Initialize nickname position for remote users
      if (!isLocalPlayer && onRemotePositionUpdate) {
        onRemotePositionUpdate([positionRef.current.x, positionRef.current.y, positionRef.current.z]);
      }

      // Apply initial rotation if available
      if (directionRef.current && directionRef.current.length() > 0.01) {
        const direction = directionRef.current.clone().normalize();
        const angle = Math.atan2(direction.y, direction.x);
        previousRotation.current = angle;
        targetRotation.current = angle;
        group.rotation.z = angle;

        // Set initial Y scale based on direction
        if (direction.x < 0) {
          currentYScale.current = -1;
          group.scale.y = -Math.abs(initialScale.current.y);
        } else {
          currentYScale.current = 1;
          group.scale.y = Math.abs(initialScale.current.y);
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
      currentYScale
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
            cached.geometry,
            isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_OUTLINE : RENDER_ORDERS.REMOTE_ANIMAL_OUTLINE
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
    }
  }
  // Register animal animation with AnimationManager
  useEffect(() => {
    const callbackId = animalAnimationId.current;
    const animalCallback = (_state: unknown, _delta: number) => {
      // Skip if SVG isn't loaded yet
      if (!svgLoaded.current || !initialScale.current) return;

      // Position handling - direct for local, interpolated for remote
      if (isLocalPlayer) {
        // Local players: use direct position for responsive controls
        group.position.copy(positionRef.current);

        // Update shared position ref for local user NPCs (use direct position)
        if (onLocalUserPositionUpdate) {
          onLocalUserPositionUpdate(positionRef.current);
        }
      } else {
        // Apply smooth movement for remote players only (use targetPosition instead of positionRef)
        const targetPos = targetPositionRef ? targetPositionRef.current : positionRef.current;
        previousPosition.copy(
          smoothMove(previousPosition.clone(), targetPos, {
            lerpFactor: 0.1,
            moveSpeed: MOVE_SPEED,
            minDistance: 0.01,
            useConstantSpeed: true,
          })
        );

        // Apply the calculated position
        group.position.copy(previousPosition);
        
        // Update nickname position for remote users only (pass the smoothed animal position)
        if (onRemotePositionUpdate) {
          onRemotePositionUpdate([previousPosition.x, previousPosition.y, previousPosition.z]);
        }
      }

      if (directionRef.current && directionRef.current.length() > 0.01) {
        setRotation(directionRef.current);
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
          currentYScale.current < 0
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

      // Update rendered rotation ref for external components
      if (renderedRotationRef) {
        renderedRotationRef.current = previousRotation.current;
      }

      // Handle Y scale flipping based on direction
      if (directionRef.current && directionRef.current.length() > 0.01) {
        const direction = directionRef.current.clone().normalize();
        const targetYScale = direction.x < 0 ? -1 : 1;
        
        // Smoothly animate Y scale towards target
        if (Math.abs(currentYScale.current - targetYScale) > 0.1) {
          const flipSpeed = FLIP_SPEED;
          currentYScale.current += (targetYScale - currentYScale.current) * flipSpeed;
          
          // Apply the current Y scale
          group.scale.y = currentYScale.current * Math.abs(initialScale.current.y);
        } else {
          // Snap to target when close enough
          currentYScale.current = targetYScale;
          group.scale.y = targetYScale * Math.abs(initialScale.current.y);
        }
      }
    };

    animationManager.registerAnimationCallback(callbackId, animalCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [
    animationManager,
    group,
    positionRef,
    directionRef,
    isLocalPlayer,
    previousPosition,
    onLocalUserPositionUpdate,
  ]);

  return <primitive object={group} />;
}

export default function AnimalGraphic({
  user,
  myUserId,
  setAnimalDimensions,
  animalDimensions,
  terrainBoundaries: _terrainBoundaries,
  onLocalUserPositionUpdate,
  renderedRotationRef,
}: {
  user: UserInfo;
  myUserId: string;
  setAnimalDimensions: (
    animal: string,
    dimensions: { width: number; height: number }
  ) => void;
  animalDimensions?: { [animal: string]: { width: number; height: number } };
  terrainBoundaries?: TerrainBoundaries;
  onLocalUserPositionUpdate?: (position: THREE.Vector3) => void;
  renderedRotationRef?: React.MutableRefObject<number>;
}) {
  // Create position ref as Vector3
  const isLocalPlayer = myUserId === user.id;

  
  // Calculate the highest point of the animal considering rotation and dimensions (memoized)
  const highestPoint = useMemo(() => {
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
  }, [animalDimensions, user.animal, user.direction]);

  // Get text info for nickname (memoized)
  const nicknameTextInfo = useMemo(() => {
    const baseColor = getAnimalBorderColor(user); // Use animal color for nickname
    const outlineColor = getNicknameOutlineColor(user); // White or black based on animal color
    
    return {
      text: user.nickname,
      position: [0, highestPoint, 0] as [number, number, number], // Position above the highest point
      fontSize: 1.8, // Slightly smaller font
      color: baseColor,
      outlineColor: outlineColor
    };
  }, [user, highestPoint]);

  const positionRef = useRef(
    new THREE.Vector3(user.position.x, user.position.y, user.position.z ?? 0)
  );

  // State for remote user nickname position (will trigger re-renders)
  const [remoteNicknamePosition, setRemoteNicknamePosition] = useState([
    user.position.x, user.position.y, user.position.z ?? 0
  ]);

  // Create direction ref as Vector3
  const directionRef = useRef<THREE.Vector3>(
    new THREE.Vector3(user.direction.x, user.direction.y, 0)
  );

  // Separate target position for remote players to prevent double lurch
  const targetPosition = useRef(new THREE.Vector3(user.position.x, user.position.y, user.position.z ?? 0));

  // Update refs when user data changes
  useEffect(() => {
    if (isLocalPlayer) {
      // For local players, update position ref directly for responsive controls
      positionRef.current.set(user.position.x, user.position.y, user.position.z ?? 0);
    } else {
      // For remote players, only update the target position (not positionRef)
      targetPosition.current.set(user.position.x, user.position.y, user.position.z ?? 0);
      // Don't update remoteNicknamePosition here - let the animation callback handle it
    }

    // Update direction ref if direction exists, preserving z=0
    if (user.direction) {
      if (!directionRef.current) {
        directionRef.current = new THREE.Vector3();
      }
      directionRef.current.set(user.direction.x, user.direction.y, 0);
    }
  }, [user.position.x, user.position.y, user.position.z, user.direction, isLocalPlayer]);

  // Ensure remote nickname position is initialized for new users (only on user ID change)
  useEffect(() => {
    if (!isLocalPlayer) {
      setRemoteNicknamePosition([user.position.x, user.position.y, user.position.z ?? 0]);
    }
  }, [user.id, isLocalPlayer]); // Only trigger on user ID or local player change, not position changes

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
        onRemotePositionUpdate={isLocalPlayer ? undefined : (pos) => {
          setRemoteNicknamePosition(pos);
        }}
        onLocalUserPositionUpdate={onLocalUserPositionUpdate}
        renderedRotationRef={renderedRotationRef}
        targetPositionRef={isLocalPlayer ? undefined : targetPosition}
      />
      {/* Nickname */}
      {nicknameTextInfo && (
        <Text
          position={[
            (isLocalPlayer ? user.position.x : remoteNicknamePosition[0]) + nicknameTextInfo.position[0],
            (isLocalPlayer ? user.position.y : remoteNicknamePosition[1]) + nicknameTextInfo.position[1],
            (isLocalPlayer ? Z_DEPTHS.LOCAL_ANIMAL_NICKNAME + .2 : Z_DEPTHS.REMOTE_ANIMAL_NICKNAME + .2)
          ]}
          fontSize={nicknameTextInfo.fontSize}
          color={nicknameTextInfo.color}
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff"
          outlineWidth={0.2}
          outlineColor={nicknameTextInfo.outlineColor}
          outlineOpacity={1.0}
          fillOpacity={1.0}
          renderOrder={isLocalPlayer ? RENDER_ORDERS.LOCAL_ANIMAL_NICKNAME: RENDER_ORDERS.REMOTE_ANIMAL_NICKNAME}
        >
          {nicknameTextInfo.text}
        </Text>
      )}
      {/* Captured NPCs count */}
    </>
  );
}
