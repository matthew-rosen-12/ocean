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
                if (!pathData) {
                    // No path data - can capture
                    canCapture = true;
                }
                else if (pathData.pathPhase === types_1.PathPhase.RETURNING) {
                    // Returning NPCs can always be captured
                    canCapture = true;
                }
                else if (pathData.pathPhase === types_1.PathPhase.THROWN && timeSinceThrow > 1000) {
                    // Thrown NPCs can be captured after 1000ms cooldown
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
                    // Use the proper path position calculation that handles completed paths
                    const calculatedPosition = this.calculatePathPosition(pathData, Date.now());
                    npcPosition = calculatedPosition;
                }
                // Use rotated bounding box collision detection
                const userRotation = Math.atan2(botUser.direction.y, botUser.direction.x);
                const npcRotation = Math.atan2(npcGroup.direction.y, npcGroup.direction.x);
                // Apply animal orientation adjustments
                const userOrientation = types_1.ANIMAL_ORIENTATION[botUser.animal] || { rotation: 0, flipY: false };
                const npcOrientation = types_1.ANIMAL_ORIENTATION[npcGroup.fileNames[0]] || { rotation: 0, flipY: false };
                const adjustedUserRotation = userRotation + userOrientation.rotation;
                const adjustedNpcRotation = npcRotation + npcOrientation.rotation;
                // Use rotated bounding box collision detection with reduced capture dimensions
                const captureWidth = animalDimensions.width * 0.6; // Much smaller capture width
                const captureHeight = animalDimensions.height * 0.6; // Much smaller capture height
                const boundingBoxCollided = (0, animal_dimensions_1.checkRotatedBoundingBoxCollision)({ x: botUser.position.x, y: botUser.position.y }, { x: npcPosition.x, y: npcPosition.y }, captureWidth, captureHeight, adjustedUserRotation, captureWidth, // NPC uses same reduced dimensions
                captureHeight, adjustedNpcRotation);
                // Also check simple distance to center for more reliable capture
                const centerDistance = Math.sqrt(Math.pow(botUser.position.x - npcPosition.x, 2) +
                    Math.pow(botUser.position.y - npcPosition.y, 2));
                const smallCaptureRadius = Math.min(captureWidth, captureHeight) * 0.5; // Small radius for center capture
                const centerCollided = centerDistance <= smallCaptureRadius;
                const collided = boundingBoxCollided || centerCollided;
                if (collided) {
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
     * Calculate the current position of an NPC along its path
     * Mirrors the logic from npc-group-service.ts
     */
    static calculatePathPosition(pathData, currentTime) {
        // Calculate elapsed time in seconds
        const elapsedTime = (currentTime - pathData.timestamp) / 1000;
        const pathDurationSec = pathData.pathDuration / 1000;
        const progress = Math.min(elapsedTime / pathDurationSec, 1);
        let position;
        // If we've reached the end of the path, use exact same calculation as server
        if (progress >= 1) {
            const finalDistance = pathData.velocity * pathDurationSec;
            position = {
                x: pathData.startPosition.x + pathData.direction.x * finalDistance,
                y: pathData.startPosition.y + pathData.direction.y * finalDistance,
                z: 0,
            };
        }
        else {
            // For animation, calculate intermediate position
            const distance = pathData.velocity * elapsedTime;
            position = {
                x: pathData.startPosition.x + pathData.direction.x * distance,
                y: pathData.startPosition.y + pathData.direction.y * distance,
                z: 0,
            };
        }
        return position;
    }
}
exports.BotCollisionService = BotCollisionService;
