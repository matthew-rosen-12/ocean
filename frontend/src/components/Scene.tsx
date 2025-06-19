// nature_v_npc/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Direction,
  NPCGroup,
  npcGroupId,
  NPCPhase,
  PathPhase,
  pathData,
  userId,
  UserInfo,
  NPCGroupsBiMap,
  FinalScores,
} from "shared/types";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { typedSocket } from "../socket";
import { ANIMAL_SCALES, DIRECTION_OFFSET } from "../constants";
import AnimalGraphic from "./AnimalGraphic";
import { throttle } from "lodash";
import { v4 as uuidv4 } from "uuid";
import NPCGraphicWrapper from "./npc-graphics/NPCGroupGraphicWrapper";
import { useMount } from "../hooks/use-npc-group-base";
import * as THREE from "three";
import { 
  calculateNPCGroupVelocityFactor, 
  calculateNPCGroupDistanceFactor 
} from "../utils/npc-group-utils";
import { TerrainConfig } from "../utils/terrain";
// Extend Performance interface for Chrome's memory API
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

// Speed of movement per keypress/frame
const MOVEMENT_SPEED = 0.5;
// Min distance before broadcasting position change
const POSITION_THRESHOLD = 0.01;
// Throttle duration in milliseconds
const THROTTLE_MS = 100;

interface CameraControllerProps {
  targetPosition: THREE.Vector3;
  animalScale: number;
}

function CameraController({ targetPosition }: CameraControllerProps) {
  const { camera } = useThree();
  const zdistance = 30;

  useEffect(() => {
    camera.position.set(targetPosition.x, targetPosition.y, zdistance);
  }, [camera, targetPosition.x, targetPosition.y, zdistance]);

  return null;
}

async function pathNPCGroup(
  myUser: UserInfo,
  npcGroup: NPCGroup,
  paths: Map<npcGroupId, pathData>,
  setPaths: (paths: Map<npcGroupId, pathData>) => void,
  setNpcGroups: (
    value:
      | NPCGroupsBiMap
      | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void,
  throwCount: number = 1,
) {
  try {
    // Calculate how many NPCs to throw (limited by available NPCs)
    const actualThrowCount = Math.min(throwCount, npcGroup.fileNames.length);
    
    // Create new objects instead of mutating
    const captorNPCGroup = new NPCGroup({
      ...npcGroup,
      fileNames: npcGroup.fileNames.slice(0, -actualThrowCount),

    });
    const pathNPCGroup = new NPCGroup({
      ...npcGroup,
      id: uuidv4(),
      fileNames: npcGroup.fileNames.slice(-actualThrowCount),
      phase: NPCPhase.PATH,
    });

    // Calculate velocity and distance based on group size
    const baseVelocity = 20;
    const baseDuration = 2000;
    
    const velocityFactor = calculateNPCGroupVelocityFactor(actualThrowCount);
    const distanceFactor = calculateNPCGroupDistanceFactor(actualThrowCount);
    
    // Higher velocity and longer duration for larger groups
    const scaledVelocity = baseVelocity * velocityFactor;
    const scaledDuration = baseDuration * distanceFactor;

    // Create new path data
    const newpathData: pathData = {
      id: uuidv4(),
      room: myUser.room,
      npcGroup: pathNPCGroup,
      startPosition: {
        x: myUser.position.x,
        y: myUser.position.y,
      },
      pathDuration: scaledDuration,
      timestamp: Date.now(),
      direction: {
        x: Math.round(myUser.direction.x),
        y: Math.round(myUser.direction.y),
      },
      velocity: scaledVelocity,
      pathPhase: PathPhase.THROWN, // This is a thrown NPC
    };

    // Create new paths map
    const updatedpaths = new Map(paths);
    updatedpaths.set(pathNPCGroup.id, newpathData);

        // Socket call to path the NPC
    const currentTypedSocket = typedSocket();
    currentTypedSocket.emit("path-npc-group", { pathData: newpathData });
    if (captorNPCGroup.fileNames.length > 0) {
      currentTypedSocket.emit("update-npc-group", { npcGroup: captorNPCGroup });
    }

    setPaths(updatedpaths);
    setNpcGroups((prev) => {
      const newNpcGroups = new NPCGroupsBiMap(prev);
      if (captorNPCGroup.fileNames.length == 0) {
        newNpcGroups.deleteByNpcGroupId(captorNPCGroup.id);
      }
      else {
        newNpcGroups.setByNpcGroupId(captorNPCGroup.id, captorNPCGroup);
      }
      newNpcGroups.setByNpcGroupId(pathNPCGroup.id, pathNPCGroup);
      return newNpcGroups;
    });
  } catch {
    // Error pathing NPC
  }
}

function useKeyboardMovement(
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
      // Calculate throw count: doubles every 1000ms (1 second)
      // Base count is 1, then 2^(seconds)
      const secondsHeld = Math.min(chargeDuration / 1000, 10); // Cap at 10 seconds
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
    const updatePositionWrapper = () => {
      updatePositionRef.current();
    };

    const handleKeyDownWrapper = (event: KeyboardEvent) => {
      handleKeyDownRef.current?.(event);
    };

    const handleKeyUpWrapper = (event: KeyboardEvent) => {
      handleKeyUpRef.current?.(event);
    };

    const animate = () => {
      updatePositionWrapper();
      // Store the ID so we can cancel it properly
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation loop once
    animationFrameRef.current = requestAnimationFrame(animate);
    window.addEventListener("keydown", handleKeyDownWrapper);
    window.addEventListener("keyup", handleKeyUpWrapper);

    return () => {
      window.removeEventListener("keydown", handleKeyDownWrapper);
      window.removeEventListener("keyup", handleKeyUpWrapper);
    };
  });

  return { position, direction, spaceStartTime };
}

interface Props {
  users: Map<userId, UserInfo>;
  myUser: UserInfo;
  paths: Map<npcGroupId, pathData>;
  npcGroups: NPCGroupsBiMap;
  setPaths: (
    value:
      | Map<npcGroupId, pathData>
      | ((prev: Map<npcGroupId, pathData>) => Map<npcGroupId, pathData>)
  ) => void;
  setNpcGroups: (
    value:
      | NPCGroupsBiMap
      | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  terrain: TerrainConfig;
  onScreenshotCapture?: (screenshot: string) => void;
  onGameOver?: (finalScores: FinalScores) => void;
}

export default function Scene({
  users,
  myUser,
  paths,
  npcGroups,
  setPaths,
  setNpcGroups,
  terrain,
  onScreenshotCapture,
  onGameOver,
}: Props) {
  const initialPosition = new THREE.Vector3(
    myUser.position.x,
    myUser.position.y,
    0 // Explicitly set z to 0
  );

  const initialDirection = {
    x: myUser.direction.x,
    y: myUser.direction.y,
  };

  const [cinematicActive, setCinematicActive] = useState(false);
  const [showTimesUpText, setShowTimesUpText] = useState(false);

  const [animalDimensions, setAnimalDimensions] = useState<{
    [animal: string]: { width: number; height: number };
  }>({});


  // Helper function to check simple center-based collision with terrain boundaries
  const checkBoundaryCollision = (
    position: THREE.Vector3,
    change: THREE.Vector3,
    _rotation: number,
    _dimensions: { width: number; height: number }
  ): THREE.Vector3 => {
    const newPosition = position.clone().add(change);

    // Use a simple buffer distance from the center

    // Check boundaries and clamp position
    let adjustedX = newPosition.x;
    let adjustedY = newPosition.y;

    // Check X boundaries
    if (newPosition.x < terrain.boundaries.minX) {
      adjustedX = terrain.boundaries.minX;
    } else if (newPosition.x > terrain.boundaries.maxX) {
      adjustedX = terrain.boundaries.maxX;
    }

    // Check Y boundaries
    if (newPosition.y < terrain.boundaries.minY) {
      adjustedY = terrain.boundaries.minY;
    } else if (newPosition.y > terrain.boundaries.maxY) {
      adjustedY = terrain.boundaries.maxY;
    }

    return new THREE.Vector3(adjustedX, adjustedY, newPosition.z);
  };

  const { position, direction, spaceStartTime } = useKeyboardMovement(
    initialPosition,
    initialDirection,
    myUser,
    npcGroups,
    paths,
    setPaths,
    setNpcGroups,
    terrain,
    animalDimensions,
    checkBoundaryCollision,
    cinematicActive
  );

  // --- REFACTOR: Use refs for last broadcasted position/direction ---
  const lastBroadcastPosition = useRef(position.clone());
  const lastBroadcastDirection = useRef({ ...direction });

  // Only broadcast if position or direction actually changed
  const broadcastPosition = useCallback(() => {
    const positionDelta = new THREE.Vector3()
      .copy(position)
      .sub(lastBroadcastPosition.current);
    const positionChanged = positionDelta.length() >= POSITION_THRESHOLD;

    const directionChanged =
      lastBroadcastDirection.current.x !== direction.x ||
      lastBroadcastDirection.current.y !== direction.y;

    if (positionChanged || directionChanged) {
      // Emit socket event
      const currentTypedSocket = typedSocket();
      currentTypedSocket.emit("update-user", {
        user: {
          ...myUser,
          position: position.clone(),
          direction: { ...direction },
        },
      });
      lastBroadcastPosition.current.copy(position);
      lastBroadcastDirection.current = { ...direction };
    }
  }, [position, direction, myUser]);

  // Throttle the broadcast function ONCE, not per render
  const throttledBroadcast = useMemo(() => {
    return throttle(broadcastPosition, THROTTLE_MS, {
      leading: true,
      trailing: true,
    });
  }, [broadcastPosition]);

  // Effect to broadcast position/direction changes
  useEffect(() => {
    myUser.position = position.clone();
    myUser.direction = { ...direction };
    users.set(myUser.id, myUser);
    throttledBroadcast();
  }, [position, direction, myUser, throttledBroadcast, users]);

  const handleNPCGroupCollision = useCallback(
    (capturedNPCGroup: NPCGroup, localUser: boolean) => {
      // Prevent duplicate processing of the same NPC
      capturedNPCGroup.phase = NPCPhase.IDLE;
      setPaths((prev: Map<npcGroupId, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.delete(capturedNPCGroup.id); // remove the path data for the captured NPC
        return newPaths as Map<npcGroupId, pathData>;
      });

      setNpcGroups((prev) => {
        const newNpcGroups = new NPCGroupsBiMap(prev);
        
        // 1. get user's npc group from the CURRENT state (not stale closure)
        let userNpcGroup = newNpcGroups.getByUserId(myUser.id);
        if (!userNpcGroup) {
          userNpcGroup = new NPCGroup({
            id: uuidv4(),
            fileNames: [],
            position: myUser.position,
            phase: NPCPhase.IDLE,
            direction: { x: 0, y: 0 },
          });
        }

        // 2. create new npc group with current user's NPCs + captured NPC
        const updatedNpcGroup = new NPCGroup({
          id: userNpcGroup.id,
          fileNames: [...userNpcGroup.fileNames, ...capturedNPCGroup.fileNames],
          position: myUser.position,
          phase: NPCPhase.CAPTURED,
          captorId: myUser.id, // Set the captorId
          direction: userNpcGroup.direction,
        });

        // Remove the original NPC group
        newNpcGroups.deleteByNpcGroupId(capturedNPCGroup.id);
        // Add the updated group with the correct ID
        newNpcGroups.setByNpcGroupId(updatedNpcGroup.id, updatedNpcGroup);

        // Emit socket event inside the state update to use the correct updatedNpcGroup
        if (localUser) {
          const currentTypedSocket = typedSocket();
          currentTypedSocket.emit("capture-npc-group", {
            capturedNPCGroupId: capturedNPCGroup.id,
            room: myUser.room,
            updatedNpcGroup: updatedNpcGroup,
          });
        }

        return newNpcGroups;
      });
    },
    [myUser.id, myUser.room, myUser.position, setNpcGroups, setPaths]
  );

  const normalizeDirection = useCallback((direction: Direction) => {
    const length = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y
    );
    return { x: direction.x / length, y: direction.y / length };
  }, []);

  // Function to make an NPC flee from the player
  const makeNPCGroupFlee = useCallback(
    (npcGroup: NPCGroup, npcPosition: THREE.Vector3) => {
      // Create new objects instead of mutating
      const updatedNpcGroup = new NPCGroup({
        id: npcGroup.id,
        fileNames: npcGroup.fileNames,
        captorId: npcGroup.captorId,
        position: npcGroup.position,
        direction: npcGroup.direction,
        phase: NPCPhase.PATH,
      });

      // Get current path data
      const currentPathData = paths.get(npcGroup.id);

      // Calculate flee direction from all nearby users using weighted averaging
      let totalFleeForce = { x: 0, y: 0 };
      let totalWeight = 0;

      // Check all users for flee influence
      Array.from(users.values()).forEach((user) => {
        const distance = Math.sqrt(
          (npcPosition.x - user.position.x) ** 2 +
            (npcPosition.y - user.position.y) ** 2
        );

        // Only consider users within flee range
        // Calculate flee direction away from this user
        const fleeDirection = {
          x: npcPosition.x - user.position.x,
          y: npcPosition.y - user.position.y,
        };

        // Normalize the flee direction
        const length = Math.sqrt(fleeDirection.x ** 2 + fleeDirection.y ** 2);
        if (length > 0) {
          fleeDirection.x /= length;
          fleeDirection.y /= length;

          // Weight inversely by distance (closer users have more influence)
          const weight = 1.0 / (distance * distance);

          totalFleeForce.x += fleeDirection.x * weight;
          totalFleeForce.y += fleeDirection.y * weight;
          totalWeight += weight;
        }
      });

      // If no flee forces, don't create a flee path
      if (totalWeight === 0) {
        return;
      }

      // Average the flee forces
      const averageFleeDirection = {
        x: totalFleeForce.x / totalWeight,
        y: totalFleeForce.y / totalWeight,
      };

      // Normalize the final direction
      const finalLength = Math.sqrt(
        averageFleeDirection.x ** 2 + averageFleeDirection.y ** 2
      );

      let finalFleeDirection: { x: number; y: number };
      if (finalLength > 0) {
        finalFleeDirection = {
          x: averageFleeDirection.x / finalLength,
          y: averageFleeDirection.y / finalLength,
        };
      } else {
        // Fallback to flee from primary user
        finalFleeDirection = normalizeDirection({
          x: npcPosition.x - myUser.position.x,
          y: npcPosition.y - myUser.position.y,
        });
      }

      // Add stability: if already fleeing, blend with current direction
      if (currentPathData && currentPathData.pathPhase === PathPhase.FLEEING) {
        const timeSinceLastUpdate = Date.now() - currentPathData.timestamp;
        const MIN_UPDATE_INTERVAL = 300; // Update more frequently but still stable

        // Only update if enough time has passed
        if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
          return;
        }

        // Blend current direction with new flee direction for stability
        const currentDir = currentPathData.direction;
        finalFleeDirection = normalizeDirection({
          x: currentDir.x * 0.4 + finalFleeDirection.x * 0.6,
          y: currentDir.y * 0.4 + finalFleeDirection.y * 0.6,
        });
      }

      const newPathData: pathData = currentPathData
        ? {
            ...currentPathData,
            startPosition: {
              x: npcPosition.x,
              y: npcPosition.y,
            },
            direction: finalFleeDirection,
            timestamp: Date.now(),
            pathPhase: PathPhase.FLEEING,
            velocity: 3.0, // Consistent flee speed
          }
        : {
            // create new path data
            id: uuidv4(),
            room: myUser.room,
            npcGroup: updatedNpcGroup,
            startPosition: {
              x: npcPosition.x,
              y: npcPosition.y,
            },
            pathDuration: 1500,
            timestamp: Date.now(),
            direction: finalFleeDirection,
            velocity: 3.0, // Consistent flee speed
            pathPhase: PathPhase.FLEEING,
          };

      // Socket call to create the flee path
      const currentTypedSocket = typedSocket();
      currentTypedSocket.emit("path-npc-group", { pathData: newPathData });

      setPaths((prev: Map<npcGroupId, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.set(npcGroup.id, newPathData);
        return newPaths as Map<npcGroupId, pathData>;
      });

      setNpcGroups((prev: NPCGroupsBiMap) => {
        const newNpcGroups = new NPCGroupsBiMap(prev);
        newNpcGroups.setByNpcGroupId(npcGroup.id, updatedNpcGroup);
        return newNpcGroups;
      });
    },
    [myUser, paths, setPaths, setNpcGroups, normalizeDirection, users]
  );

  // Function to check for collisions with NPCs
  const checkForNPCGroupCollision = useCallback(
    (npcGroup: NPCGroup, npcGroupPosition?: THREE.Vector3, isLocalUser: boolean = true) => {
      // Get the animal dimensions for dynamic thresholds
      const dimensions = animalDimensions[myUser.animal];
      const animalWidth = dimensions?.width || 2.0; // Fallback to 2.0 if dimensions not yet measured

      // Use animal width as base for thresholds
      const CAPTURE_THRESHOLD = animalWidth * 0.5; // Slightly larger than animal width for capture
      const FLEE_THRESHOLD = animalWidth * 5.0; // Much larger range for flee behavior

      const userPos = new THREE.Vector3(
        myUser.position.x,
        myUser.position.y,
        0
      );

      const npcPos = npcGroupPosition
        ? npcGroupPosition
        : new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0);

      const distance = npcPos.distanceTo(userPos);

      // Only trigger actions for IDLE NPCs
      if (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH) {
        if (distance < CAPTURE_THRESHOLD) {
          // Close enough to capture
          // Capturing NPC
          handleNPCGroupCollision(npcGroup, isLocalUser);
          return true;
        } else if (distance < FLEE_THRESHOLD) {
          // Far enough to not capture, but close enough to flee
          makeNPCGroupFlee(npcGroup, npcPos);
        }
      }
      return false
    },
    [handleNPCGroupCollision, makeNPCGroupFlee, animalDimensions, myUser.animal, myUser.position.x, myUser.position.y]
  );

  // Calculate current throw charge count with real-time updates
  const [currentThrowCount, setCurrentThrowCount] = useState(0);
  
  useEffect(() => {
    if (spaceStartTime === null) {
      setCurrentThrowCount(0);
      return;
    }
    
    const updateChargeCount = () => {
      const chargeDuration = Date.now() - spaceStartTime;
      const secondsHeld = Math.min(chargeDuration / 1000, 10); // Cap at 10 seconds
      const rawThrowCount = Math.floor(Math.pow(2, secondsHeld));
      
      // Cap at available NPCs in the captured group
      const availableNPCs = npcGroups.getByUserId(myUser.id)?.fileNames.length || 0;
      const cappedThrowCount = Math.min(rawThrowCount, availableNPCs);
      
      setCurrentThrowCount(cappedThrowCount);
    };
    
    // Update immediately
    updateChargeCount();
    
    // Continue updating while charging
    const interval = setInterval(updateChargeCount, 50); // Update every 50ms for smooth animation
    
    return () => clearInterval(interval);
  }, [spaceStartTime, npcGroups, myUser.id]);

  const setAnimalDimensionsCallback = useCallback(
    (animal: string, dimensions: { width: number; height: number }) => {
      if (!animalDimensions[animal]) {
        // Create a new object to ensure React detects the change
        setAnimalDimensions((prev) => ({
          ...prev,
          [animal]: dimensions,
        }));
      }
    },
    [animalDimensions]
  );

  // State for flash effect
  const [showFlash, setShowFlash] = useState(false);

  // Cinematic Screenshot Component
  function CinematicScreenshot() {
    const { gl, scene, camera } = useThree();
    const [isAnimating, setIsAnimating] = useState(false);
    
    useEffect(() => {
      const startCinematicSequence = (winnerUserId: string) => {
        if (!onScreenshotCapture || !winnerUserId || isAnimating) return;
        
        const winnerUser = users.get(winnerUserId);
        if (!winnerUser) return;
        
        setIsAnimating(true);
        setCinematicActive(true);
        setShowTimesUpText(true);
        
        // Calculate winner's NPC group size and animal type for zoom adjustment
        const winnerNpcGroup = npcGroups.getByUserId(winnerUserId);
        const npcCount = winnerNpcGroup?.fileNames?.length || 0;
        
        // Get winner's animal scale
        const winnerAnimal = winnerUser.animal?.toUpperCase() as keyof typeof ANIMAL_SCALES;
        const animalScale = ANIMAL_SCALES[winnerAnimal] || 1.0;
        
        // Calculate zoom based on animal size and NPC group size
        const currentCameraDistance = 30; // Normal camera distance
        const baseZoomIn = 0.2; // Zoom in much closer (smaller Z = closer)
        
        // Adjust zoom based on animal size (larger animals need to be further back)
        const animalSizeAdjustment = animalScale * 0.3;
        
        // Adjust zoom based on NPC count (more NPCs = need to be further back to fit all)
        const npcSizeAdjustment = Math.sqrt(npcCount) * 0.2;
        
        // Final zoom calculation: zoom in from current distance, then adjust for animal and NPC size
        const targetZoom = currentCameraDistance * (baseZoomIn + animalSizeAdjustment + npcSizeAdjustment);
        
        // Store original camera position
        const originalPosition = camera.position.clone();
        
        // Phase 1: Keep camera on current player but zoom to target Z
        const zTargetPosition = new THREE.Vector3(
          originalPosition.x, // Stay at current player's X position
          originalPosition.y, // Stay at current player's Y position
          targetZoom // Zoom to target Z level
        );
        
        // Phase 2: Move from current player to winner in XY plane
        const finalTargetPosition = new THREE.Vector3(
          winnerUser.position.x, // Move to winner's X position
          winnerUser.position.y, // Move to winner's Y position
          targetZoom // Keep the zoomed Z level
        );
        
        // Animation timing
        const phase1Duration = 1000; // 1 second for Z movement
        const phase2Duration = 500;  // 0.5 seconds for XY movement
        const totalDuration = phase1Duration + phase2Duration;
        const startTime = Date.now();
        
        // Hide "TIMES UP!" text 500ms before flash (at 1000ms)
        setTimeout(() => {
          setShowTimesUpText(false);
        }, 1000);
        
        const animateCamera = () => {
          const elapsed = Date.now() - startTime;
          const totalProgress = Math.min(elapsed / totalDuration, 1);
          
          if (elapsed < phase1Duration) {
            // Phase 1: Keep camera on current player, zoom to target Z
            const phase1Progress = elapsed / phase1Duration;
            const easedProgress = 1 - Math.pow(1 - phase1Progress, 3); // ease-out-cubic
            
            camera.position.lerpVectors(originalPosition, zTargetPosition, easedProgress);
          } else {
            // Phase 2: Move camera from current player to winner in XY plane
            const phase2Progress = (elapsed - phase1Duration) / phase2Duration;
            const easedProgress = 1 - Math.pow(1 - phase2Progress, 3); // ease-out-cubic
            
            camera.position.lerpVectors(zTargetPosition, finalTargetPosition, easedProgress);
          }
          camera.updateProjectionMatrix();
          
          if (totalProgress < 1) {
            requestAnimationFrame(animateCamera);
          } else {
            // Animation complete - trigger flash and screenshot
            triggerFlashAndScreenshot();
          }
        };
        
        const triggerFlashAndScreenshot = () => {
          // Show flash effect
          setShowFlash(true);
          
          // Take screenshot after flash starts
          setTimeout(() => {
            try {
              // Force a final render to ensure canvas is up to date
              gl.render(scene, camera);
              
              const canvas = gl.domElement;
              const screenshot = canvas.toDataURL('image/png', 0.9);
              onScreenshotCapture(screenshot);
            } catch (error) {
              console.error('Screenshot failed:', error);
            }
            
            // Hide flash and trigger game over
            setTimeout(() => {
              setShowFlash(false);
              setIsAnimating(false);
              setCinematicActive(false);
              setShowTimesUpText(false);
              if (onGameOver) {
                const storedFinalScores = (window as any).finalScores;
                onGameOver(storedFinalScores);
              }
            }, 200); // Flash duration
            
          }, 100); // Small delay for flash effect
        };
        
        // Start the animation
        requestAnimationFrame(animateCamera);
      };

      // Expose the function globally
      (window as any).captureGameScreenshot = startCinematicSequence;

      return () => {
        delete (window as any).captureGameScreenshot;
      };
    }, [gl, scene, camera, onScreenshotCapture, users, npcGroups, isAnimating, onGameOver]);

    return null; // This component doesn't render anything in the Canvas
  }

  // Component to set the canvas clear color to match the game background
  function BackgroundColorSetter() {
    const { gl } = useThree();
    
    useEffect(() => {
      // Set clear color to black to match the game's background
      gl.setClearColor(0x000000, 1.0); // Black background
    }, [gl]);
    
    return null;
  }

  // Note: times-up event is handled by GuestLogin component, which triggers the cinematic sequence

  return (
    <>
      <style>{`
        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 0.9; }
          100% { opacity: 0.3; }
        }
        @keyframes timesUpPulse {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
      `}</style>
      
      <Canvas
        style={{
          border: "1px solid white",
          width: "100%",
          height: "100%",
        }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <CameraController
          targetPosition={position}
          animalScale={ANIMAL_SCALES[myUser.animal]}
        />
        <BackgroundColorSetter />
        <CinematicScreenshot />
        <ambientLight intensity={Math.PI / 2} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.15}
          penumbra={1}
          decay={0}
          intensity={Math.PI}
        />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        {terrain.renderBackground()}
        {/* Render all users with their NPCs */}
        {Array.from(users.values()).map((user) => (
          <AnimalGraphic
            key={user.id}
            user={user}
            myUserId={myUser.id}
            setAnimalDimensions={setAnimalDimensionsCallback}
            animalDimensions={animalDimensions}
          />
        ))}

        {npcGroups.values()
          .map((npcGroup) => (
            <NPCGraphicWrapper
              key={npcGroup.id}
              npcGroup={npcGroup}
              checkForCollision={checkForNPCGroupCollision}
              pathData={paths.get(npcGroup.id)}
              users={users}
              allPaths={paths}
              npcGroups={npcGroups}
              myUserId={myUser.id}
              animalDimensions={animalDimensions}
              setPaths={setPaths}
              setNpcGroups={setNpcGroups}
              throwChargeCount={npcGroup.captorId === myUser.id ? currentThrowCount : undefined}
            />
          ))}
      </Canvas>

      {/* TIMES UP! Text */}
      {showTimesUpText && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '4rem',
          fontWeight: 'bold',
          color: '#FF0000',
          textShadow: '3px 3px 6px rgba(0,0,0,0.8)',
          zIndex: 1001,
          pointerEvents: 'none',
          animation: 'timesUpPulse 800ms ease-in-out infinite',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          TIMES UP!
        </div>
      )}
      
      {/* Flash Effect */}
      {showFlash && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          opacity: 0.8,
          zIndex: 1000,
          pointerEvents: 'none',
          animation: 'flash 200ms ease-out'
        }} />
      )}
    </>
  );
}
