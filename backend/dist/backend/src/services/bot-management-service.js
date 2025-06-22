"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotManagementService = void 0;
const types_1 = require("shared/types");
const users_1 = require("../state/users");
const npc_groups_1 = require("../state/npc-groups");
const paths_1 = require("../state/paths");
const typed_socket_1 = require("../typed-socket");
const uuid_1 = require("uuid");
/**
 * Manages bot users - creation, spawning, and lifecycle
 */
class BotManagementService {
    /**
     * Start bot spawning process for a room
     */
    static startBotSpawning(roomName) {
        // Clean up any existing timer for this room
        this.stopBotSpawning(roomName);
        const roomStartTime = Date.now();
        // Set initial spawn timer (5 seconds after room creation)
        const initialTimer = setTimeout(() => {
            this.spawnBotIfNeeded(roomName, roomStartTime);
        }, this.INITIAL_SPAWN_DELAY);
        this.botSpawnTimers.set(roomName, {
            roomName,
            timer: initialTimer,
            spawnCount: 0,
            roomStartTime
        });
    }
    /**
     * Stop bot spawning for a room
     */
    static stopBotSpawning(roomName) {
        const timerData = this.botSpawnTimers.get(roomName);
        if (timerData) {
            clearTimeout(timerData.timer);
            this.botSpawnTimers.delete(roomName);
        }
    }
    /**
     * Spawn a bot if conditions are met, then schedule next spawn
     */
    static spawnBotIfNeeded(roomName, roomStartTime) {
        const currentTime = Date.now();
        const roomAge = currentTime - roomStartTime;
        // Stop spawning if room is older than 30 seconds
        if (roomAge >= this.MAX_SPAWN_DURATION) {
            this.stopBotSpawning(roomName);
            return;
        }
        // Check current user count
        const currentUsers = (0, users_1.getAllUsersInRoom)(roomName);
        if (currentUsers.size >= this.MAX_USERS_PER_ROOM) {
            this.stopBotSpawning(roomName);
            return;
        }
        // Spawn a bot
        const bot = this.createBot(roomName);
        (0, users_1.addUserToRoom)(roomName, bot);
        // Initialize bot movement state
        this.botMovementStates.set(bot.id, {
            currentKeys: { up: false, down: false, left: false, right: false },
            keyHoldDuration: 0,
            maxHoldDuration: 0
        });
        // Broadcast bot join to all clients in room
        console.log(`Broadcasting bot join for ${bot.nickname} to room ${roomName}`);
        (0, typed_socket_1.emitToRoom)(roomName, "user-joined", { user: bot });
        console.log(`Bot ${bot.nickname} spawned in room ${roomName}. Total users: ${currentUsers.size + 1}`);
        // Schedule next spawn
        const timerData = this.botSpawnTimers.get(roomName);
        if (timerData) {
            timerData.spawnCount++;
            const nextTimer = setTimeout(() => {
                this.spawnBotIfNeeded(roomName, roomStartTime);
            }, this.BOT_SPAWN_INTERVAL);
            timerData.timer = nextTimer;
            this.botSpawnTimers.set(roomName, timerData);
        }
    }
    /**
     * Create a new bot user
     */
    static createBot(roomName) {
        const botId = `bot-${(0, uuid_1.v4)()}`;
        const randomAnimal = this.BOT_ANIMALS[Math.floor(Math.random() * this.BOT_ANIMALS.length)];
        // Generate random position within reasonable bounds
        const position = {
            x: (Math.random() - 0.5) * 100, // Random position between -50 and 50
            y: (Math.random() - 0.5) * 100
        };
        const bot = {
            id: botId,
            animal: randomAnimal,
            room: roomName,
            position: position,
            direction: { x: 0, y: 0 },
            nickname: this.generateBotNickname()
        };
        return bot;
    }
    /**
     * Generate a random nickname for bots
     */
    static generateBotNickname() {
        const adjectives = ['Swift', 'Clever', 'Brave', 'Quick', 'Wild', 'Sneaky', 'Fierce', 'Agile'];
        const nouns = ['Hunter', 'Explorer', 'Wanderer', 'Seeker', 'Ranger', 'Scout', 'Tracker', 'Roamer'];
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 99) + 1;
        return `${adjective}${noun}${number}`;
    }
    /**
     * Check if a user is a bot
     */
    static isBot(userId) {
        return userId.startsWith('bot-');
    }
    /**
     * Get all bot users in a room
     */
    static getBotsInRoom(roomName) {
        const allUsers = (0, users_1.getAllUsersInRoom)(roomName);
        return Array.from(allUsers.values()).filter(user => this.isBot(user.id));
    }
    /**
     * Update bot position mimicking frontend movement logic
     * Simulates arrow key presses based on strategic AI behavior
     */
    static updateBotPosition(bot, roomName) {
        const MOVEMENT_SPEED = 0.5; // Same as frontend
        let targetPosition = null;
        // Get or initialize bot movement state
        let movementState = this.botMovementStates.get(bot.id);
        if (!movementState) {
            movementState = {
                currentKeys: { up: false, down: false, left: false, right: false },
                keyHoldDuration: 0,
                maxHoldDuration: 0
            };
            this.botMovementStates.set(bot.id, movementState);
        }
        // Get bot's current captured group status
        const botHasCapturedGroup = this.botHasCapturedNPCs(bot.id, roomName);
        if (!botHasCapturedGroup) {
            // Phase 1: Hunt for IDLE or PATH NPCs
            targetPosition = this.findNearestTargetNPC(bot, roomName);
        }
        else {
            // Phase 2: Find other users with captured groups to attack
            targetPosition = this.findNearestUserWithCapturedNPCs(bot, roomName);
        }
        // Determine key presses based on target or wandering
        let up = false, down = false, left = false, right = false;
        if (targetPosition) {
            const dx = targetPosition.x - bot.position.x;
            const dy = targetPosition.y - bot.position.y;
            // Only move if target is far enough
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                // Simulate pressing arrow keys toward target with larger thresholds to prevent twitching
                if (dy > 0.5)
                    up = true;
                if (dy < -0.5)
                    down = true;
                if (dx > 0.5)
                    right = true;
                if (dx < -0.5)
                    left = true;
            }
            // Reset wandering state when targeting
            movementState.keyHoldDuration = 0;
            movementState.maxHoldDuration = 0;
        }
        else {
            // Wandering logic with persistent key holds
            if (movementState.keyHoldDuration <= 0) {
                // Time to pick new keys to hold
                movementState.currentKeys = { up: false, down: false, left: false, right: false };
                // 30% chance to move in a direction (vs standing still)
                if (Math.random() < 0.3) {
                    const randomDirection = Math.floor(Math.random() * 4);
                    switch (randomDirection) {
                        case 0:
                            movementState.currentKeys.up = true;
                            break;
                        case 1:
                            movementState.currentKeys.down = true;
                            break;
                        case 2:
                            movementState.currentKeys.left = true;
                            break;
                        case 3:
                            movementState.currentKeys.right = true;
                            break;
                    }
                    // Hold key for 100-300 ticks (5-15 seconds at 20 ticks/sec)
                    movementState.maxHoldDuration = Math.floor(Math.random() * 200) + 100;
                }
                else {
                    // Stand still for 40-120 ticks (2-6 seconds at 20 ticks/sec)
                    movementState.maxHoldDuration = Math.floor(Math.random() * 80) + 40;
                }
                movementState.keyHoldDuration = movementState.maxHoldDuration;
            }
            // Use current held keys
            up = movementState.currentKeys.up;
            down = movementState.currentKeys.down;
            left = movementState.currentKeys.left;
            right = movementState.currentKeys.right;
            // Decrement hold duration
            movementState.keyHoldDuration--;
        }
        // Calculate movement change (mimicking frontend logic)
        const change = { x: 0, y: 0 };
        if (up)
            change.y += MOVEMENT_SPEED;
        if (down)
            change.y -= MOVEMENT_SPEED;
        if (left)
            change.x -= MOVEMENT_SPEED;
        if (right)
            change.x += MOVEMENT_SPEED;
        // Calculate new direction (mimicking frontend logic exactly)
        let newDirection = { x: 0, y: 0 };
        // Pure vertical movement - use direction offset like frontend
        if (!left && !right && up && !down) {
            newDirection = {
                x: bot.direction.x > 0 ? types_1.DIRECTION_OFFSET : -types_1.DIRECTION_OFFSET,
                y: 1,
            };
        }
        else if (!left && !right && !up && down) {
            newDirection = {
                x: bot.direction.x > 0 ? types_1.DIRECTION_OFFSET : -types_1.DIRECTION_OFFSET,
                y: -1,
            };
        }
        else {
            // All other movement patterns (including pure horizontal) - use += logic like frontend
            if (left && !right) {
                newDirection.x -= 1;
            }
            else if (right && !left) {
                newDirection.x += 1;
            }
            if (up && !down) {
                newDirection.y += 1;
            }
            else if (down && !up) {
                newDirection.y -= 1;
            }
        }
        // Normalize diagonal movement to maintain consistent speed (matching frontend)
        if (newDirection.x !== 0 && newDirection.y !== 0) {
            const length = Math.sqrt(newDirection.x * newDirection.x + newDirection.y * newDirection.y);
            newDirection.x /= length;
            newDirection.y /= length;
        }
        // Only update direction if there's actual movement (matching frontend)
        if (change.x !== 0 || change.y !== 0) {
            bot.direction = newDirection;
        }
        // Apply position change
        if (change.x !== 0 || change.y !== 0) {
            bot.position.x += change.x;
            bot.position.y += change.y;
            // Keep bots within reasonable bounds (simple boundary collision)
            bot.position.x = Math.max(-100, Math.min(100, bot.position.x));
            bot.position.y = Math.max(-100, Math.min(100, bot.position.y));
        }
    }
    /**
     * Check if bot has captured NPCs
     */
    static botHasCapturedNPCs(botId, roomName) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return false;
        const botNpcGroup = npcGroups.getByUserId(botId);
        return !!(botNpcGroup && botNpcGroup.fileNames.length > 0);
    }
    /**
     * Find nearest IDLE or PATH NPC for bot to capture
     */
    static findNearestTargetNPC(bot, roomName) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (!npcGroups)
            return null;
        let nearestNPC = null;
        let nearestDistance = Infinity;
        // Find nearest IDLE or PATH NPC
        for (const npcGroup of npcGroups.values()) {
            if (npcGroup.phase === types_1.NPCPhase.IDLE || npcGroup.phase === types_1.NPCPhase.PATH) {
                const distance = this.calculateDistance(bot.position, npcGroup.position);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestNPC = npcGroup.position;
                }
            }
        }
        return nearestNPC;
    }
    /**
     * Find nearest user with captured NPCs to attack
     */
    static findNearestUserWithCapturedNPCs(bot, roomName) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        const allUsers = (0, users_1.getAllUsersInRoom)(roomName);
        if (!npcGroups || !allUsers)
            return null;
        let nearestUser = null;
        let nearestDistance = Infinity;
        // Find nearest user (including other bots) with captured NPCs
        for (const [userId, user] of allUsers) {
            // Skip only the current bot itself
            if (userId === bot.id)
                continue;
            const userNpcGroup = npcGroups.getByUserId(userId);
            if (userNpcGroup && userNpcGroup.fileNames.length > 0) {
                const distance = this.calculateDistance(bot.position, user.position);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestUser = user.position;
                }
            }
        }
        return nearestUser;
    }
    /**
     * Check if bot should throw its captured group at nearby users
     * Returns true if throw was executed
     */
    static checkAndExecuteBotThrow(bot, roomName) {
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        const allUsers = (0, users_1.getAllUsersInRoom)(roomName);
        if (!npcGroups || !allUsers)
            return false;
        // Check if bot has captured NPCs
        const botNpcGroup = npcGroups.getByUserId(bot.id);
        if (!botNpcGroup || botNpcGroup.fileNames.length === 0)
            return false;
        // Find nearby users with captured NPCs
        for (const [userId, user] of allUsers) {
            // Skip only the current bot itself
            if (userId === bot.id)
                continue;
            const userNpcGroup = npcGroups.getByUserId(userId);
            if (userNpcGroup && userNpcGroup.fileNames.length > 0) {
                const distance = this.calculateDistance(bot.position, user.position);
                // Calculate dynamic throw range based on animal scales
                const botScale = types_1.ANIMAL_SCALES[bot.animal] || 1.0;
                const targetScale = types_1.ANIMAL_SCALES[user.animal] || 1.0;
                const THROW_RANGE = (botScale + targetScale) * 20.0; // Combined scale factor
                if (distance <= THROW_RANGE) {
                    // Execute throw at this user
                    this.executeBotThrow(bot, user, botNpcGroup, roomName);
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Execute bot throw at target user
     */
    static executeBotThrow(bot, targetUser, botNpcGroup, roomName) {
        // Calculate throw direction
        const direction = {
            x: targetUser.position.x - bot.position.x,
            y: targetUser.position.y - bot.position.y
        };
        // Normalize direction
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (magnitude > 0) {
            direction.x /= magnitude;
            direction.y /= magnitude;
        }
        // Create path data for the throw
        const throwPath = {
            id: (0, uuid_1.v4)(),
            room: roomName,
            npcGroupId: botNpcGroup.id,
            startPosition: { x: bot.position.x, y: bot.position.y },
            direction: direction,
            velocity: 1.0, // Throw speed
            pathDuration: 3000, // 3 seconds flight time
            timestamp: Date.now(),
            pathPhase: types_1.PathPhase.THROWN
        };
        // Update NPC group to PATH phase
        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
        if (npcGroups) {
            botNpcGroup.phase = types_1.NPCPhase.PATH;
            botNpcGroup.captorId = undefined; // Released from bot
            npcGroups.setByNpcGroupId(botNpcGroup.id, botNpcGroup);
            (0, npc_groups_1.setNPCGroupsInMemory)(roomName, npcGroups);
        }
        // Add path to memory
        const roomPaths = (0, paths_1.getpathsfromMemory)(roomName);
        roomPaths.set(throwPath.npcGroupId, throwPath);
        (0, paths_1.setPathsInMemory)(roomName, roomPaths);
        // Broadcast throw to all clients
        (0, typed_socket_1.emitToRoom)(roomName, "npc-group-update", { npcGroup: botNpcGroup });
        (0, typed_socket_1.emitToRoom)(roomName, "path-update", { pathData: throwPath });
        console.log(`Bot ${bot.nickname} threw NPCs at ${targetUser.nickname}`);
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
exports.BotManagementService = BotManagementService;
BotManagementService.botSpawnTimers = new Map();
BotManagementService.botMovementStates = new Map();
BotManagementService.MAX_USERS_PER_ROOM = 8;
BotManagementService.BOT_SPAWN_INTERVAL = 5000; // 5 seconds
BotManagementService.INITIAL_SPAWN_DELAY = 5000; // 5 seconds after room creation
BotManagementService.MAX_SPAWN_DURATION = 30000; // 30 seconds total
// Available animals for bots - use all animals from the enum
BotManagementService.BOT_ANIMALS = Object.values(types_1.Animal);
