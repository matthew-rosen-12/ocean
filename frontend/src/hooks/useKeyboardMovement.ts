import { useState, useRef, useEffect } from "react";
import {
  Direction,
  npcGroupId,
  pathData,
  UserInfo,
  NPCGroupsBiMap,
  DIRECTION_OFFSET,
} from "shared/types";
import * as THREE from "three";
import { useMount } from "./use-npc-group-base";
import { pathNPCGroup } from "../utils/npc-throwing";
import { TerrainConfig } from "../utils/terrain";

// Speed of movement per frame (keeping original frame-based approach for now)
const MOVEMENT_SPEED = 1.5; // Increased from 0.5 to compensate for potential frame rate differences

export function useKeyboardMovement(
  initialPosition: THREE.Vector3,
  initialDirection: Direction,
  myUser: UserInfo,
  npcGroups: NPCGroupsBiMap,
  paths: Map<npcGroupId, pathData>,
  setPaths: (paths: Map<npcGroupId, pathData>) => void,
  setNpcGroups: (
    value:
      | NPCGroupsBiMap
      | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void,
  terrain: TerrainConfig,
  animalDimensions: { [animal: string]: { width: number; height: number } },
  checkBoundaryCollision: (
    position: THREE.Vector3,
    change: THREE.Vector3,
    rotation: number,
    dimensions: { width: number; height: number }
  ) => THREE.Vector3,
  inputDisabled: boolean = false
) {
  const [position, setPosition] = useState(initialPosition);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [keysPressed, setKeysPressed] = useState(new Set<string>());
  const [spaceStartTime, setSpaceStartTime] = useState<number | null>(null);
  const animationFrameRef = useRef<number>();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (inputDisabled) return;
    
    setKeysPressed((prev) => new Set(prev).add(event.key));

    // Handle space bar press for pathing NPCs - start charging
    if (
      (event.key === " " || event.key === "Spacebar") &&
      npcGroups.getByUserId(myUser.id)?.fileNames.length !== 0 &&
      spaceStartTime === null
    ) {
      setSpaceStartTime(Date.now());
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (inputDisabled) return;
    
    setKeysPressed((prev) => {
      const next = new Set(prev);
      next.delete(event.key);
      return next;
    });

    // Handle space bar release - throw NPCs based on charge time
    if (
      (event.key === " " || event.key === "Spacebar") &&
      spaceStartTime !== null &&
      npcGroups.getByUserId(myUser.id)?.fileNames.length !== 0
    ) {
      const chargeDuration = Date.now() - spaceStartTime;
      // Calculate throw count: doubles every 4000ms (4 seconds) due to 0.25 multiplier
      // Base count is 1, then 2^(seconds * 0.25)
      const secondsHeld = Math.min(chargeDuration / 1000 * 4, 10); // Cap at 10 seconds
      const throwCount = Math.floor(Math.pow(2, secondsHeld));
      
      pathNPCGroup(
        myUser,
        npcGroups.getByUserId(myUser.id)!,
        paths,
        setPaths,
        setNpcGroups,
        throwCount,
      );
      
      setSpaceStartTime(null);
    }
  };

  const updatePosition = () => {
    if (inputDisabled) return;
    
    const change = new THREE.Vector3(0, 0, 0);

    // Check which keys are pressed
    const up = keysPressed.has("ArrowUp") || keysPressed.has("w");
    const down = keysPressed.has("ArrowDown") || keysPressed.has("s");
    const left = keysPressed.has("ArrowLeft") || keysPressed.has("a");
    const right = keysPressed.has("ArrowRight") || keysPressed.has("d");

    // Update position vector
    if (up) change.y += MOVEMENT_SPEED;
    if (down) change.y -= MOVEMENT_SPEED;
    if (left) change.x -= MOVEMENT_SPEED;
    if (right) change.x += MOVEMENT_SPEED;

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
      setPosition((current) => {
        // Get animal dimensions
        const dimensions = animalDimensions[myUser.animal];
        if (!dimensions) {
          // Fallback to simple position blocking if dimensions not available
          const newPosition = current.clone().add(change);
          newPosition.x = Math.max(
            terrain.boundaries.minX,
            Math.min(terrain.boundaries.maxX, newPosition.x)
          );
          newPosition.y = Math.max(
            terrain.boundaries.minY,
            Math.min(terrain.boundaries.maxY, newPosition.y)
          );
          return newPosition;
        }

        // Calculate current rotation based on direction
        const currentRotation = Math.atan2(newDirection.y, newDirection.x);

        // Use rotated bounding box collision detection
        return checkBoundaryCollision(
          current,
          change,
          currentRotation,
          dimensions
        );
      });
      setDirection(newDirection);
    }
  };

  const updatePositionRef = useRef(updatePosition);
  const handleKeyDownRef = useRef(handleKeyDown);
  const handleKeyUpRef = useRef(handleKeyUp);

  useEffect(() => {
    updatePositionRef.current = updatePosition;
    handleKeyDownRef.current = handleKeyDown;
    handleKeyUpRef.current = handleKeyUp;
  });

  useMount(() => {
    const handleKeyDownWrapper = (event: KeyboardEvent) => {
      handleKeyDownRef.current?.(event);
    };

    const handleKeyUpWrapper = (event: KeyboardEvent) => {
      handleKeyUpRef.current?.(event);
    };

    window.addEventListener("keydown", handleKeyDownWrapper);
    window.addEventListener("keyup", handleKeyUpWrapper);

    return () => {
      window.removeEventListener("keydown", handleKeyDownWrapper);
      window.removeEventListener("keyup", handleKeyUpWrapper);
    };
  });

  return { 
    position, 
    direction, 
    spaceStartTime, 
    keysPressed,
    setPosition,
    setDirection,
    setSpaceStartTime
  };
}