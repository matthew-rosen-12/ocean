// nature_v_npc/app/components/Scene.tsx
"use client";
import { Canvas, useThree } from "@react-three/fiber";
import {
  npcGroupId,
  pathData,
  userId,
  UserInfo,
  NPCGroupsBiMap,
  FinalScores,
  ANIMAL_SCALES,
} from "shared/types";
import { NPCInteraction } from "shared/interaction-types";
import React, { useEffect, useState, useCallback } from "react";
import AnimalGraphic from "./AnimalGraphic";
import { UI_Z_INDICES } from "shared/z-depths";
import NPCGraphicWrapper from "./npc-graphics/NPCGroupGraphicWrapper";
import * as THREE from "three";
import { CameraController } from "./CameraController";
import { usePositionBroadcast } from "../hooks/usePositionBroadcast";
import { useCollisionDetection } from "../hooks/useCollisionDetection";
import { useKeyboardMovement } from "../hooks/useKeyboardMovement";
import { useVisibilityControl } from "../hooks/useVisibilityControl";
import { CinematicScreenshot } from "./CinematicScreenshot";
import { TerrainConfig } from "../utils/terrain";
import BotCollisionManager from "./BotCollisionManager";
import { AnimationManagerProvider } from "../contexts/AnimationManagerContext";
import { KeyboardMovementManager } from "./KeyboardMovementManager";
import { FrameRateManager } from "./FrameRateManager";
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
  deletingNPCs: Set<string>;
  onInactivityKick?: () => void;
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
  deletingNPCs,
  onInactivityKick,
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

  const { 
    position, 
    direction, 
    spaceStartTime, 
    keysPressed,
    setPosition,
    setDirection,
    setSpaceStartTime
  } = useKeyboardMovement(
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

  // Use collision detection hook
  const { checkForNPCGroupCollision } = useCollisionDetection({
    myUser,
    npcGroups,
    paths,
    setPaths,
    setNpcGroups,
    animalDimensions,
  });

  // Use position broadcast hook
  usePositionBroadcast({
    position,
    direction,
    myUser,
    users,
  });

  // Prevent game from pausing when tab is hidden
  useVisibilityControl(onInactivityKick);



  // Expose NPC groups for debugging in browser developer tools (throttled for performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      const debugObject = {
        npcGroups: npcGroups,
        // all npc group id and their captor id
        getAllIdsAndCaptorIds: () => Array.from(npcGroups.keys()).map(id => ({ 
          id: id.slice(0, 8), 
          captorId: npcGroups.getByNpcGroupId(id)?.captorId?.slice(0, 8) 
        })),
        getAllIds: () => Array.from(npcGroups.keys()),
        getByUserId: (userId: string) => npcGroups.getByUserId(userId),
        getByNpcGroupId: (npcGroupId: string) => npcGroups.getByNpcGroupId(npcGroupId),
        getAllNPCGroups: () => Array.from(npcGroups.values()),
        paths: paths,
        getAllPathIds: () => Array.from(paths.keys()),
        myUserId: myUser.id,
        users: users,
      };
      
      // Type assertion to avoid TypeScript warnings
      (window as typeof window & { debugNPCGroups: typeof debugObject }).debugNPCGroups = debugObject;
    }, 100); // Throttle to every 100ms
    
    return () => clearTimeout(timer);
  }, [npcGroups, paths, myUser.id, users]);


  // Calculate current throw charge count with real-time updates
  const [currentThrowCount, setCurrentThrowCount] = useState(0);
  
  useEffect(() => {
    if (spaceStartTime === null) {
      setCurrentThrowCount(0);
      return;
    }
    
    let lastUpdateTime = 0;
    const throttleDelay = 150; // Increased from 100ms to 150ms for better batching
    
    const updateChargeCount = () => {
      const now = Date.now();
      
      // Throttle updates to reduce unnecessary renders
      if (now - lastUpdateTime < throttleDelay) {
        return;
      }
      lastUpdateTime = now;
      
      const chargeDuration = now - spaceStartTime;
      const secondsHeld = Math.min(chargeDuration / 1000 * 4, 10); // Cap at 10 seconds
      const rawThrowCount = Math.floor(Math.pow(2, secondsHeld));
      
      // Cap at available NPCs in the captured group
      const availableNPCs = npcGroups.getByUserId(myUser.id)?.fileNames.length || 0;
      const cappedThrowCount = Math.min(rawThrowCount, availableNPCs);
      
      // Use React.startTransition for non-urgent UI updates
      React.startTransition(() => {
        setCurrentThrowCount(cappedThrowCount);
      });
    };
    
    // Update immediately
    updateChargeCount();
    
    // Continue updating while charging with requestAnimationFrame for better performance
    let animationId: number;
    const scheduleUpdate = () => {
      updateChargeCount();
      animationId = requestAnimationFrame(scheduleUpdate);
    };
    animationId = requestAnimationFrame(scheduleUpdate);
    
    return () => cancelAnimationFrame(animationId);
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


  // Component to set the canvas clear color to match the game background
  function BackgroundColorSetter() {
    const { gl } = useThree();
    
    useEffect(() => {
      // Set clear color to match CloudBackground blue to prevent flashing
      gl.setClearColor(0x2F5F8F, 1.0); // Dark blue background matching CloudBackground
      
      
    }, [gl]);
    
    return null;
  }

  // Note: times-up event is handled by GuestLogin component, which triggers the cinematic sequence

  return (
    <>
      <style>{`
        @keyframes flash {
          0% { opacity: 0; }
          30% { opacity: 0.9; }
          100% { opacity: 0.2; }
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
        dpr={[1, 1.5]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <AnimationManagerProvider>
          <CameraController
            targetPosition={position}
            animalScale={ANIMAL_SCALES[myUser.animal]}
          />
          <BackgroundColorSetter />
          <CinematicScreenshot
            users={users}
            npcGroups={npcGroups}
            onScreenshotCapture={onScreenshotCapture}
            onGameOver={onGameOver}
            setCinematicActive={setCinematicActive}
            setShowTimesUpText={setShowTimesUpText}
            setShowFlash={setShowFlash}
          />
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
                deletingNPCs={deletingNPCs}
              />
            ))}

          {/* Bot collision detection manager */}
          <BotCollisionManager
            myUser={myUser}
            users={users}
            npcGroups={npcGroups}
            allPaths={paths}
            setPaths={setPaths}
            setNpcGroups={setNpcGroups}
            animalDimensions={animalDimensions}
          />
          
          {/* Keyboard movement manager */}
          <KeyboardMovementManager
            position={position}
            direction={direction}
            setPosition={setPosition}
            setDirection={setDirection}
            keysPressed={keysPressed}
            spaceStartTime={spaceStartTime}
            setSpaceStartTime={setSpaceStartTime}
            myUser={myUser}
            npcGroups={npcGroups}
            paths={paths}
            setPaths={setPaths}
            setNpcGroups={setNpcGroups}
            terrain={terrain}
            animalDimensions={animalDimensions}
            checkBoundaryCollision={checkBoundaryCollision}
            inputDisabled={cinematicActive}
          />

          {/* Frame rate monitoring for inactivity detection */}
          <FrameRateManager onInactivityKick={onInactivityKick} />
        </AnimationManagerProvider>
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
          zIndex: UI_Z_INDICES.TIMES_UP_TEXT,
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
          zIndex: UI_Z_INDICES.FLASH_EFFECT,
          pointerEvents: 'none',
          animation: 'flash 200ms ease-out'
        }} />
      )}
    </>
  );
}
