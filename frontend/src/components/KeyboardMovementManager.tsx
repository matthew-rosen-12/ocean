import React, { useEffect, useRef } from 'react';
import { useAnimationManagerContext } from '../contexts/AnimationManagerContext';
import * as THREE from 'three';
import { Direction, UserInfo, NPCGroupsBiMap, pathData, npcGroupId, DIRECTION_OFFSET } from 'shared/types';
import { pathNPCGroup } from '../utils/npc-throwing';
import { TerrainConfig } from '../utils/terrain';

// Speed of movement per second (time-based, not frame-based)
const MOVEMENT_SPEED = 90; // 90 units per second

interface KeyboardMovementManagerProps {
  position: THREE.Vector3;
  direction: Direction;
  setPosition: (position: THREE.Vector3) => void;
  setDirection: (direction: Direction) => void;
  keysPressed: Set<string>;
  spaceStartTime: number | null;
  setSpaceStartTime: (time: number | null) => void;
  myUser: UserInfo;
  npcGroups: NPCGroupsBiMap;
  paths: Map<npcGroupId, pathData>;
  setPaths: (paths: Map<npcGroupId, pathData>) => void;
  setNpcGroups: (value: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)) => void;
  terrain: TerrainConfig;
  animalDimensions: { [animal: string]: { width: number; height: number } };
  checkBoundaryCollision: (
    position: THREE.Vector3,
    change: THREE.Vector3,
    rotation: number,
    dimensions: { width: number; height: number }
  ) => THREE.Vector3;
  inputDisabled: boolean;
}

export const KeyboardMovementManager: React.FC<KeyboardMovementManagerProps> = ({
  position,
  direction,
  setPosition,
  setDirection,
  keysPressed,
  spaceStartTime,
  setSpaceStartTime,
  myUser,
  npcGroups,
  paths,
  setPaths,
  setNpcGroups,
  terrain,
  animalDimensions,
  checkBoundaryCollision,
  inputDisabled,
}) => {
  const animationManager = useAnimationManagerContext();
  const keyboardAnimationId = useRef<string>(`keyboard-${myUser.id}`);

  const updatePosition = (delta: number) => {
    if (inputDisabled) return;
    
    const change = new THREE.Vector3(0, 0, 0);

    // Check which keys are pressed
    const up = keysPressed.has("ArrowUp") || keysPressed.has("w");
    const down = keysPressed.has("ArrowDown") || keysPressed.has("s");
    const left = keysPressed.has("ArrowLeft") || keysPressed.has("a");
    const right = keysPressed.has("ArrowRight") || keysPressed.has("d");

    // Update position vector using delta time for consistent movement speed
    const deltaMovement = MOVEMENT_SPEED * delta;
    if (up) change.y += deltaMovement;
    if (down) change.y -= deltaMovement;
    if (left) change.x -= deltaMovement;
    if (right) change.x += deltaMovement;

    // Primary direction logic
    let newDirection = { x: 0, y: 0 };

    // True diagonal movement - both components active
    if (!left && !right && up && !down) {
      newDirection = {
        x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: 1,
      };
    } else if (!left && !right && !up && down) {
      newDirection = {
        x: direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: -1,
      };
    } else {
      if (left && !right) {
        newDirection.x -= 1;
      } else if (right && !left) {
        newDirection.x += 1;
      }
      if (up && !down) {
        newDirection.y += 1;
      } else if (down && !up) {
        newDirection.y -= 1;
      }
    }

    // Normalize diagonal movement to maintain consistent speed
    if (newDirection.x !== 0 && newDirection.y !== 0) {
      const length = Math.sqrt(
        newDirection.x * newDirection.x + newDirection.y * newDirection.y
      );
      newDirection.x /= length;
      newDirection.y /= length;
    }

    // Apply boundary constraints with rotated bounding box
    if (change.x !== 0 || change.y !== 0) {
      // Get animal dimensions
      const dimensions = animalDimensions[myUser.animal];
      if (!dimensions) {
        // Fallback to simple position blocking if dimensions not available
        const newPosition = position.clone().add(change);
        newPosition.x = Math.max(
          terrain.boundaries.minX,
          Math.min(terrain.boundaries.maxX, newPosition.x)
        );
        newPosition.y = Math.max(
          terrain.boundaries.minY,
          Math.min(terrain.boundaries.maxY, newPosition.y)
        );
        setPosition(newPosition);
      } else {
        // Calculate current rotation based on direction
        const currentRotation = Math.atan2(newDirection.y, newDirection.x);

        // Use rotated bounding box collision detection
        const newPosition = checkBoundaryCollision(
          position,
          change,
          currentRotation,
          dimensions
        );
        setPosition(newPosition);
      }
      setDirection(newDirection);
    }
  };

  // Register keyboard movement with AnimationManager
  useEffect(() => {
    const callbackId = keyboardAnimationId.current;
    const keyboardCallback = (_state: unknown, delta: number) => {
      updatePosition(delta);
    };

    animationManager.registerAnimationCallback(callbackId, keyboardCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [
    animationManager,
    inputDisabled,
    keysPressed,
    direction,
    position,
    setPosition,
    setDirection,
    animalDimensions,
    myUser.animal,
    terrain.boundaries,
    checkBoundaryCollision,
  ]);

  return null; // This component doesn't render anything
};