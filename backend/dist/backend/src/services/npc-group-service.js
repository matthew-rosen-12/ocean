"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNPCGroupInRoom = updateNPCGroupInRoom;
exports.setPathCompleteInRoom = setPathCompleteInRoom;
exports.createNPCGroups = createNPCGroups;
exports.createSingleNPCGroup = createSingleNPCGroup;
exports.checkAndHandleNPCCollisions = checkAndHandleNPCCollisions;
exports.checkAndHandleNPCFleeing = checkAndHandleNPCFleeing;
exports.checkAndDeleteFleeingNPCs = checkAndDeleteFleeingNPCs;
exports.checkAndSpawnNPCs = checkAndSpawnNPCs;
const types_1 = require("shared/types");
const npc_info_1 = require("../initialization/npc-info");
const uuid_1 = require("uuid");
const terrain_1 = require("../state/terrain");
const MAX_CUMULATIVE_SIZE = 10;
const paths_1 = require("../state/paths");
const npc_groups_1 = require("../state/npc-groups");
const typed_socket_1 = require("../typed-socket");
const users_1 = require("../state/users");
const bot_management_service_1 = require("./bot-management-service");
const types_2 = require("shared/types");
const interaction_service_1 = require("./interaction-service");
function updateNPCGroupInRoom(roomName, npcGroup) {
    (0, npc_groups_1.updateNPCGroupInRoomInMemory)(roomName, npcGroup);
    (0, typed_socket_1.emitToRoom)(roomName, "npc-group-update", { npcGroup });
}
function setPathCompleteInRoom(room, npcGroup) {
    const paths = (0, paths_1.getpathsfromMemory)(room);
    const pathDataForNPC = paths.get(npcGroup.id);
    if (!pathDataForNPC) {
        return;
    }
    // Check if this is a thrown path that should transition to returning
    if (pathDataForNPC.pathPhase === types_1.PathPhase.THROWN && npcGroup.captorId) {
        const landingPosition = calculateLandingPosition(pathDataForNPC);
        // Get the thrower's current position to calculate return direction
        const allUsers = (0, users_1.getAllUsersInRoom)(room);
        const thrower = Array.from(allUsers.values()).find(user => user.id === npcGroup.captorId);
        if (thrower) {
            // Calculate direction back to thrower
            const directionToThrower = {
                x: thrower.position.x - landingPosition.x,
                y: thrower.position.y - landingPosition.y,
            };
            // Normalize direction
            const length = Math.sqrt(directionToThrower.x * directionToThrower.x + directionToThrower.y * directionToThrower.y);
            if (length > 0) {
                directionToThrower.x /= length;
                directionToThrower.y /= length;
            }
            // Update the existing path to return to thrower (keep same ID, velocity, but change phase)
            const returningPathData = Object.assign(Object.assign({}, pathDataForNPC), { startPosition: landingPosition, direction: directionToThrower, timestamp: Date.now(), pathPhase: types_1.PathPhase.RETURNING, pathDuration: 500 });
            // Update paths in memory with same ID
            const paths = (0, paths_1.getpathsfromMemory)(room);
            paths.set(npcGroup.id, returningPathData);
            (0, paths_1.setPathsInMemory)(room, paths);
            // Broadcast the updated path
            (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: returningPathData });
        }
        else {
            // Thrower not found, go to IDLE
            (0, paths_1.deletePathInMemory)(room, pathDataForNPC.id);
            (0, typed_socket_1.emitToRoom)(room, "path-deleted", { pathData: pathDataForNPC });
            npcGroup.phase = types_1.NPCPhase.IDLE;
            npcGroup.position = calculateLandingPosition(pathDataForNPC);
            updateNPCGroupInRoom(room, npcGroup);
        }
    }
    else if (pathDataForNPC.pathPhase === types_1.PathPhase.RETURNING) {
        // Returning NPCs complete their path - check if thrower is still around
        const landingPosition = calculateLandingPosition(pathDataForNPC);
        // Get the thrower's current position to see if we should continue returning
        const allUsers = (0, users_1.getAllUsersInRoom)(room);
        const thrower = Array.from(allUsers.values()).find(user => user.id === npcGroup.captorId);
        if (thrower) {
            // Calculate direction back to thrower from landing position
            const directionToThrower = {
                x: thrower.position.x - landingPosition.x,
                y: thrower.position.y - landingPosition.y,
            };
            // Normalize direction
            const length = Math.sqrt(directionToThrower.x * directionToThrower.x + directionToThrower.y * directionToThrower.y);
            if (length > 0) {
                directionToThrower.x /= length;
                directionToThrower.y /= length;
            }
            // Create a new return path
            const newReturningPathData = Object.assign(Object.assign({}, pathDataForNPC), { startPosition: landingPosition, direction: directionToThrower, timestamp: Date.now(), pathPhase: types_1.PathPhase.RETURNING, pathDuration: 500 });
            // Update paths in memory with same ID
            const paths = (0, paths_1.getpathsfromMemory)(room);
            paths.set(npcGroup.id, newReturningPathData);
            (0, paths_1.setPathsInMemory)(room, paths);
            // Broadcast the updated path
            (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: newReturningPathData });
        }
        else {
            // Thrower not found, go to IDLE
            (0, paths_1.deletePathInMemory)(room, pathDataForNPC.id);
            (0, typed_socket_1.emitToRoom)(room, "path-deleted", { pathData: pathDataForNPC });
            npcGroup.phase = types_1.NPCPhase.IDLE;
            npcGroup.position = landingPosition;
            updateNPCGroupInRoom(room, npcGroup);
        }
    }
    else if (pathDataForNPC.pathPhase === types_1.PathPhase.FLEEING) {
        // Normal path completion - go to IDLE
        let landingPosition;
        // Only apply collision avoidance for emitted NPCs (bouncing NPCs that came from collisions)
        // These are NPCs without captorId that are in bouncing/path phase
        // Thrown NPCs (with captorId) should land normally and trigger capture/merge logic
        if (pathDataForNPC.pathPhase === types_1.PathPhase.FLEEING) {
            const collisionResult = calculateLandingPositionWithCollisionAvoidance(pathDataForNPC, room, npcGroup.id);
            // If path was extended due to collision, update clients with new path
            if (collisionResult.extendedPath) {
                // Update the path in memory and broadcast to clients
                const paths = (0, paths_1.getpathsfromMemory)(room);
                paths.set(npcGroup.id, collisionResult.extendedPath);
                (0, paths_1.setPathsInMemory)(room, paths);
                // Broadcast the extended path to clients so they can animate smoothly
                (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: collisionResult.extendedPath });
                // Don't complete the path yet - let the extended path finish naturally
                return;
            }
            landingPosition = collisionResult.position;
        }
        else {
            // For thrown NPCs, just calculate normal landing position without collision avoidance
            landingPosition = calculateLandingPosition(pathDataForNPC);
        }
        const updatedNPCGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, npcGroup), { position: landingPosition, phase: types_1.NPCPhase.IDLE }));
        updateNPCGroupInRoom(room, updatedNPCGroup);
        // Remove this path from active paths
        (0, paths_1.deletePathInMemory)(room, npcGroup.id);
        // Only broadcast for thrown NPCs (ones with captorId)
        if (npcGroup.captorId) {
            (0, typed_socket_1.emitToRoom)(room, "path-complete", { npcGroup: updatedNPCGroup });
        }
    }
}
function calculateLandingPositionWithCollisionAvoidance(pathData, room, movingNpcGroupId) {
    const EXTENSION_DISTANCE = 2.5; // How much to extend the path if collision detected
    const MAX_EXTENSIONS = 5; // Maximum number of extensions to prevent infinite loops
    let currentPathData = Object.assign({}, pathData);
    let extensionCount = 0;
    while (extensionCount < MAX_EXTENSIONS) {
        // Calculate landing position without wrapping
        const landingPosition = calculateLandingPosition(currentPathData);
        // Get all NPCs in the room to check for collisions
        const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
        const idleNPCGroups = Array.from(allNPCGroups.values()).filter((npcGroup) => npcGroup.phase === types_1.NPCPhase.IDLE && npcGroup.id !== movingNpcGroupId);
        // Check for collisions with IDLE NPCs
        let hasCollision = false;
        for (const idleNPCGroup of idleNPCGroups) {
            const collided = detectCollision(landingPosition, Object.assign(Object.assign({}, idleNPCGroup.position), { z: 0 }), types_1.NPC_WIDTH, // width1 - moving NPC
            types_1.NPC_HEIGHT, // height1 - moving NPC
            types_1.NPC_WIDTH, // width2 - idle NPC
            types_1.NPC_HEIGHT // height2 - idle NPC
            );
            if (collided) {
                hasCollision = true;
                console.log(`Bounding box collision detected between NPC ${movingNpcGroupId} and IDLE NPC ${idleNPCGroup.id}`);
                break;
            }
        }
        // If no collision, return this position
        if (!hasCollision) {
            // If we extended the path, return the extended path data
            if (extensionCount > 0) {
                return { position: landingPosition, extendedPath: currentPathData };
            }
            return { position: landingPosition };
        }
        // Extend the path in the same direction
        const currentDistance = currentPathData.velocity * (currentPathData.pathDuration / 1000);
        const newDistance = currentDistance + EXTENSION_DISTANCE;
        // Update path data with extended distance
        currentPathData = Object.assign(Object.assign({}, currentPathData), { pathDuration: (newDistance / currentPathData.velocity) * 1000, timestamp: Date.now() });
        extensionCount++;
        console.log(`Extending path for NPC ${movingNpcGroupId}, extension ${extensionCount}/${MAX_EXTENSIONS}`);
    }
    // If we've reached max extensions, return the last calculated position and extended path
    console.log(`Max extensions reached for NPC ${movingNpcGroupId}, settling at final position`);
    return {
        position: calculateLandingPosition(currentPathData),
        extendedPath: currentPathData
    };
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
function createNPCGroups(terrainBoundaries, userCount = 1) {
    const npcGroups = [];
    const npcFilenames = getNPCFilenames();
    const shuffledFilenames = [...npcFilenames].sort(() => Math.random() - 0.5);
    const targetNPCCount = userCount * 4;
    for (let i = 0; i < targetNPCCount; i++) {
        const filenameIndex = i % shuffledFilenames.length;
        const filename = shuffledFilenames[filenameIndex];
        const npcGroup = new types_1.NPCGroup({
            id: (0, uuid_1.v4)(),
            fileNames: [filename],
            position: (0, npc_info_1.getInitialPosition)(terrainBoundaries),
            direction: (0, npc_info_1.getInitialDirection)(),
            phase: types_1.NPCPhase.IDLE,
        });
        npcGroups.push(npcGroup);
    }
    return npcGroups;
}
function createSingleNPCGroup(terrainBoundaries) {
    const npcFilenames = getNPCFilenames();
    const randomFilename = npcFilenames[Math.floor(Math.random() * npcFilenames.length)];
    return new types_1.NPCGroup({
        id: (0, uuid_1.v4)(),
        fileNames: [randomFilename],
        position: (0, npc_info_1.getInitialPosition)(terrainBoundaries),
        direction: (0, npc_info_1.getInitialDirection)(),
        phase: types_1.NPCPhase.IDLE,
    });
}
function getNPCFilenames() {
    // Hardcode the available NPC filenames from frontend
    return [
        "ada_lovelace.png",
        "akbar.png",
        "angela_merkel.png",
        "beethoven.png",
        "benjamin_franklin.png",
        "boudica.png",
        "bruce_lee.png",
        "chang_e.png",
        "cleopatra.png",
        "da_vinci.png",
        "emperor_meiji.png",
        "fdr.png",
        "florence_nightingale.png",
        "fred_astaire.png",
        "frederick_douglass.png",
        "girl_with_a_pearl_earring.png",
        "hermes.png",
        "isaac_netwon.png",
        "jane_austen.png",
        "jim_thorpe.png",
        "julia_codesido.png",
        "julius_caesar.png",
        "leif_erikson.png",
        "mansa_musa.png",
        "margaret_thatcher.png",
        "marie_curie.png",
        "mary_queen_of_scots.png",
        "mary_wollenstonecraft.png",
        "morgan_la_fey.png",
        "napoleon_bonaparte.png",
        "nelson_mandela.png",
        "nzinga_of_ndongo_and_matamba.png",
        "queen_elizabeth_I.png",
        "queen_lili_uokalani.png",
        "robinhood.png",
        "rumi.png",
        "sacagawea.png",
        "shakespeare.png",
        "sukarno.png",
        "winston_churchill.png",
    ];
}
const detectCollision = (position1, position2, width1 = types_1.NPC_WIDTH, height1 = types_1.NPC_HEIGHT, width2 = types_1.NPC_WIDTH, height2 = types_1.NPC_HEIGHT) => {
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
        const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
        // Check collision between thrown/returning path NPCs
        const thrownPaths = allPaths.filter(path => path.pathPhase === types_1.PathPhase.THROWN || path.pathPhase === types_1.PathPhase.RETURNING);
        const idleNPCGroups = Array.from(allNPCGroups.values()).filter(npcGroup => npcGroup.phase === types_1.NPCPhase.IDLE);
        const uncapturedIdleNPCs = idleNPCGroups.filter(npcGroup => !npcGroup.captorId);
        const capturedIdleNPCs = idleNPCGroups.filter(npcGroup => npcGroup.captorId);
        for (const thrownPath of thrownPaths) {
            const pathPosition = calculatePathPosition(thrownPath, Date.now());
            const pathNPCGroup = allNPCGroups.getByNpcGroupId(thrownPath.npcGroupId);
            if (!pathNPCGroup)
                continue;
            // Check collision with uncaptured idle NPCs (normal merge behavior)
            for (const idleNPCGroup of uncapturedIdleNPCs) {
                const collided = detectCollision(pathPosition, Object.assign(Object.assign({}, idleNPCGroup.position), { z: 0 }), types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    handlePathNPCMerge(room, thrownPath, pathNPCGroup, idleNPCGroup, pathPosition);
                    return;
                }
            }
            // Check collision with captured idle NPCs (emit individual NPCs)
            // Skip collision detection for bots - frontend will handle this
            for (const capturedIdleNPCGroup of capturedIdleNPCs) {
                // Skip if it's the same captor (don't collide with your own captured NPCs)
                if (capturedIdleNPCGroup.captorId === pathNPCGroup.captorId) {
                    continue;
                }
                // Skip collision detection for bot-owned captured NPCs - frontend clients will handle this
                if (capturedIdleNPCGroup.captorId && bot_management_service_1.BotManagementService.isBot(capturedIdleNPCGroup.captorId)) {
                    continue;
                }
                const collided = detectCollision(pathPosition, Object.assign(Object.assign({}, capturedIdleNPCGroup.position), { z: 0 }), types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    handleCapturedNPCEmission(room, thrownPath, pathNPCGroup, capturedIdleNPCGroup, pathPosition);
                    return;
                }
            }
        }
        // Check collision between thrown path NPCs
        for (const thrownPath of thrownPaths) {
            const thrownPathPosition = calculatePathPosition(thrownPath, Date.now());
            for (const otherPath of allPaths) {
                if (otherPath.id === thrownPath.id) {
                    continue;
                }
                // Get the NPC groups for both paths
                const thrownPathNPCGroup = allNPCGroups.getByNpcGroupId(thrownPath.npcGroupId);
                const otherPathNPCGroup = allNPCGroups.getByNpcGroupId(otherPath.npcGroupId);
                if (!thrownPathNPCGroup || !otherPathNPCGroup)
                    continue;
                const otherPathPosition = calculatePathPosition(otherPath, Date.now());
                const collided = detectCollision(thrownPathPosition, otherPathPosition, types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    const thrownPathSize = thrownPathNPCGroup.fileNames.length;
                    const otherPathSize = otherPathNPCGroup.fileNames.length;
                    const sameOwner = otherPathNPCGroup.captorId === thrownPathNPCGroup.captorId;
                    if (sameOwner) {
                        // Same owner: always merge (no bouncing between same player's NPCs)
                        if (thrownPathSize >= otherPathSize) {
                            handlePathNPCMerge(room, thrownPath, thrownPathNPCGroup, otherPathNPCGroup, thrownPathPosition);
                        }
                        else {
                            handlePathNPCMerge(room, otherPath, otherPathNPCGroup, thrownPathNPCGroup, otherPathPosition);
                        }
                    }
                    else {
                        // Different owners: existing behavior (bounce or merge based on size)
                        if (thrownPathSize === otherPathSize && (otherPath.pathPhase === types_1.PathPhase.THROWN || otherPath.pathPhase === types_1.PathPhase.RETURNING)) {
                            // Same size: bounce as before
                            handleNPCBounce(room, thrownPath, thrownPathPosition, otherPathPosition);
                            handleNPCBounce(room, otherPath, otherPathPosition, thrownPathPosition);
                        }
                        else {
                            // Different sizes: merge into bigger group
                            if (thrownPathSize >= otherPathSize) {
                                handlePathNPCMerge(room, thrownPath, thrownPathNPCGroup, otherPathNPCGroup, thrownPathPosition);
                            }
                            else {
                                handlePathNPCMerge(room, otherPath, otherPathNPCGroup, thrownPathNPCGroup, otherPathPosition);
                            }
                        }
                    }
                    return;
                }
            }
        }
        // Check collision between fleeing/idle NPCs for merging
        const fleeingPaths = allPaths.filter(path => path.pathPhase === types_1.PathPhase.FLEEING);
        // Check fleeing NPCs against idle NPCs
        for (const fleeingPath of fleeingPaths) {
            const fleeingPosition = calculatePathPosition(fleeingPath, Date.now());
            const fleeingNPCGroup = allNPCGroups.getByNpcGroupId(fleeingPath.npcGroupId);
            if (!fleeingNPCGroup)
                continue;
            // Check collision with uncaptured idle NPCs
            for (const idleNPCGroup of uncapturedIdleNPCs) {
                const collided = detectCollision(fleeingPosition, Object.assign(Object.assign({}, idleNPCGroup.position), { z: 0 }), types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    handleFleeingIdleMerge(room, fleeingPath, fleeingNPCGroup, idleNPCGroup, fleeingPosition);
                    return;
                }
            }
        }
        // Check fleeing NPCs against other fleeing NPCs
        for (let i = 0; i < fleeingPaths.length; i++) {
            const fleeingPath1 = fleeingPaths[i];
            const fleeingPosition1 = calculatePathPosition(fleeingPath1, Date.now());
            const fleeingNPCGroup1 = allNPCGroups.getByNpcGroupId(fleeingPath1.npcGroupId);
            if (!fleeingNPCGroup1)
                continue;
            for (let j = i + 1; j < fleeingPaths.length; j++) {
                const fleeingPath2 = fleeingPaths[j];
                const fleeingPosition2 = calculatePathPosition(fleeingPath2, Date.now());
                const fleeingNPCGroup2 = allNPCGroups.getByNpcGroupId(fleeingPath2.npcGroupId);
                if (!fleeingNPCGroup2)
                    continue;
                const collided = detectCollision(fleeingPosition1, fleeingPosition2, types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    // Merge the smaller into the larger
                    const size1 = fleeingNPCGroup1.fileNames.length;
                    const size2 = fleeingNPCGroup2.fileNames.length;
                    if (size1 >= size2) {
                        handleFleeingFleeingMerge(room, fleeingPath1, fleeingNPCGroup1, fleeingPath2, fleeingNPCGroup2, fleeingPosition1);
                    }
                    else {
                        handleFleeingFleeingMerge(room, fleeingPath2, fleeingNPCGroup2, fleeingPath1, fleeingNPCGroup1, fleeingPosition2);
                    }
                    return;
                }
            }
        }
        // Check idle NPCs against other idle NPCs
        for (let i = 0; i < uncapturedIdleNPCs.length; i++) {
            const idleNPC1 = uncapturedIdleNPCs[i];
            for (let j = i + 1; j < uncapturedIdleNPCs.length; j++) {
                const idleNPC2 = uncapturedIdleNPCs[j];
                const collided = detectCollision(Object.assign(Object.assign({}, idleNPC1.position), { z: 0 }), Object.assign(Object.assign({}, idleNPC2.position), { z: 0 }), types_1.NPC_WIDTH, types_1.NPC_HEIGHT, types_1.NPC_WIDTH, types_1.NPC_HEIGHT);
                if (collided) {
                    handleIdleIdleMerge(room, idleNPC1, idleNPC2);
                    return;
                }
            }
        }
    }
    catch (error) {
        console.error("Error checking NPC collisions:", error);
    }
}
// Handle merging between two path NPCs or path NPC with idle NPC
function handlePathNPCMerge(room, winnerPathData, winnerNPCGroup, loser, collisionPosition) {
    // Send interaction for returning/thrown NPC capture if applicable
    if (winnerNPCGroup.captorId && (winnerPathData.pathPhase === types_1.PathPhase.THROWN || winnerPathData.pathPhase === types_1.PathPhase.RETURNING)) {
        // Get the first captured NPC for the interaction
        const capturedNPCFileName = loser.fileNames[0];
        if (capturedNPCFileName) {
            // Process interaction asynchronously to avoid blocking game mechanics
            setImmediate(() => {
                if (winnerNPCGroup.captorId) {
                    interaction_service_1.InteractionService.handleReturningNPCRecaptured(room, winnerNPCGroup.captorId, winnerNPCGroup, loser, winnerPathData.pathPhase);
                }
            });
        }
    }
    // Create merged group with winner's captor ID
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, winnerNPCGroup), { fileNames: [...loser.fileNames, ...winnerNPCGroup.fileNames], position: collisionPosition, phase: types_1.NPCPhase.PATH }));
    // update the groups in memory
    updateNPCGroupInRoom(room, mergedGroup);
    loser.fileNames = [];
    updateNPCGroupInRoom(room, loser);
    // Update the winner's path data with the merged group
    const updatedPathData = Object.assign(Object.assign({}, winnerPathData), { npcGroupId: mergedGroup.id });
    // Update memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(mergedGroup.id, updatedPathData);
    paths.delete(loser.id); // Remove the loser's path if it exists
    (0, paths_1.setPathsInMemory)(room, paths);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: updatedPathData });
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
        npcGroupId: pathData.npcGroupId,
        startPosition: {
            x: myPosition.x,
            y: myPosition.y,
        },
        direction: normalizedDirection,
        pathDuration: 1000, // Short bounce duration
        velocity: 15, // Medium bounce speed
        timestamp: Date.now(),
        pathPhase: types_1.PathPhase.THROWN,
    };
    // Update the path in memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(pathData.npcGroupId, bouncePathData);
    (0, paths_1.setPathsInMemory)(room, paths);
    // Broadcast to all clients
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: bouncePathData });
}
// Handle collision between thrown NPC and captured idle NPC - emit individual NPCs
function handleCapturedNPCEmission(room, _thrownPathData, thrownNPCGroup, capturedNPCGroup, collisionPosition) {
    const emissionCount = thrownNPCGroup.fileNames.length;
    // Send interactions for both involved users
    if (capturedNPCGroup.fileNames.length > 0) {
        const emittedNPCFileName = capturedNPCGroup.fileNames[0];
        // Send THROWN_NPC_GROUP_COLLISION interaction to the thrower
        if (thrownNPCGroup.captorId && emittedNPCFileName) {
            // Process interaction asynchronously to avoid blocking game mechanics
            setImmediate(() => {
                if (thrownNPCGroup.captorId) {
                    interaction_service_1.InteractionService.handleThrownNPCCollision(room, thrownNPCGroup.captorId, thrownNPCGroup, new types_1.NPCGroup(Object.assign(Object.assign({}, capturedNPCGroup), { fileNames: [emittedNPCFileName] })));
                }
            });
        }
        // Send NPC_GROUP_EMITTED interaction to the captured group owner
        if (capturedNPCGroup.captorId && thrownNPCGroup.faceFileName && emittedNPCFileName) {
            // Process interaction asynchronously to avoid blocking game mechanics
            setImmediate(() => {
                if (capturedNPCGroup.captorId) {
                    interaction_service_1.InteractionService.handleNPCGroupEmitted(room, capturedNPCGroup.captorId, new types_1.NPCGroup(Object.assign(Object.assign({}, capturedNPCGroup), { fileNames: [emittedNPCFileName] })), thrownNPCGroup);
                }
            });
        }
    }
    // Calculate impact direction (where the thrown NPC hit from)
    const impactDirection = {
        x: collisionPosition.x - capturedNPCGroup.position.x,
        y: collisionPosition.y - capturedNPCGroup.position.y,
    };
    // Normalize impact direction
    const impactLength = Math.sqrt(impactDirection.x ** 2 + impactDirection.y ** 2);
    const normalizedImpact = impactLength > 0 ? {
        x: impactDirection.x / impactLength,
        y: impactDirection.y / impactLength,
    } : { x: 1, y: 0 }; // fallback direction
    // Create emission spread around the impact direction (like a spray pattern)
    const spreadAngle = Math.PI * 0.6; // 108° spread
    const startAngle = Math.atan2(normalizedImpact.y, normalizedImpact.x) - spreadAngle / 2;
    // Create individual NPC groups from the captured group
    const emittedNPCs = [];
    for (let i = 0; i < emissionCount; i++) {
        if (i >= capturedNPCGroup.fileNames.length)
            break; // Safety check
        // Distribute NPCs within the spread angle
        const angle = startAngle + (i / Math.max(1, emissionCount - 1)) * spreadAngle;
        const emissionDirection = {
            x: Math.cos(angle),
            y: Math.sin(angle),
        };
        const singleNPC = new types_1.NPCGroup({
            id: (0, uuid_1.v4)(),
            fileNames: [capturedNPCGroup.fileNames[i]],
            position: collisionPosition, // Start at collision point
            direction: emissionDirection, // Impact-based direction
            phase: types_1.NPCPhase.PATH, // Set to PATH phase for movement
            captorId: undefined, // Emitted NPCs are no longer captured
        });
        emittedNPCs.push(singleNPC);
    }
    // Create FLEEING paths for each emitted NPC
    const paths = (0, paths_1.getpathsfromMemory)(room);
    const emittedPaths = [];
    emittedNPCs.forEach((npc) => {
        const emittedPath = {
            id: (0, uuid_1.v4)(),
            room: room,
            npcGroupId: npc.id,
            startPosition: collisionPosition,
            direction: npc.direction, // Use the impact-based direction from the NPC
            velocity: 3.0, // Moderate emission speed
            pathDuration: 2000, // Longer duration to prevent immediate recapture
            timestamp: Date.now(),
            pathPhase: types_1.PathPhase.FLEEING,
        };
        paths.set(npc.id, emittedPath);
        emittedPaths.push(emittedPath);
    });
    // Update memory with all the new NPCs FIRST
    const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
    // Create remaining group with NPCs that weren't emitted
    const remainingNPCs = capturedNPCGroup.fileNames.slice(emissionCount);
    const updatedNPCs = [...emittedNPCs];
    if (remainingNPCs.length > 0) {
        // Update the captured group with remaining NPCs
        const restOfNPCsGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, capturedNPCGroup), { fileNames: remainingNPCs }));
        allNPCGroups.setByNpcGroupId(restOfNPCsGroup.id, restOfNPCsGroup);
        updatedNPCs.push(restOfNPCsGroup);
    }
    else {
        // If no NPCs remain, delete the original group
        allNPCGroups.deleteByNpcGroupId(capturedNPCGroup.id);
        // Include empty group to trigger deletion on frontend
        updatedNPCs.push(new types_1.NPCGroup(Object.assign(Object.assign({}, capturedNPCGroup), { fileNames: [] })));
    }
    // THEN remove the thrown NPC's path (after NPC group memory is updated)
    paths.delete(thrownNPCGroup.id);
    (0, paths_1.setPathsInMemory)(room, paths);
    // Add all emitted NPCs
    emittedNPCs.forEach(npc => {
        allNPCGroups.setByNpcGroupId(npc.id, npc);
    });
    // Also remove the thrown NPC that caused the collision
    allNPCGroups.deleteByNpcGroupId(thrownNPCGroup.id);
    updatedNPCs.push(new types_1.NPCGroup(Object.assign(Object.assign({}, thrownNPCGroup), { fileNames: [] })));
    // Save updated NPC groups
    (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
    // Broadcast all updates at once using bulk update
    (0, typed_socket_1.emitToRoom)(room, "npc-groups-bulk-update", { npcGroups: updatedNPCs });
    // Broadcast the emitted paths
    emittedPaths.forEach(pathData => {
        (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData });
    });
}
// Handle merging between fleeing NPC and idle NPC
function handleFleeingIdleMerge(room, fleeingPath, fleeingNPCGroup, idleNPCGroup, collisionPosition) {
    // Create merged group combining both groups
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, fleeingNPCGroup), { fileNames: [...fleeingNPCGroup.fileNames, ...idleNPCGroup.fileNames], position: collisionPosition, phase: types_1.NPCPhase.PATH }));
    // Update the groups in memory
    updateNPCGroupInRoom(room, mergedGroup);
    // Remove the idle NPC
    const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
    allNPCGroups.deleteByNpcGroupId(idleNPCGroup.id);
    (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
    // Update the fleeing path with the merged group
    const updatedPathData = Object.assign(Object.assign({}, fleeingPath), { npcGroupId: mergedGroup.id });
    // Update memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(mergedGroup.id, updatedPathData);
    (0, paths_1.setPathsInMemory)(room, paths);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: updatedPathData });
    (0, typed_socket_1.emitToRoom)(room, "npc-group-update", { npcGroup: new types_1.NPCGroup(Object.assign(Object.assign({}, idleNPCGroup), { fileNames: [] })) }); // Mark idle as deleted
}
// Handle merging between two fleeing NPCs
function handleFleeingFleeingMerge(room, winnerPath, winnerNPCGroup, _loserPath, loserNPCGroup, collisionPosition) {
    // Create merged group with winner's properties
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, winnerNPCGroup), { fileNames: [...winnerNPCGroup.fileNames, ...loserNPCGroup.fileNames], position: collisionPosition, phase: types_1.NPCPhase.PATH }));
    // Update groups in memory
    updateNPCGroupInRoom(room, mergedGroup);
    // Remove the loser NPC
    const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
    allNPCGroups.deleteByNpcGroupId(loserNPCGroup.id);
    (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
    // Update the winner's path data with the merged group
    const updatedPathData = Object.assign(Object.assign({}, winnerPath), { npcGroupId: mergedGroup.id });
    // Update memory
    const paths = (0, paths_1.getpathsfromMemory)(room);
    paths.set(mergedGroup.id, updatedPathData);
    paths.delete(loserNPCGroup.id); // Remove the loser's path
    (0, paths_1.setPathsInMemory)(room, paths);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: updatedPathData });
    (0, typed_socket_1.emitToRoom)(room, "npc-group-update", { npcGroup: new types_1.NPCGroup(Object.assign(Object.assign({}, loserNPCGroup), { fileNames: [] })) }); // Mark loser as deleted
}
// Handle merging between two idle NPCs
function handleIdleIdleMerge(room, npc1, npc2) {
    // Create merged group (use the larger one as base, or first one if same size)
    const size1 = npc1.fileNames.length;
    const size2 = npc2.fileNames.length;
    const winner = size1 >= size2 ? npc1 : npc2;
    const loser = size1 >= size2 ? npc2 : npc1;
    const mergedGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, winner), { fileNames: [...winner.fileNames, ...loser.fileNames], position: {
            x: (winner.position.x + loser.position.x) / 2,
            y: (winner.position.y + loser.position.y) / 2,
            z: 0
        }, phase: types_1.NPCPhase.IDLE }));
    // Update groups in memory
    updateNPCGroupInRoom(room, mergedGroup);
    // Remove the loser NPC
    const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
    allNPCGroups.deleteByNpcGroupId(loser.id);
    (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
    // Broadcast updates
    (0, typed_socket_1.emitToRoom)(room, "npc-group-update", { npcGroup: new types_1.NPCGroup(Object.assign(Object.assign({}, loser), { fileNames: [] })) }); // Mark loser as deleted
}
// Utility function to normalize direction vectors
function normalizeDirection(direction) {
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (length === 0) {
        return { x: 0, y: 0 };
    }
    return { x: direction.x / length, y: direction.y / length };
}
// Server-side fleeing logic - called when user positions are updated
function checkAndHandleNPCFleeing(room, _updatedUserId) {
    try {
        // Get all users and NPCs in the room
        const allUsers = (0, users_1.getAllUsersInRoom)(room);
        const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
        const allPaths = (0, paths_1.getpathsfromMemory)(room);
        if (allUsers.size === 0)
            return;
        // Convert users to array for easier processing
        const users = Array.from(allUsers.values());
        // Check each NPC for fleeing behavior
        Array.from(allNPCGroups.values()).forEach((npcGroup) => {
            // Only process IDLE or PATH NPCs (not captured ones)
            if (npcGroup.phase !== types_1.NPCPhase.IDLE && npcGroup.phase !== types_1.NPCPhase.PATH) {
                return;
            }
            // Skip NPCs that are captured
            if (npcGroup.captorId) {
                return;
            }
            const npcPosition = allPaths.get(npcGroup.id) ? calculatePathPosition(allPaths.get(npcGroup.id), Date.now()) : npcGroup.position;
            // Check if any user is within flee range (per-user animal scale)
            let shouldFlee = false;
            let withinCaptureRange = false;
            for (const user of users) {
                const distance = Math.sqrt((npcPosition.x - user.position.x) ** 2 +
                    (npcPosition.y - user.position.y) ** 2);
                // Calculate thresholds based on user's animal scale
                const animalScale = types_2.ANIMAL_SCALES[user.animal] || 1.0;
                const CAPTURE_THRESHOLD = animalScale * 0.1; // Reduced from 0.25 to 0.1 to prevent immediate recapture
                const FLEE_THRESHOLD = animalScale * 50.0;
                if (distance < CAPTURE_THRESHOLD) {
                    withinCaptureRange = true;
                    break; // Capture takes priority over fleeing
                }
                else if (distance < FLEE_THRESHOLD) {
                    shouldFlee = true;
                }
            }
            // Don't flee if within capture range
            if (withinCaptureRange) {
                return;
            }
            // If should flee, calculate flee direction and create flee path
            if (shouldFlee) {
                makeNPCGroupFlee(room, npcGroup, npcPosition, users, allPaths);
            }
        });
    }
    catch (error) {
        console.error("Error in checkAndHandleNPCFleeing:", error);
    }
}
// Create fleeing path for an NPC (server-side version of frontend logic)
function makeNPCGroupFlee(room, npcGroup, npcPosition, users, allPaths) {
    try {
        // Get current path data
        const currentPathData = allPaths.get(npcGroup.id);
        // Calculate flee direction from all nearby users using weighted averaging
        let totalFleeForce = { x: 0, y: 0 };
        let totalWeight = 0;
        // Check all users for flee influence
        users.forEach((user) => {
            const distance = Math.sqrt((npcPosition.x - user.position.x) ** 2 +
                (npcPosition.y - user.position.y) ** 2);
            // Calculate flee direction away from this user
            const fleeDirection = {
                x: npcPosition.x - user.position.x,
                y: npcPosition.y - user.position.y,
            };
            // Normalize the flee direction
            const length = Math.sqrt(fleeDirection.x ** 2 + fleeDirection.y ** 2);
            if (length > 0) {
                fleeDirection.x /= length;
                fleeDirection.y /= length;
                // Weight inversely by distance (closer users have more influence)
                const weight = 1.0 / (distance * distance);
                totalFleeForce.x += fleeDirection.x * weight;
                totalFleeForce.y += fleeDirection.y * weight;
                totalWeight += weight;
            }
        });
        // If no flee forces, don't create a flee path
        if (totalWeight === 0) {
            return;
        }
        // Average the flee forces
        const averageFleeDirection = {
            x: totalFleeForce.x / totalWeight,
            y: totalFleeForce.y / totalWeight,
        };
        // Normalize the final direction
        let finalFleeDirection = normalizeDirection(averageFleeDirection);
        // If normalization failed (zero vector), use fallback
        if (finalFleeDirection.x === 0 && finalFleeDirection.y === 0 && users.length > 0) {
            // Fallback to flee from first user
            finalFleeDirection = normalizeDirection({
                x: npcPosition.x - users[0].position.x,
                y: npcPosition.y - users[0].position.y,
            });
        }
        // Add stability: if already fleeing, blend with current direction
        if (currentPathData && currentPathData.pathPhase === types_1.PathPhase.FLEEING) {
            const timeSinceLastUpdate = Date.now() - currentPathData.timestamp;
            const MIN_UPDATE_INTERVAL = 300; // Update more frequently but still stable
            // Only update if enough time has passed
            if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
                return;
            }
            // Blend current direction with new flee direction for stability
            const currentDir = currentPathData.direction;
            finalFleeDirection = normalizeDirection({
                x: currentDir.x * 0.4 + finalFleeDirection.x * 0.6,
                y: currentDir.y * 0.4 + finalFleeDirection.y * 0.6,
            });
        }
        // Calculate fleeing speed based on group size (larger groups move faster)
        const groupSize = npcGroup.fileNames.length;
        const baseFleeSpeed = 2.0;
        const fleeVelocity = baseFleeSpeed + Math.sqrt(groupSize) * 0.5; // Larger groups get speed bonus
        // Create new path data
        const newPathData = currentPathData
            ? Object.assign(Object.assign({}, currentPathData), { startPosition: {
                    x: npcPosition.x,
                    y: npcPosition.y,
                }, direction: finalFleeDirection, timestamp: Date.now(), pathPhase: types_1.PathPhase.FLEEING, velocity: fleeVelocity }) : {
            // create new path data
            id: (0, uuid_1.v4)(),
            room: room,
            npcGroupId: npcGroup.id,
            startPosition: {
                x: npcPosition.x,
                y: npcPosition.y,
            },
            pathDuration: 1500,
            timestamp: Date.now(),
            direction: finalFleeDirection,
            velocity: fleeVelocity, // Speed proportional to group size
            pathPhase: types_1.PathPhase.FLEEING,
        };
        // Update paths in memory
        const paths = (0, paths_1.getpathsfromMemory)(room);
        paths.set(npcGroup.id, newPathData);
        (0, paths_1.setPathsInMemory)(room, paths);
        // Update NPC to PATH phase
        if (npcGroup.phase !== types_1.NPCPhase.PATH) {
            const updatedNpcGroup = new types_1.NPCGroup(Object.assign(Object.assign({}, npcGroup), { phase: types_1.NPCPhase.PATH }));
            updateNPCGroupInRoom(room, updatedNpcGroup);
        }
        // Broadcast the flee path to all clients
        (0, typed_socket_1.emitToRoom)(room, "path-update", { pathData: newPathData });
    }
    catch (error) {
        console.error("Error in makeNPCGroupFlee:", error);
    }
}
// Check for fleeing NPCs that have traveled far outside terrain boundaries and delete them
function checkAndDeleteFleeingNPCs(room) {
    try {
        const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
        const allPaths = (0, paths_1.getpathsfromMemory)(room);
        const terrainConfig = (0, terrain_1.getTerrainConfig)(room);
        // Define distance outside terrain boundaries where NPCs should be deleted
        const DELETION_DISTANCE = 10; // Hardcoded distance outside terrain bounds
        Array.from(allNPCGroups.values()).forEach((npcGroup) => {
            // Only check NPCs in PATH phase
            if (npcGroup.phase !== types_1.NPCPhase.PATH) {
                return;
            }
            // Check ALL NPCs on paths (fleeing, thrown, returning)
            const pathData = allPaths.get(npcGroup.id);
            if (!pathData) {
                return;
            }
            // Calculate current position of the NPC
            const currentPosition = calculatePathPosition(pathData, Date.now());
            // Check if NPC is far outside terrain boundaries
            const outsideDistance = calculateDistanceOutsideTerrain(currentPosition, terrainConfig);
            if (outsideDistance >= DELETION_DISTANCE) {
                // Send interaction for deleted thrown/returning NPC if applicable
                if (npcGroup.captorId && (pathData.pathPhase === types_1.PathPhase.THROWN || pathData.pathPhase === types_1.PathPhase.RETURNING)) {
                    // Process interaction asynchronously to avoid blocking game mechanics
                    setImmediate(() => {
                        if (npcGroup.captorId) {
                            interaction_service_1.InteractionService.handleNPCGroupDeleted(room, npcGroup.captorId, npcGroup, pathData.pathPhase);
                        }
                    });
                }
                // Delete the NPC group from memory
                allNPCGroups.deleteByNpcGroupId(npcGroup.id);
                // Delete the path from memory
                allPaths.delete(npcGroup.id);
                // Save updated states to memory
                (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
                (0, paths_1.setPathsInMemory)(room, allPaths);
                // Emit deletion event to room with current position, ownership, and path phase
                console.log("🗑️ Sending npc-group-deleted to room:", room, {
                    npcGroupId: npcGroup.id,
                    currentPosition: currentPosition,
                    captorId: npcGroup.captorId,
                    pathPhase: pathData.pathPhase,
                    faceFileName: npcGroup.faceFileName
                });
                (0, typed_socket_1.emitToRoom)(room, "npc-group-deleted", {
                    npcGroupId: npcGroup.id,
                    currentPosition: currentPosition,
                    captorId: npcGroup.captorId,
                    pathPhase: pathData.pathPhase,
                    faceFileName: npcGroup.faceFileName
                });
            }
        });
    }
    catch (error) {
        console.error("Error in checkAndDeleteFleeingNPCs:", error);
    }
}
// Calculate how far outside terrain boundaries a position is (returns 0 if inside)
function calculateDistanceOutsideTerrain(position, terrainConfig) {
    const { boundaries } = terrainConfig;
    // Calculate distance outside each boundary
    const leftDistance = boundaries.minX - position.x; // positive if outside left
    const rightDistance = position.x - boundaries.maxX; // positive if outside right
    const bottomDistance = boundaries.minY - position.y; // positive if outside bottom
    const topDistance = position.y - boundaries.maxY; // positive if outside top
    // Find the maximum distance outside any boundary
    const maxDistance = Math.max(0, leftDistance, rightDistance, bottomDistance, topDistance);
    return maxDistance;
}
// Check and spawn NPCs to maintain population of 4 * user count
function checkAndSpawnNPCs(room) {
    try {
        const allNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
        const currentCount = allNPCGroups.size;
        const currentCumulativeSize = allNPCGroups.cumulativeSize;
        // Calculate target NPC count based on user count
        const allUsers = (0, users_1.getAllUsersInRoom)(room);
        const userCount = allUsers.size;
        const targetNPCCount = userCount * 4;
        console.log(`Spawn check for ${room}: users=${userCount}, currentNPCs=${currentCount}, targetNPCs=${targetNPCCount}, cumulativeSize=${currentCumulativeSize}`);
        // If we have too many NPCs, remove excess uncaptured idle NPCs
        if (currentCount > targetNPCCount) {
            const excessCount = currentCount - targetNPCCount;
            const idleNPCs = Array.from(allNPCGroups.values()).filter(npc => npc.phase === types_1.NPCPhase.IDLE && !npc.captorId);
            // Remove excess NPCs (prioritize smaller groups)
            const npcsToRemove = idleNPCs
                .sort((a, b) => a.fileNames.length - b.fileNames.length)
                .slice(0, excessCount);
            npcsToRemove.forEach(npc => {
                allNPCGroups.deleteByNpcGroupId(npc.id);
                (0, typed_socket_1.emitToRoom)(room, "npc-group-update", { npcGroup: new types_1.NPCGroup(Object.assign(Object.assign({}, npc), { fileNames: [] })) });
            });
            (0, npc_groups_1.setNPCGroupsInMemory)(room, allNPCGroups);
        }
        // If we have too few NPCs, spawn new ones
        else if (currentCount < targetNPCCount && currentCumulativeSize < MAX_CUMULATIVE_SIZE) {
            const maxByGroupCount = targetNPCCount - currentCount;
            const maxByCumulativeSize = MAX_CUMULATIVE_SIZE - currentCumulativeSize;
            const spawnCount = Math.min(maxByGroupCount, maxByCumulativeSize); // Each new group adds 1 to cumulative size
            if (spawnCount > 0) {
                // Get terrain boundaries for proper spawning
                const terrainConfig = (0, terrain_1.getTerrainConfig)(room);
                const terrainBoundaries = terrainConfig.boundaries;
                console.log(`Spawning ${spawnCount} NPCs for room ${room}`);
                for (let i = 0; i < spawnCount; i++) {
                    const newNPCGroup = createSingleNPCGroup(terrainBoundaries);
                    console.log(`Created NPC ${newNPCGroup.id} with filename ${newNPCGroup.faceFileName}`);
                    // Add NPC to memory and broadcast update immediately
                    const currentNPCGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(room);
                    currentNPCGroups.setByNpcGroupId(newNPCGroup.id, newNPCGroup);
                    (0, npc_groups_1.setNPCGroupsInMemory)(room, currentNPCGroups);
                    (0, typed_socket_1.emitToRoom)(room, "npc-group-update", { npcGroup: newNPCGroup });
                }
            }
        }
    }
    catch (error) {
        console.error("Error in checkAndSpawnNPCs:", error);
    }
}
