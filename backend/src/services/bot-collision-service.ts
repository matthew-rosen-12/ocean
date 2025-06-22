import { UserInfo, NPCGroup, NPCPhase, ANIMAL_SCALES, Animal, roomId, userId } from "shared/types";
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

    // Get animal scale for dynamic threshold (similar to frontend animalDimensions)
    const animalScale = ANIMAL_SCALES[botUser.animal as keyof typeof ANIMAL_SCALES] || 1.0;
    const CAPTURE_THRESHOLD = animalScale * 0.5; // Same logic as frontend

    // Process captures one by one, immediately updating memory to prevent duplicates
    for (const npcGroup of npcGroups.values()) {
      // Only check IDLE and PATH NPCs, and exclude NPCs already captured by this bot
      if ((npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH) && 
          npcGroup.captorId !== botUser.id) {
        const distance = this.calculateDistance(botUser.position, npcGroup.position);
        
        if (distance < CAPTURE_THRESHOLD) {
          // Process capture immediately and refresh npcGroups from memory
          this.handleBotNPCCollision(roomName, botUser, npcGroup);
          collisionDetected = true;
          // Break after first capture to prevent processing stale data
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
    if (!currentNpcGroup || (currentNpcGroup.phase !== NPCPhase.IDLE && currentNpcGroup.phase !== NPCPhase.PATH)) {
      return; // NPC was already captured or doesn't exist
    }

    // Delete any path associated with the captured NPC group
    const paths = getpathsfromMemory(roomName);
    if (paths && paths.has(capturedNPCGroup.id)) {
      deletePathInMemory(roomName, capturedNPCGroup.id);
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