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
import { useEffect, useState, useCallback } from "react";
import AnimalGraphic from "./AnimalGraphic";
import { UI_Z_INDICES } from "shared/z-depths";
import NPCGraphicWrapper from "./npc-graphics/NPCGroupGraphicWrapper";
import * as THREE from "three";
import { CameraController } from "./CameraController";
import { usePositionBroadcast } from "../hooks/usePositionBroadcast";
import { useCollisionDetection } from "../hooks/useCollisionDetection";
import { useKeyboardMovement } from "../hooks/useKeyboardMovement";
import { CinematicScreenshot } from "./CinematicScreenshot";
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
    
    const updateChargeCount = () => {
      const chargeDuration = Date.now() - spaceStartTime;
      const secondsHeld = Math.min(chargeDuration / 1000 * 4, 10); // Cap at 10 seconds
      const rawThrowCount = Math.floor(Math.pow(2, secondsHeld)) + 1;
      
      // Cap at available NPCs in the captured group
      const availableNPCs = npcGroups.getByUserId(myUser.id)?.fileNames.length || 0;
      const cappedThrowCount = Math.min(rawThrowCount, availableNPCs);
      
      setCurrentThrowCount(cappedThrowCount);
    };
    
    // Update immediately
    updateChargeCount();
    
    // Continue updating while charging
    const interval = setInterval(updateChargeCount, 100); // Update every 100ms (was 50ms)
    
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
