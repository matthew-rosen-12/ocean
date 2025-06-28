"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCollisionService = void 0;
const types_1 = require("shared/types");
const animal_dimensions_1 = require("shared/animal-dimensions");
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
        // Calculate capture threshold to exactly match frontend logic
        // Frontend uses: animalWidth * 0.5, where animalWidth comes from animalDimensions
        const animalScale = types_1.ANIMAL_SCALES[botUser.animal] || 1.0;
        const animalDimensions = (0, animal_dimensions_1.getAnimalDimensions)(botUser.animal, animalScale);
        const CAPTURE_THRESHOLD = animalDimensions.width * 0.5;
        // Get paths to check for recently thrown NPCs (500ms cooldown like frontend)
        const paths = (0, paths_1.getpathsfromMemory)(roomName);
        // Process captures one by one, immediately updating memory to prevent duplicates
        for (const npcGroup of npcGroups.values()) {
            // Check if this NPC can be captured by this bot (match frontend logic)
            let canCapture = false;
            if (npcGroup.captorId === botUser.id) {
                // Bot's own NPCs can be captured, BUT not immediately after throwing (except returning NPCs)
                const pathData = paths === null || paths === void 0 ? void 0 : paths.get(npcGroup.id);
                const timeSinceThrow = pathData ? (Date.now() - pathData.timestamp) : 9999;
                const isReturning = pathData && pathData.pathDuration <= 500; // Return paths have 500ms duration
                if (!pathData || timeSinceThrow > 1000 || isReturning) {
                    canCapture = true;
                }
            }
            else if (!npcGroup.captorId && (npcGroup.phase === types_1.NPCPhase.IDLE || npcGroup.phase === types_1.NPCPhase.PATH)) {
                // Uncaptured NPCs can be captured if they're IDLE or PATH phase
                canCapture = true;
            }
            if (canCapture) {
                // Calculate actual NPC position (for moving NPCs on paths)
                let npcPosition = npcGroup.position;
                const pathData = paths === null || paths === void 0 ? void 0 : paths.get(npcGroup.id);
                if (pathData && npcGroup.phase === types_1.NPCPhase.PATH) {
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
    static handleBotNPCCollision(roomName, botUser, capturedNPCGroup) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return;
        // Double-check the NPC is still capturable (prevent race conditions)
        const currentNpcGroup = npcGroups.getByNpcGroupId(capturedNPCGroup.id);
        if (!currentNpcGroup) {
            return; // NPC doesn't exist
        }
        // // CRITICAL: If this NPC is already captured by this bot, don't re-capture it!
        if (currentNpcGroup.phase == types_1.NPCPhase.CAPTURED) {
            return;
        }
        // Delete any path associated with the captured NPC group
        const paths = (0, paths_1.getpathsfromMemory)(roomName);
        if (paths && paths.has(capturedNPCGroup.id)) {
            (0, paths_1.deletePathInMemory)(roomName, capturedNPCGroup.id);
            console.log("deleting path of captured group");
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
