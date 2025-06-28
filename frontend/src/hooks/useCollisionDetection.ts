import { useCallback } from "react";
import { NPCGroup, NPCPhase, UserInfo, NPCGroupsBiMap, npcGroupId, pathData, ANIMAL_ORIENTATION } from "shared/types";
import { checkRotatedBoundingBoxCollision } from "shared/animal-dimensions";
import * as THREE from "three";
import { v4 as uuidv4 } from "uuid";
import { typedSocket } from "../socket";

interface UseCollisionDetectionProps {
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

export function useCollisionDetection({
  myUser,
  npcGroups,
  paths,
  setPaths,
  setNpcGroups,
  animalDimensions,
}: UseCollisionDetectionProps) {
  
  const handleNPCGroupCollision = useCallback(
    (capturedNPCGroup: NPCGroup, localUser: boolean) => {
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

      let userNpcGroup = npcGroups.getByUserId(myUser.id);
      let existingFileNames: string[] = [];
      let groupId: string;
      
      // If user already has a captured group, merge with it
      if (userNpcGroup) {
        existingFileNames = userNpcGroup.fileNames;
        groupId = userNpcGroup.id; // Keep the existing group ID
      } else {
        // First capture for this user - create new ID
        groupId = uuidv4();
      }

      // 2. create new merged npc group with existing NPCs + newly captured NPC
      const updatedNpcGroup = new NPCGroup({
        id: groupId, // Use existing ID or new ID for first capture
        fileNames: [...existingFileNames, ...capturedNPCGroup.fileNames],
        position: myUser.position,
        phase: NPCPhase.CAPTURED,
        captorId: myUser.id, // Set the captorId
        direction: { x: 0, y: 0 },
      });

      setNpcGroups((prev) => {
        const newNpcGroups = new NPCGroupsBiMap(prev);
        
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
    [paths, setPaths, npcGroups, myUser.id, myUser.position, setNpcGroups]
  );

  // Function to check for collisions with NPCs
  const checkForNPCGroupCollision = useCallback(
    (npcGroup: NPCGroup, npcGroupPosition?: THREE.Vector3, isLocalUser: boolean = true) => {
      // Get the animal dimensions for dynamic thresholds
      const dimensions = animalDimensions[myUser.animal];
      if (!dimensions) {
        // Fallback to simple distance-based collision if dimensions not available
        const animalWidth = 2.0;
        const CAPTURE_THRESHOLD = animalWidth * 0.5;
        
        const userPos = new THREE.Vector3(myUser.position.x, myUser.position.y, 0);
        const npcPos = npcGroupPosition || new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, 0);
        const distance = npcPos.distanceTo(userPos);
        
        const canCapture = 
          (npcGroup.captorId === myUser.id && (!paths.get(npcGroup.id) || Date.now() - paths.get(npcGroup.id)!.timestamp > 500)) ||
          (!npcGroup.captorId && (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH));
        
        if (canCapture && distance < CAPTURE_THRESHOLD) {
          handleNPCGroupCollision(npcGroup, isLocalUser);
          return true;
        }
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

      // Use rotated bounding box collision detection
      const collided = checkRotatedBoundingBoxCollision(
        userPos,
        npcPos,
        dimensions.width,
        dimensions.height,
        adjustedUserRotation,
        dimensions.width, // NPC uses same dimensions for now
        dimensions.height,
        adjustedNpcRotation
      );

      // Check if this NPC can be captured by this user
      const canCapture = 
        // User's own NPCs can be captured, BUT not immediately after throwing
        (npcGroup.captorId === myUser.id && (!paths.get(npcGroup.id) || Date.now() - paths.get(npcGroup.id)!.timestamp > 500)) ||
        // Uncaptured NPCs can be captured if they're IDLE or PATH phase
        (!npcGroup.captorId && (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH));

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