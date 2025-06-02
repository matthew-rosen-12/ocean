"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNPCInRoom = updateNPCInRoom;
exports.updateNPCGroupInRoom = updateNPCGroupInRoom;
exports.removeNPCFromGroupInRoom = removeNPCFromGroupInRoom;
exports.setPathCompleteInRoom = setPathCompleteInRoom;
exports.createNPCs = createNPCs;
exports.checkAndHandleNPCCollisions = checkAndHandleNPCCollisions;
const types_1 = require("../types");
const user_info_1 = require("../user-info");
const uuid_1 = require("uuid");
// Redis Key prefixes for different data types
const NUM_NPCS = 4;
const server_1 = require("../server");
const config_1 = require("../db/config");
const npc_ops_1 = require("../db/npc-ops");
const serializers_1 = require("../utils/serializers");
const terrain_1 = require("../utils/terrain");
function updateNPCInRoom(roomName, npc) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, npc_ops_1.updateNPCInRoomInMemory)(roomName, npc);
        server_1.io.to(roomName).emit("npc-update", (0, serializers_1.serialize)({ npc }));
    });
}
function updateNPCGroupInRoom(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, npc_ops_1.updateNPCGroupInRoomInMemory)(roomName, captorId, npcId);
        server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({ groupId: captorId, npcId }));
    });
}
function removeNPCFromGroupInRoom(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, config_1.removeNPCFromGroupInRoomInMemory)(roomName, captorId, npcId);
        server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({
            groupId: captorId,
            npcId,
            removed: true,
        }));
    });
}
function setPathCompleteInRoom(room, npc) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get room-specific terrain configuration
            const terrainConfig = (0, terrain_1.generateRoomTerrain)(room);
            // Get the path data for this NPC
            const paths = yield (0, config_1.getActivepathsfromMemory)(room);
            const pathDataForNPC = paths.find((p) => p.npc.id === npc.id);
            if (!pathDataForNPC) {
                console.log(`No path data found for NPC ${npc.id} in room ${room}`);
                return;
            }
            console.log(`Setting path complete for NPC ${npc.id} in room ${room}`);
            // Calculate landing position with wrap-around and collision avoidance
            const landingPosition = yield calculateLandingPositionWithCollisionAvoidance(pathDataForNPC, terrainConfig, room, npc.id);
            const updatedNPC = Object.assign(Object.assign({}, npc), { position: landingPosition, phase: types_1.NPCPhase.IDLE });
            yield (0, npc_ops_1.updateNPCInRoomInMemory)(room, updatedNPC);
            // Remove this path from active paths
            const updatedPaths = paths.filter((p) => p.npc.id !== npc.id);
            yield (0, config_1.setPathsInMemory)(room, updatedPaths);
            // Only broadcast for thrown NPCs (ones with captorId)
            if (pathDataForNPC.captorId) {
                server_1.io.to(room).emit("path-complete", (0, serializers_1.serialize)({
                    npc: updatedNPC,
                }));
            }
            console.log(`Path completed for NPC ${npc.id}. Landing position:`, landingPosition);
        }
        catch (error) {
            console.error(`Error setting path complete for NPC ${npc.id} in room ${room}:`, error);
        }
    });
}
function calculateLandingPositionWithCollisionAvoidance(pathData, terrainConfig, room, movingNpcId) {
    return __awaiter(this, void 0, void 0, function* () {
        const COLLISION_RADIUS = 2.0; // Distance to check for collisions
        const EXTENSION_DISTANCE = 2.5; // How much to extend the path if collision detected
        const MAX_EXTENSIONS = 5; // Maximum number of extensions to prevent infinite loops
        let currentPathData = Object.assign({}, pathData);
        let extensionCount = 0;
        while (extensionCount < MAX_EXTENSIONS) {
            // Calculate landing position without wrapping
            const landingPosition = calculateLandingPosition(currentPathData);
            // Get all NPCs in the room to check for collisions
            const allNPCs = yield (0, config_1.getNPCsfromMemory)(room);
            const idleNPCs = Array.from(allNPCs.values()).filter((npc) => npc.phase === types_1.NPCPhase.IDLE && npc.id !== movingNpcId);
            // Check for collisions with IDLE NPCs
            let hasCollision = false;
            for (const idleNPC of idleNPCs) {
                const distance = Math.sqrt(Math.pow(landingPosition.x - idleNPC.position.x, 2) +
                    Math.pow(landingPosition.y - idleNPC.position.y, 2));
                if (distance < COLLISION_RADIUS) {
                    hasCollision = true;
                    console.log(`Collision detected between NPC ${movingNpcId} and IDLE NPC ${idleNPC.id} at distance ${distance}`);
                    break;
                }
            }
            // If no collision, return this position
            if (!hasCollision) {
                return landingPosition;
            }
            // Extend the path in the same direction
            const currentDistance = currentPathData.velocity * (currentPathData.pathDuration / 1000);
            const newDistance = currentDistance + EXTENSION_DISTANCE;
            // Update path data with extended distance
            currentPathData = Object.assign(Object.assign({}, currentPathData), { pathDuration: (newDistance / currentPathData.velocity) * 1000 });
            extensionCount++;
            console.log(`Extending path for NPC ${movingNpcId}, extension ${extensionCount}/${MAX_EXTENSIONS}`);
        }
        // If we've reached max extensions, just return the last calculated position
        console.log(`Max extensions reached for NPC ${movingNpcId}, settling at final position`);
        return calculateLandingPosition(currentPathData);
    });
}
// Mirror client-side path position calculation function
function calculatePathPosition(pathData, currentTime) {
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
function calculateLandingPosition(pathData) {
    // This is the same as calculatePathPosition at progress = 1
    return calculatePathPosition(pathData, pathData.timestamp + pathData.pathDuration);
}
// Keep the old function for reference but rename it (in case it's needed elsewhere)
function calculateLandingPositionWithWrap(pathData, terrainConfig) {
    const { startPosition, direction, velocity, pathDuration } = pathData;
    const distance = velocity * (pathDuration / 1000);
    // Calculate unwrapped landing position
    let landingPosition = {
        x: startPosition.x + direction.x * distance,
        y: startPosition.y + direction.y * distance,
        z: 0,
    };
    // Apply wrap-around using terrain boundaries
    const { boundaries } = terrainConfig;
    // Wrap X coordinate
    landingPosition.x =
        ((((landingPosition.x - boundaries.minX) % boundaries.width) +
            boundaries.width) %
            boundaries.width) +
            boundaries.minX;
    // Wrap Y coordinate
    landingPosition.y =
        ((((landingPosition.y - boundaries.minY) % boundaries.height) +
            boundaries.height) %
            boundaries.height) +
            boundaries.minY;
    return landingPosition;
}
function createNPCs() {
    return __awaiter(this, void 0, void 0, function* () {
        const npcs = [];
        const npcFilenames = yield getNPCFilenames();
        const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);
        for (let i = 0; i < NUM_NPCS; i++) {
            const filenameIndex = i % shuffledFilenames.length;
            const filename = shuffledFilenames[filenameIndex];
            const npc = {
                id: (0, uuid_1.v4)(),
                type: "npc",
                filename: filename,
                position: (0, user_info_1.getPosition)(),
                direction: (0, user_info_1.getDirection)(),
                phase: types_1.NPCPhase.IDLE,
            };
            npcs.push(npc);
        }
        return npcs;
    });
}
function getNPCFilenames() {
    return __awaiter(this, void 0, void 0, function* () {
        // Hardcode the available NPC filenames from frontend
        return [
            "am.png",
            "cl.png",
            "fdr.png",
            "he.png",
            "mlf.png",
            "mt.png",
            "nb.png",
            "rh.png",
            "wc.png",
        ];
    });
}
// Utility functions for NPC groups (mirrored from frontend)
function calculateNPCGroupScale(numNpcs) {
    if (numNpcs === 0)
        return 0;
    const baseScale = 3;
    const logScale = Math.log(numNpcs) / Math.log(4);
    return baseScale * (1 + logScale);
}
function getFaceNpcId(group) {
    if (group.faceNpcId && group.npcIds.has(group.faceNpcId)) {
        return group.faceNpcId;
    }
    // If no face NPC set or it's no longer in the group, use the first NPC
    const firstNpcId = group.npcIds.size > 0 ? group.npcIds.values().next().value : null;
    return firstNpcId !== null && firstNpcId !== void 0 ? firstNpcId : null;
}
// Check for NPC collisions and handle bouncing/reflection (mirrored from client)
function checkAndHandleNPCCollisions(room, currentPathData, currentPosition) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only check for thrown NPCs (those with captors)
        if (currentPathData.pathPhase !== types_1.PathPhase.THROWN ||
            !currentPathData.captorId) {
            return;
        }
        try {
            // Get all necessary data for collision detection
            const allPaths = yield (0, config_1.getActivepathsfromMemory)(room);
            const allNPCs = yield (0, config_1.getNPCsfromMemory)(room);
            const npcGroups = yield (0, config_1.getNPCGroupsfromMemory)(room);
            const COLLISION_RADIUS = 3.0;
            // Check collision with other path NPCs with captors (mirrored from client)
            for (const otherPathData of allPaths) {
                if (otherPathData.npc.id !== currentPathData.npc.id &&
                    otherPathData.pathPhase === types_1.PathPhase.THROWN &&
                    otherPathData.captorId &&
                    otherPathData.captorId !== currentPathData.captorId // Ignore same captor
                ) {
                    const otherPosition = calculatePathPosition(otherPathData, Date.now());
                    const distance = Math.sqrt(Math.pow(currentPosition.x - otherPosition.x, 2) +
                        Math.pow(currentPosition.y - otherPosition.y, 2));
                    if (distance < COLLISION_RADIUS) {
                        console.log(`Server: NPC-to-NPC collision detected: ${currentPathData.npc.id} vs ${otherPathData.npc.id}`);
                        yield handleNPCBounce(room, currentPathData, currentPosition, otherPosition);
                        return;
                    }
                }
            }
            // Check collision with NPC groups - only against face NPC with proper position/scale
            // (mirrored from client but simplified due to server constraints)
            console.log(`Server: Checking group collisions for NPC ${currentPathData.npc.id}, found ${npcGroups.size} groups`);
            for (const [captorId, group] of npcGroups.entries()) {
                if (group.captorId !== currentPathData.captorId && // Ignore same captor
                    group.npcIds.size > 0) {
                    // Get the face NPC for this group
                    const faceNpcId = getFaceNpcId(group);
                    if (!faceNpcId)
                        continue;
                    const faceNpc = allNPCs.get(faceNpcId);
                    if (!faceNpc || faceNpc.phase !== types_1.NPCPhase.CAPTURED)
                        continue;
                    // Note: On server we don't have real-time user positions, so we use the face NPC position
                    // This is a limitation compared to the client implementation
                    const groupPosition = faceNpc.position;
                    // Calculate the current group scale using utility functions
                    const groupScale = calculateNPCGroupScale(group.npcIds.size);
                    const distance = Math.sqrt(Math.pow(currentPosition.x - groupPosition.x, 2) +
                        Math.pow(currentPosition.y - groupPosition.y, 2));
                    // Use group scale for collision radius - larger groups have larger collision areas
                    const GROUP_COLLISION_RADIUS = groupScale * 0.8; // Scale factor for collision
                    console.log(`Server: Checking group ${group.captorId} face NPC ${faceNpcId}: distance=${distance}, threshold=${GROUP_COLLISION_RADIUS}, scale=${groupScale}`);
                    if (distance < GROUP_COLLISION_RADIUS) {
                        console.log(`Server: NPC-to-Group collision detected: ${currentPathData.npc.id} vs group ${group.captorId} (face: ${faceNpcId}) at distance ${distance}`);
                        yield handleNPCGroupReflection(room, currentPathData, currentPosition, groupPosition, group);
                        return;
                    }
                }
            }
        }
        catch (error) {
            console.error("Error checking NPC collisions:", error);
        }
    });
}
// Handle bouncing between two path NPCs
function handleNPCBounce(room, pathData, myPosition, otherPosition) {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate bounce direction (away from other NPC with some randomness)
        const bounceDirection = {
            x: myPosition.x - otherPosition.x + (Math.random() - 0.5) * 2,
            y: myPosition.y - otherPosition.y + (Math.random() - 0.5) * 2,
        };
        // Normalize bounce direction
        const length = Math.sqrt(bounceDirection.x * bounceDirection.x +
            bounceDirection.y * bounceDirection.y);
        const normalizedDirection = {
            x: bounceDirection.x / length,
            y: bounceDirection.y / length,
        };
        // Create bounce path
        const bouncePathData = {
            id: (0, uuid_1.v4)(),
            room: pathData.room,
            npc: pathData.npc,
            startPosition: {
                x: myPosition.x,
                y: myPosition.y,
            },
            direction: normalizedDirection,
            pathDuration: 1000, // Short bounce duration
            velocity: 15, // Medium bounce speed
            timestamp: Date.now(),
            captorId: pathData.captorId,
            pathPhase: types_1.PathPhase.BOUNCING,
        };
        // Update the path in memory
        const activePaths = yield (0, config_1.getActivepathsfromMemory)(room);
        const updatedPaths = activePaths.filter((p) => p.npc.id !== pathData.npc.id);
        updatedPaths.push(bouncePathData);
        yield (0, config_1.setPathsInMemory)(room, updatedPaths);
        // Broadcast to all clients
        server_1.io.to(room).emit("npc-path", (0, serializers_1.serialize)({ pathData: bouncePathData }));
    });
}
// Handle reflection off NPC group and emit NPC from group (mirrored from client)
function handleNPCGroupReflection(room, pathData, npcPosition, groupPosition, group) {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate reflection direction
        const reflectionDirection = {
            x: npcPosition.x - groupPosition.x,
            y: npcPosition.y - groupPosition.y,
        };
        // Normalize reflection direction
        const length = Math.sqrt(reflectionDirection.x * reflectionDirection.x +
            reflectionDirection.y * reflectionDirection.y);
        const normalizedDirection = {
            x: reflectionDirection.x / length,
            y: reflectionDirection.y / length,
        };
        // Create reflection path for the thrown NPC
        const reflectionPathData = {
            id: (0, uuid_1.v4)(),
            room: pathData.room,
            npc: pathData.npc,
            startPosition: {
                x: npcPosition.x,
                y: npcPosition.y,
            },
            direction: normalizedDirection,
            pathDuration: 1200, // Reflection duration
            velocity: 18, // Fast reflection speed
            timestamp: Date.now(),
            captorId: pathData.captorId,
            pathPhase: types_1.PathPhase.BOUNCING,
        };
        // Update the path in memory
        const activePaths = yield (0, config_1.getActivepathsfromMemory)(room);
        const updatedPaths = activePaths.filter((p) => p.npc.id !== pathData.npc.id);
        updatedPaths.push(reflectionPathData);
        yield (0, config_1.setPathsInMemory)(room, updatedPaths);
        // Broadcast reflection to all clients
        server_1.io.to(room).emit("npc-path", (0, serializers_1.serialize)({ pathData: reflectionPathData }));
        // Emit an NPC from the group in the same direction (faster)
        if (group.npcIds.size > 0) {
            const allNPCs = yield (0, config_1.getNPCsfromMemory)(room);
            const emittedNPCId = group.npcIds.values().next().value;
            if (emittedNPCId) {
                const emittedNPC = allNPCs.get(emittedNPCId);
                if (emittedNPC) {
                    const emissionPathData = {
                        id: (0, uuid_1.v4)(),
                        room: pathData.room,
                        npc: emittedNPC,
                        startPosition: {
                            x: groupPosition.x,
                            y: groupPosition.y,
                        },
                        direction: normalizedDirection,
                        pathDuration: 1500, // Longer emission duration
                        velocity: 25, // Very fast emission speed
                        timestamp: Date.now(),
                        captorId: group.captorId,
                        pathPhase: types_1.PathPhase.THROWN,
                    };
                    // Update paths for the emitted NPC
                    const currentPaths = yield (0, config_1.getActivepathsfromMemory)(room);
                    const filteredPaths = currentPaths.filter((p) => p.npc.id !== emittedNPC.id);
                    filteredPaths.push(emissionPathData);
                    yield (0, config_1.setPathsInMemory)(room, filteredPaths);
                    // Broadcast emission to all clients
                    server_1.io.to(room).emit("npc-path", (0, serializers_1.serialize)({ pathData: emissionPathData }));
                }
            }
        }
    });
}
