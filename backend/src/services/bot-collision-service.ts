import { UserInfo, NPCGroup, NPCPhase, roomId, ANIMAL_SCALES } from "shared/types";
import { getAnimalDimensions } from "shared/animal-dimensions";
import { getNPCGroupsfromMemory, setNPCGroupsInMemory } from "../state/npc-groups";
import { deletePathInMemory, getpathsfromMemory } from "../state/paths";
import { getAllUsersInRoom } from "../state/users";
import { emitToRoom } from "../typed-socket";
import { v4 as uuidv4 } from "uuid";

interface BotCollisionDetectionProps {
  roomName: roomId;
  botUser: UserInfo;
}

/**
 * Server-side collision detection for bot users
 * Duplicates the logic from frontend useCollisionDetection.ts for bots only
 */
export class BotCollisionService {
  
  /**
   * Check for collisions between a bot user and NPC groups
   */
  static checkBotCollisions(roomName: roomId, botUser: UserInfo): boolean {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (!npcGroups) return false;

    let collisionDetected = false;

    // Calculate capture threshold to exactly match frontend logic
    // Frontend uses: animalWidth * 0.5, where animalWidth comes from animalDimensions
    const animalScale = ANIMAL_SCALES[botUser.animal as keyof typeof ANIMAL_SCALES] || 1.0;
    const animalDimensions = getAnimalDimensions(botUser.animal, animalScale);
    const CAPTURE_THRESHOLD = animalDimensions.width * 0.5;

    // Get paths to check for recently thrown NPCs (500ms cooldown like frontend)
    const paths = getpathsfromMemory(roomName);
    
    // Process captures one by one, immediately updating memory to prevent duplicates
    for (const npcGroup of npcGroups.values()) {
      // Check if this NPC can be captured by this bot (match frontend logic)
      let canCapture = false;
      
      if (npcGroup.captorId === botUser.id) {
        // Bot's own NPCs can be captured, BUT not immediately after throwing (except returning NPCs)
        const pathData = paths?.get(npcGroup.id);
        const timeSinceThrow = pathData ? (Date.now() - pathData.timestamp) : 9999;
        const isReturning = pathData && pathData.pathDuration <= 500; // Return paths have 500ms duration
        if (!pathData || timeSinceThrow > 1000 || isReturning) {
          canCapture = true;
        }
      } else if (!npcGroup.captorId && (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH)) {
        // Uncaptured NPCs can be captured if they're IDLE or PATH phase
        canCapture = true;
      }

      if (canCapture) {
        // Calculate actual NPC position (for moving NPCs on paths)
        let npcPosition = npcGroup.position;
        const pathData = paths?.get(npcGroup.id);
        if (pathData && npcGroup.phase === NPCPhase.PATH) {
          // Calculate current position along path with progress clamping
          const now = Date.now();
          const elapsedTime = (now - pathData.timestamp); // seconds
          const distance = pathData.velocity * elapsedTime;
          
          npcPosition = {
            x: pathData.startPosition.x + pathData.direction.x * distance,
            y: pathData.startPosition.y + pathData.direction.y * distance,
            z: 0
          };
        }
        
        const distance = this.calculateDistance(botUser.position, npcPosition);
        
        if (distance < CAPTURE_THRESHOLD) {
          this.handleBotNPCCollision(roomName, botUser, npcGroup);
          collisionDetected = true;
          break;
        }
      }
    }

    return collisionDetected;
  }

  /**
   * Handle collision between bot and NPC group (similar to handleNPCGroupCollision in frontend)
   */
  private static handleBotNPCCollision(roomName: roomId, botUser: UserInfo, capturedNPCGroup: NPCGroup): void {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (!npcGroups) return;

    // Double-check the NPC is still capturable (prevent race conditions)
    const currentNpcGroup = npcGroups.getByNpcGroupId(capturedNPCGroup.id);
    if (!currentNpcGroup) {
      return; // NPC doesn't exist
    }
    
    // // CRITICAL: If this NPC is already captured by this bot, don't re-capture it!
    if (currentNpcGroup.phase == NPCPhase.CAPTURED) {
      return;
    }

    // Delete any path associated with the captured NPC group
    const paths = getpathsfromMemory(roomName);
    if (paths && paths.has(capturedNPCGroup.id)) {
      deletePathInMemory(roomName, capturedNPCGroup.id);
      console.log("deleting path of captured group")
    }

    // Get bot's existing captured group (if any)
    let botNpcGroup = npcGroups.getByUserId(botUser.id);
    let existingFileNames: string[] = [];
    let groupId: string;

    // If bot already has a captured group, merge with it
    if (botNpcGroup) {
      existingFileNames = botNpcGroup.fileNames;
      groupId = botNpcGroup.id; // Keep the existing group ID
    } else {
      // First capture for this bot - create new ID
      groupId = uuidv4();
    }

    // Create new merged NPC group with existing NPCs + newly captured NPCs
    const updatedNpcGroup = new NPCGroup({
      id: groupId,
      fileNames: [...existingFileNames, ...currentNpcGroup.fileNames],
      position: botUser.position,
      phase: NPCPhase.CAPTURED,
      captorId: botUser.id,
      direction: { x: 0, y: 0 },
    });

    // Update NPC groups in memory
    npcGroups.deleteByNpcGroupId(capturedNPCGroup.id); // Remove captured group
    npcGroups.setByNpcGroupId(updatedNpcGroup.id, updatedNpcGroup); // Add merged group
    setNPCGroupsInMemory(roomName, npcGroups);

    // Broadcast changes to all clients in the room
    const emptyGroup = new NPCGroup({ ...capturedNPCGroup, fileNames: [] }); // Mark as deleted
    emitToRoom(roomName, "npc-group-update", { npcGroup: emptyGroup });
    emitToRoom(roomName, "npc-group-update", { npcGroup: updatedNpcGroup });
    
    // Delete path if it exists
    if (paths && paths.has(capturedNPCGroup.id)) {
      const pathData = paths.get(capturedNPCGroup.id);
      if (pathData) {
        emitToRoom(roomName, "path-deleted", { pathData });
      }
    }
  }

  /**
   * Calculate distance between two positions
   */
  private static calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}