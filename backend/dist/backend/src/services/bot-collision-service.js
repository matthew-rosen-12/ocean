"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCollisionService = void 0;
const types_1 = require("shared/types");
const npc_groups_1 = require("../state/npc-groups");
const paths_1 = require("../state/paths");
const typed_socket_1 = require("../typed-socket");
const uuid_1 = require("uuid");
/**
 * Server-side collision detection for bot users
 * Duplicates the logic from frontend useCollisionDetection.ts for bots only
 */
class BotCollisionService {
    /**
     * Check for collisions between a bot user and NPC groups
     */
    static checkBotCollisions(roomName, botUser) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return false;
        let collisionDetected = false;
        // Get animal scale for dynamic threshold (similar to frontend animalDimensions)
        const animalScale = types_1.ANIMAL_SCALES[botUser.animal] || 1.0;
        const CAPTURE_THRESHOLD = animalScale * 0.5; // Same logic as frontend
        // Process captures one by one, immediately updating memory to prevent duplicates
        for (const npcGroup of npcGroups.values()) {
            // Only check IDLE and PATH NPCs, and exclude NPCs already captured by this bot
            if ((npcGroup.phase === types_1.NPCPhase.IDLE || npcGroup.phase === types_1.NPCPhase.PATH) &&
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
    static handleBotNPCCollision(roomName, botUser, capturedNPCGroup) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return;
        // Double-check the NPC is still capturable (prevent race conditions)
        const currentNpcGroup = npcGroups.getByNpcGroupId(capturedNPCGroup.id);
        if (!currentNpcGroup || (currentNpcGroup.phase !== types_1.NPCPhase.IDLE && currentNpcGroup.phase !== types_1.NPCPhase.PATH)) {
            return; // NPC was already captured or doesn't exist
        }
        // Delete any path associated with the captured NPC group
        const paths = (0, paths_1.getpathsfromMemory)(roomName);
        if (paths && paths.has(capturedNPCGroup.id)) {
            (0, paths_1.deletePathInMemory)(roomName, capturedNPCGroup.id);
        }
        // Get bot's existing captured group (if any)
        let botNpcGroup = npcGroups.getByUserId(botUser.id);
        let existingFileNames = [];
        let groupId;
        // If bot already has a captured group, merge with it
        if (botNpcGroup) {
            existingFileNames = botNpcGroup.fileNames;
            groupId = botNpcGroup.id; // Keep the existing group ID
        }
        else {
            // First capture for this bot - create new ID
            groupId = (0, uuid_1.v4)();
        }
        // Create new merged NPC group with existing NPCs + newly captured NPCs
        const updatedNpcGroup = new types_1.NPCGroup({
            id: groupId,
            fileNames: [...existingFileNames, ...currentNpcGroup.fileNames],
            position: botUser.position,
            phase: types_1.NPCPhase.CAPTURED,
            captorId: botUser.id,
            direction: { x: 0, y: 0 },
        });
        // Update NPC groups in memory
        npcGroups.deleteByNpcGroupId(capturedNPCGroup.id); // Remove captured group
        npcGroups.setByNpcGroupId(updatedNpcGroup.id, updatedNpcGroup); // Add merged group
        (0, npc_groups_1.setNPCGroupsInMemory)(roomName, npcGroups);
        // Broadcast changes to all clients in the room
        const emptyGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, capturedNPCGroup), { fileNames: [] })); // Mark as deleted
        (0, typed_socket_1.emitToRoom)(roomName, "npc-group-update", { npcGroup: emptyGroup });
        (0, typed_socket_1.emitToRoom)(roomName, "npc-group-update", { npcGroup: updatedNpcGroup });
        // Delete path if it exists
        if (paths && paths.has(capturedNPCGroup.id)) {
            const pathData = paths.get(capturedNPCGroup.id);
            if (pathData) {
                (0, typed_socket_1.emitToRoom)(roomName, "path-deleted", { pathData });
            }
        }
    }
    /**
     * Calculate distance between two positions
     */
    static calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
exports.BotCollisionService = BotCollisionService;
