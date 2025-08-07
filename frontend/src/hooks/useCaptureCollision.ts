import { useCallback } from "react";
import { NPCGroup, NPCPhase, PathPhase, UserInfo, NPCGroupsBiMap, npcGroupId, pathData, ANIMAL_ORIENTATION } from "shared/types";
import { createInteraction } from "shared/interaction-prompts";
import { checkRotatedBoundingBoxCollision } from "shared/animal-dimensions";
import * as THREE from "three";
import { typedSocket } from "../socket";

interface UseCaptureCollisionProps {
  myUser: UserInfo;
  npcGroups: NPCGroupsBiMap;
  paths: Map<npcGroupId, pathData>;
  setPaths: (
    value: Map<npcGroupId, pathData> | ((prev: Map<npcGroupId, pathData>) => Map<npcGroupId, pathData>)
  ) => void;
  setNpcGroups: (
    value: NPCGroupsBiMap | ((prev: NPCGroupsBiMap) => NPCGroupsBiMap)
  ) => void;
  animalDimensions: { [animal: string]: { width: number; height: number } };
}

export function useCaptureCollision({
  myUser,
  npcGroups,
  paths,
  setPaths,
  setNpcGroups,
  animalDimensions,
}: UseCaptureCollisionProps) {
  
  const handleNPCGroupCollision = useCallback(
    (capturedNPCGroup: NPCGroup, localUser: boolean) => {
      
      // Send interaction to backend for local user (only for idle NPCs, thrown/returning handled server-side)
      if (localUser && !capturedNPCGroup.captorId) {
        // Captured NPC group without captor (idle/fleeing NPC)
        const interaction = createInteraction.captured(capturedNPCGroup.faceFileName!, myUser.animal);
        const currentTypedSocket = typedSocket();
        if (currentTypedSocket) {
          currentTypedSocket.emit("interaction-detected", { interaction });
        }
      }

      // If this NPC is currently on a path, remove the path
      if (localUser && paths.get(capturedNPCGroup.id)) {
        const currentTypedSocket = typedSocket();
        currentTypedSocket.emit("delete-path", { pathData: paths.get(capturedNPCGroup.id)! });
      }
      setPaths((prev: Map<npcGroupId, pathData>) => {
        const newPaths = new Map(prev);
        newPaths.delete(capturedNPCGroup.id); // remove the path data for the captured NPC
        return newPaths as Map<npcGroupId, pathData>;
      });

      // ATOMIC MERGE: Perform state read and merge in one operation to prevent race conditions
      setNpcGroups((prev) => {
        const newNpcGroups = new NPCGroupsBiMap(prev);
        
        // Read current user group from the latest state (not stale closure)
        const currentUserNpcGroup = newNpcGroups.getByUserId(myUser.id);
        
        let groupId: string;
        let existingFileNames: string[];
        
        // If user already has a captured group, merge with it
        if (currentUserNpcGroup) {
          groupId = currentUserNpcGroup.id; // Keep the existing group ID
          existingFileNames = currentUserNpcGroup.fileNames;
        } else {
          // First capture for this user - generate ID deterministically based only on user ID
          // This ensures React strict mode always generates the same ID
          groupId = `capture-${myUser.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
          existingFileNames = [];
        }
        
        // Create merged npc group with existing NPCs + newly captured NPC
        const updatedNpcGroup = new NPCGroup({
          id: groupId,
          fileNames: [...existingFileNames, ...capturedNPCGroup.fileNames],
          position: myUser.position,
          phase: NPCPhase.CAPTURED,
          captorId: myUser.id,
          direction: { x: 0, y: 0 },
        });
        
        // Remove the original captured NPC group
        newNpcGroups.deleteByNpcGroupId(capturedNPCGroup.id);
        // Add the updated merged group
        newNpcGroups.setByNpcGroupId(updatedNpcGroup.id, updatedNpcGroup);

        // Emit socket events after state update
        if (localUser) {
          const currentTypedSocket = typedSocket();
          // Delete the captured NPC group and add the updated merged group
          currentTypedSocket.emit("update-npc-group", { npcGroup: new NPCGroup({ ...capturedNPCGroup, fileNames: [] }) }); // Mark as deleted
          currentTypedSocket.emit("update-npc-group", { npcGroup: updatedNpcGroup });
        }

        return newNpcGroups;
      });
    },
    [myUser.id, myUser.position, myUser.animal, paths, setPaths, setNpcGroups]
  );

  // Function to check for collisions with NPCs
  const checkForNPCGroupCollision = useCallback(
    (npcGroup: NPCGroup, npcGroupPosition?: THREE.Vector3, isLocalUser: boolean = true) => {
      // Get the animal dimensions for dynamic thresholds
      const dimensions = animalDimensions[myUser.animal];
      if (!dimensions) {
        // Animal dimensions not loaded yet, skip collision check
        return false;
      }

      // Calculate rotations for both objects
      const userRotation = Math.atan2(myUser.direction.y, myUser.direction.x);
      const npcRotation = Math.atan2(npcGroup.direction.y, npcGroup.direction.x);
      
      // Apply animal orientation adjustments
      const userOrientation = ANIMAL_ORIENTATION[myUser.animal] || { rotation: 0, flipY: false };
      const npcOrientation = ANIMAL_ORIENTATION[npcGroup.fileNames[0] as keyof typeof ANIMAL_ORIENTATION] || { rotation: 0, flipY: false };
      
      const adjustedUserRotation = userRotation + userOrientation.rotation;
      const adjustedNpcRotation = npcRotation + npcOrientation.rotation;

      // Get NPC position
      const npcPos = npcGroupPosition || { x: npcGroup.position.x, y: npcGroup.position.y };
      const userPos = { x: myUser.position.x, y: myUser.position.y };

      // Use rotated bounding box collision detection with reduced capture dimensions
      const captureWidth = dimensions.width * 0.6; // Much smaller capture width
      const captureHeight = dimensions.height * 0.6; // Much smaller capture height
      const collided = checkRotatedBoundingBoxCollision(
        userPos,
        npcPos,
        captureWidth,
        captureHeight,
        adjustedUserRotation,
        captureWidth, // NPC uses same reduced dimensions
        captureHeight,
        adjustedNpcRotation
      );

      // Check if this NPC can be captured by this user
      const canCapture = 
        // User's own NPCs can be captured, BUT not immediately after throwing
        (npcGroup.captorId === myUser.id && (() => {
          const pathData = paths.get(npcGroup.id);
          if (!pathData) {
            // No path data - can capture
            return true;
          } else if (pathData.pathPhase === PathPhase.RETURNING) {
            // Returning NPCs can always be captured
            return true;
          } else if (pathData.pathPhase === PathPhase.THROWN && (Date.now() - pathData.timestamp > 1000)) {
            // Thrown NPCs can be captured after 1000ms cooldown
            return true;
          }
          return false;
        })()) ||
        // Uncaptured NPCs can be captured if they're IDLE or PATH phase (includes emitted/fleeing NPCs)
        // But add small delay for recently emitted NPCs to prevent immediate recapture race condition
        (!npcGroup.captorId && (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH) && (() => {
          const pathData = paths.get(npcGroup.id);
          if (pathData && pathData.pathPhase === PathPhase.FLEEING) {
            // Allow capture of fleeing NPCs after 100ms to prevent race condition
            return (Date.now() - pathData.timestamp) > 100;
          }
          return true; // IDLE or other PATH phase NPCs can be captured immediately
        })());

      if (canCapture && collided) {
        // Close enough to capture
        handleNPCGroupCollision(npcGroup, isLocalUser);
        return true;
      }
      return false;
    },
    [animalDimensions, myUser.animal, myUser.position.x, myUser.position.y, myUser.direction.x, myUser.direction.y, myUser.id, paths, handleNPCGroupCollision]
  );

  return {
    checkForNPCGroupCollision,
    handleNPCGroupCollision,
  };
}