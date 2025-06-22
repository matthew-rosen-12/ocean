"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCollisionService = void 0;
const types_1 = require("shared/types");
const npc_groups_1 = require("../state/npc-groups");
const paths_1 = require("../state/paths");
const uuid_1 = require("uuid");
const server_1 = require("../server");
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
        // Check collisions with all NPC groups
        for (const npcGroup of npcGroups.values()) {
            // Only check IDLE and PATH NPCs (same as frontend logic)
            if (npcGroup.phase === types_1.NPCPhase.IDLE || npcGroup.phase === types_1.NPCPhase.PATH) {
                const distance = this.calculateDistance(botUser.position, npcGroup.position);
                if (distance < CAPTURE_THRESHOLD) {
                    this.handleBotNPCCollision(roomName, botUser, npcGroup);
                    collisionDetected = true;
                }
            }
        }
        return collisionDetected;
    }
    /**
     * Handle collision between bot and NPC group (similar to handleNPCGroupCollision in frontend)
     */
    static handleBotNPCCollision(roomName, botUser, capturedNPCGroup) {
        // Delete any path associated with the captured NPC group
        const paths = (0, paths_1.getpathsfromMemory)(roomName);
        if (paths && paths.has(capturedNPCGroup.id)) {
            (0, paths_1.deletePathInMemory)(roomName, capturedNPCGroup.id);
        }
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return;
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
            fileNames: [...existingFileNames, ...capturedNPCGroup.fileNames],
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
        server_1.io.to(roomName).emit("update-npc-group", { npcGroup: emptyGroup });
        server_1.io.to(roomName).emit("update-npc-group", { npcGroup: updatedNpcGroup });
        // Delete path if it exists
        if (paths && paths.has(capturedNPCGroup.id)) {
            server_1.io.to(roomName).emit("delete-path", { pathData: paths.get(capturedNPCGroup.id) });
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
