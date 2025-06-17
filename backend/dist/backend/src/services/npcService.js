"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNPCGroupInRoom = updateNPCGroupInRoom;
exports.removeTopNPCFromGroupInRoom = removeTopNPCFromGroupInRoom;
exports.setPathCompleteInRoom = setPathCompleteInRoom;
exports.createNPCGroups = createNPCGroups;
exports.checkAndHandleNPCCollisions = checkAndHandleNPCCollisions;
const types_1 = require("shared/types");
const npc_info_1 = require("../npc-info");
const uuid_1 = require("uuid");
// Redis Key prefixes for different data types
const NUM_NPCS = 4;
const paths_1 = require("../state/paths");
const npcGroups_1 = require("../state/npcGroups");
const terrain_1 = require("../utils/terrain");
const typed_socket_1 = require("../utils/typed-socket");
function updateNPCGroupInRoom(roomName, npcGroup) {
    (0, npcGroups_1.updateNPCGroupInRoomInMemory)(roomName, npcGroup);
    (0, typed_socket_1.emitToRoom)(roomName, "npc-group-update", { npcGroup });
}
function removeTopNPCFromGroupInRoom(roomName, captorId, npcGroupId) {
    (0, npcGroups_1.removeTopNPCFromGroupInRoomInMemory)(roomName, captorId);
    (0, typed_socket_1.emitToRoom)(roomName, "npc-group-pop", {
        npcGroupId,
    });
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
        const updatedNPCGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, npcGroup), { position: landingPosition, phase: types_1.NPCPhase.IDLE }));
        updateNPCGroupInRoom(room, updatedNPCGroup);
        // Remove this path from active paths
        (0, paths_1.deletePathInMemory)(room, npcGroup.id);
        // Only broadcast for thrown NPCs (ones with captorId)
        if (npcGroup.captorId) {
            (0, typed_socket_1.emitToRoom)(room, "path-complete", { npcGroup: updatedNPCGroup });
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
function createNPCGroups() {
    const npcGroups = [];
    const npcFilenames = getNPCFilenames();
    const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);
    for (let i = 0; i < NUM_NPCS; i++) {
        const filenameIndex = i % shuffledFilenames.length;
        const filename = shuffledFilenames[filenameIndex];
        const npcGroup = new types_1.NPCGroup({
            id: (0, uuid_1.v4)(),
            fileNames: [filename],
            position: (0, npc_info_1.getPosition)(),
            direction: (0, npc_info_1.getDirection)(),
            phase: types_1.NPCPhase.IDLE,
        });
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
// Check for NPC collisions and handle merging/bouncing based on group sizes
function checkAndHandleNPCCollisions(room) {
    try {
        // Get all necessary data for collision detection
        const allPaths = Array.from((0, paths_1.getpathsfromMemory)(room).values());
        console.log("pathData", allPaths.length);
        const allNPCGroups = (0, npcGroups_1.getNPCGroupsfromMemory)(room);
        // Check collision between path NPCs and idle NPCs
        for (let i = 0; i < allPaths.length; i++) {
            const pathData = allPaths[i];
            if (pathData.pathPhase !== types_1.PathPhase.THROWN) {
                continue;
            }
            const pathPosition = calculatePathPosition(pathData, Date.now());
            console.log("checking path npc collisions");
            // Check collision with idle NPCs
            const idleNPCGroups = Array.from(allNPCGroups.values()).filter((npcGroup) => npcGroup.phase === types_1.NPCPhase.IDLE && npcGroup.id !== pathData.npcGroup.id);
            for (const idleNPCGroup of idleNPCGroups) {
                const collided = detectCollision(pathPosition, Object.assign(Object.assign({}, idleNPCGroup.position), { z: 0 }), 4.0, 4.0, 4.0, 4.0);
                if (collided) {
                    console.log(`Path NPC ${pathData.npcGroup.id} collided with idle NPC ${idleNPCGroup.id}`);
                    handleNPCMerge(room, pathData, idleNPCGroup, pathPosition);
                    return;
                }
            }
        }
        // Check collision between path NPCs
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
                    const collided = detectCollision(currentPosition, otherPosition, 4.0, 4.0, 4.0, 4.0);
                    if (collided) {
                        console.log("Path NPC collision detected");
                        const currentSize = currentPathData.npcGroup.fileNames.length;
                        const otherSize = otherPathData.npcGroup.fileNames.length;
                        if (currentSize === otherSize) {
                            // Same size: bounce as before
                            handleNPCBounce(room, currentPathData, currentPosition, otherPosition);
                            handleNPCBounce(room, otherPathData, otherPosition, currentPosition);
                        }
                        else {
                            // Different sizes: merge into bigger group
                            if (currentSize > otherSize) {
                                handlePathNPCMerge(room, currentPathData, otherPathData, currentPosition);
                            }
                            else {
                                handlePathNPCMerge(room, otherPathData, currentPathData, otherPosition);
                            }
                        }
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
// Handle merging between a path NPC and an idle NPC
function handleNPCMerge(room, pathData, idleNPCGroup, collisionPosition) {
    const pathSize = pathData.npcGroup.fileNames.length;
    const idleSize = idleNPCGroup.fileNames.length;
    let winnerGroup;
    let loserGroup;
    if (pathSize > idleSize) {
        // Path NPC is bigger, it wins
        winnerGroup = pathData.npcGroup;
        loserGroup = idleNPCGroup;
    }
    else if (idleSize > pathSize) {
        // Idle NPC is bigger, it wins
        winnerGroup = idleNPCGroup;
        loserGroup = pathData.npcGroup;
    }
    else {
        // Same size: path NPC wins (as specified in requirements)
        winnerGroup = pathData.npcGroup;
        loserGroup = idleNPCGroup;
    }
    // Create merged group
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, winnerGroup), { fileNames: [...winnerGroup.fileNames, ...loserGroup.fileNames], position: collisionPosition, phase: types_1.NPCPhase.PATH }));
    // Update the path data with the merged group
    const updatedPathData = Object.assign(Object.assign({}, pathData), { npcGroup: mergedGroup });
    // Update memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(mergedGroup.id, updatedPathData);
    (0, paths_1.setPathsInMemory)(room, paths);
    // Remove the losing NPC group from memory by updating it with 0 fileNames
    const emptyLoserGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, loserGroup), { fileNames: [] }));
    updateNPCGroupInRoom(room, emptyLoserGroup);
    // Update the winner in NPC groups memory
    updateNPCGroupInRoom(room, mergedGroup);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: updatedPathData });
    console.log(`Merged NPC groups: ${winnerGroup.id} absorbed ${loserGroup.id}`);
}
// Handle merging between two path NPCs
function handlePathNPCMerge(room, winnerPathData, loserPathData, collisionPosition) {
    // Create merged group with winner's captor ID
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, winnerPathData.npcGroup), { fileNames: [...winnerPathData.npcGroup.fileNames, ...loserPathData.npcGroup.fileNames], position: collisionPosition, phase: types_1.NPCPhase.PATH }));
    // Update the winner's path data with the merged group
    const updatedPathData = Object.assign(Object.assign({}, winnerPathData), { npcGroup: mergedGroup });
    // Update memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(mergedGroup.id, updatedPathData);
    paths.delete(loserPathData.npcGroup.id); // Remove the loser's path
    (0, paths_1.setPathsInMemory)(room, paths);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: updatedPathData });
    console.log(`Merged path NPCs: ${winnerPathData.npcGroup.id} absorbed ${loserPathData.npcGroup.id}`);
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
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: bouncePathData });
}
