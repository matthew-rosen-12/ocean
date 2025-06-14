"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNPCGroupInRoom = updateNPCGroupInRoom;
exports.removeNPCFromGroupInRoom = removeNPCFromGroupInRoom;
exports.setPathCompleteInRoom = setPathCompleteInRoom;
exports.createNPCGroups = createNPCGroups;
exports.checkAndHandleNPCCollisions = checkAndHandleNPCCollisions;
const types_1 = require("shared/types");
const npc_info_1 = require("../npc-info");
const uuid_1 = require("uuid");
// Redis Key prefixes for different data types
const NUM_NPCS = 4;
const server_1 = require("../server");
const paths_1 = require("../state/paths");
const npcGroups_1 = require("../state/npcGroups");
const serializers_1 = require("../utils/serializers");
const terrain_1 = require("../utils/terrain");
function updateNPCGroupInRoom(roomName, npcGroup) {
    (0, npcGroups_1.updateNPCGroupInRoomInMemory)(roomName, npcGroup);
    server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({ npcGroup }));
}
function removeNPCFromGroupInRoom(roomName, captorId, npcGroupId) {
    (0, npcGroups_1.removeTopNPCFromGroupInRoomInMemory)(roomName, captorId);
    server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({
        groupId: captorId,
        npcGroupId,
        removed: true,
    }));
}
function setPathCompleteInRoom(room, npcGroup) {
    try {
        // Get room-specific terrain configuration
        const terrainConfig = (0, terrain_1.generateRoomTerrain)(room);
        // Get the path data for this NPC
        const paths = (0, paths_1.getpathsfromMemory)(room);
        const pathDataForNPC = paths.get(npcGroup.id);
        if (!pathDataForNPC) {
            console.log(`No path data found for NPC ${npcGroup.id} in room ${room}`);
            return;
        }
        // Calculate landing position with wrap-around and collision avoidance
        const landingPosition = calculateLandingPositionWithCollisionAvoidance(pathDataForNPC, room, npcGroup.id);
        const updatedNPCGroup = Object.assign(Object.assign({}, npcGroup), { position: landingPosition, phase: types_1.NPCPhase.IDLE });
        updateNPCGroupInRoom(room, updatedNPCGroup);
        // Remove this path from active paths
        (0, paths_1.deletePathInMemory)(room, npcGroup.id);
        // Only broadcast for thrown NPCs (ones with captorId)
        if (npcGroup.captorId) {
            server_1.io.to(room).emit("path-complete", (0, serializers_1.serialize)({
                npcGroup: updatedNPCGroup,
            }));
        }
    }
    catch (error) {
        console.error(`Error setting path complete for NPC ${npcGroup.id} in room ${room}:`, error);
    }
}
function calculateLandingPositionWithCollisionAvoidance(pathData, room, movingNpcGroupId) {
    const COLLISION_RADIUS = 2.0; // Distance to check for collisions
    const EXTENSION_DISTANCE = 2.5; // How much to extend the path if collision detected
    const MAX_EXTENSIONS = 5; // Maximum number of extensions to prevent infinite loops
    let currentPathData = Object.assign({}, pathData);
    let extensionCount = 0;
    while (extensionCount < MAX_EXTENSIONS) {
        // Calculate landing position without wrapping
        const landingPosition = calculateLandingPosition(currentPathData);
        // Get all NPCs in the room to check for collisions
        const allNPCGroups = (0, npcGroups_1.getNPCGroupsfromMemory)(room);
        const idleNPCGroups = Array.from(allNPCGroups.values()).filter((npcGroup) => npcGroup.phase === types_1.NPCPhase.IDLE && npcGroup.id !== movingNpcGroupId);
        // Check for collisions with IDLE NPCs
        let hasCollision = false;
        for (const idleNPCGroup of idleNPCGroups) {
            const collided = detectCollision(landingPosition, Object.assign(Object.assign({}, idleNPCGroup.position), { z: 0 }), 4.0, // width1 - moving NPC
            4.0, // height1 - moving NPC
            4.0, // width2 - idle NPC
            4.0 // height2 - idle NPC
            );
            if (collided) {
                hasCollision = true;
                console.log(`Bounding box collision detected between NPC ${movingNpcGroupId} and IDLE NPC ${idleNPCGroup.id}`);
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
        console.log(`Extending path for NPC ${movingNpcGroupId}, extension ${extensionCount}/${MAX_EXTENSIONS}`);
    }
    // If we've reached max extensions, just return the last calculated position
    console.log(`Max extensions reached for NPC ${movingNpcGroupId}, settling at final position`);
    return calculateLandingPosition(currentPathData);
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
function createNPCGroups() {
    const npcGroups = [];
    const npcFilenames = getNPCFilenames();
    const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);
    for (let i = 0; i < NUM_NPCS; i++) {
        const filenameIndex = i % shuffledFilenames.length;
        const filename = shuffledFilenames[filenameIndex];
        const npcGroup = {
            id: (0, uuid_1.v4)(),
            fileNames: [filename],
            faceFileName: filename,
            position: (0, npc_info_1.getPosition)(),
            direction: (0, npc_info_1.getDirection)(),
            phase: types_1.NPCPhase.IDLE,
        };
        npcGroups.push(npcGroup);
    }
    return npcGroups;
}
function getNPCFilenames() {
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
}
const detectCollision = (position1, position2, width1 = 4.0, height1 = 4.0, width2 = 4.0, height2 = 4.0) => {
    // Bounding box collision detection
    const halfWidth1 = width1 / 2;
    const halfHeight1 = height1 / 2;
    const halfWidth2 = width2 / 2;
    const halfHeight2 = height2 / 2;
    const left1 = position1.x - halfWidth1;
    const right1 = position1.x + halfWidth1;
    const top1 = position1.y - halfHeight1;
    const bottom1 = position1.y + halfHeight1;
    const left2 = position2.x - halfWidth2;
    const right2 = position2.x + halfWidth2;
    const top2 = position2.y - halfHeight2;
    const bottom2 = position2.y + halfHeight2;
    // Check if bounding boxes overlap
    return !(right1 < left2 || left1 > right2 || bottom1 < top2 || top1 > bottom2);
};
// Check for NPC collisions and handle bouncing/reflection (mirrored from client)
function checkAndHandleNPCCollisions(room) {
    try {
        // Get all necessary data for collision detection
        const allPaths = Array.from((0, paths_1.getpathsfromMemory)(room).values());
        const COLLISION_RADIUS = 3.0;
        // Check collision with other path NPCs with captors (mirrored from client)
        for (let i = 0; i < allPaths.length; i++) {
            const currentPathData = allPaths[i];
            if (currentPathData.pathPhase !== types_1.PathPhase.THROWN) {
                continue;
            }
            const currentPosition = calculatePathPosition(currentPathData, Date.now());
            for (let j = i + 1; j < allPaths.length; j++) {
                const otherPathData = allPaths[j];
                if (otherPathData.pathPhase === types_1.PathPhase.THROWN &&
                    otherPathData.npcGroup.captorId &&
                    otherPathData.npcGroup.captorId !== currentPathData.npcGroup.captorId // Ignore same captor
                ) {
                    const otherPosition = calculatePathPosition(otherPathData, Date.now());
                    const collided = detectCollision(currentPosition, otherPosition, 4.0, // width1
                    4.0, // height1
                    4.0, // width2
                    4.0 // height2
                    );
                    if (collided) {
                        console.log("NPC collision detected");
                        handleNPCBounce(room, currentPathData, currentPosition, otherPosition);
                        handleNPCBounce(room, otherPathData, otherPosition, currentPosition);
                        return;
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Error checking NPC collisions:", error);
    }
}
// Handle bouncing between two path NPCs
function handleNPCBounce(room, pathData, myPosition, otherPosition) {
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
        npcGroup: pathData.npcGroup,
        startPosition: {
            x: myPosition.x,
            y: myPosition.y,
        },
        direction: normalizedDirection,
        pathDuration: 1000, // Short bounce duration
        velocity: 15, // Medium bounce speed
        timestamp: Date.now(),
        pathPhase: types_1.PathPhase.BOUNCING,
    };
    // Update the path in memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(bouncePathData.npcGroup.id, bouncePathData);
    (0, paths_1.setPathsInMemory)(room, paths);
    console.log("handle npc bounce");
    // Broadcast to all clients
    server_1.io.to(room).emit("npc-path", (0, serializers_1.serialize)({ pathData: bouncePathData }));
}
