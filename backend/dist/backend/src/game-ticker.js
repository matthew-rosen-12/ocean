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
exports.getGameTicker = getGameTicker;
const types_1 = require("shared/types");
const npc_group_service_1 = require("./services/npc-group-service");
const bot_collision_service_1 = require("./services/bot-collision-service");
const bot_management_service_1 = require("./services/bot-management-service");
const typed_socket_1 = require("./typed-socket");
const rooms_1 = require("./state/rooms");
const paths_1 = require("./state/paths");
const npc_groups_1 = require("./state/npc-groups");
const users_1 = require("./state/users");
const timers_1 = require("timers");
let gameTickerInstance = null;
function getGameTicker() {
    if (!gameTickerInstance) {
        gameTickerInstance = new GameTicker();
    }
    return gameTickerInstance;
}
class GameTicker {
    constructor() {
        this.tickRate = 50; // ms between ticks (20 ticks per second) - faster for smoother bots
        this.tickInterval = null;
        this.botUpdateCounter = 0;
        this.spawnCheckCounter = 0;
        this.SPAWN_CHECK_INTERVAL = 20; // Check spawning every 20 ticks (1 second at 20 ticks/second)
        this.startTicker();
    }
    startTicker() {
        this.tick();
    }
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get all room names
                const roomNames = (0, rooms_1.getAllRoomsfromMemory)();
                this.spawnCheckCounter++;
                // 
                // Check if we should run spawn checks this tick
                const shouldRunSpawnCheck = this.spawnCheckCounter >= this.SPAWN_CHECK_INTERVAL;
                // Process each room
                for (const roomName of roomNames) {
                    // Always check for collisions first (for thrown paths)
                    (0, npc_group_service_1.checkAndHandleNPCCollisions)(roomName);
                    // Process bot users: movement and collision detection 
                    this._processBots(roomName);
                    // Check for NPC fleeing after bot movement (same as for human players)
                    (0, npc_group_service_1.checkAndHandleNPCFleeing)(roomName);
                    // Check for fleeing NPCs that are far outside terrain boundaries and delete them
                    (0, npc_group_service_1.checkAndDeleteFleeingNPCs)(roomName);
                    // Check if we need to spawn new NPCs (once per second)
                    if (shouldRunSpawnCheck) {
                        (0, npc_group_service_1.checkAndSpawnNPCs)(roomName);
                    }
                    // Get paths for this room
                    const allPaths = (0, paths_1.getpathsfromMemory)(roomName);
                    // Include all paths for completion checking (server handles all transitions)
                    const paths = Array.from(allPaths.values());
                    if (!paths || paths.length === 0)
                        continue;
                    const completedpaths = [];
                    // Use forEach instead of filter to separate active and completed paths
                    paths.forEach((pathData) => {
                        const now = Date.now();
                        const pathEndTime = pathData.timestamp + pathData.pathDuration;
                        if (now >= pathEndTime) {
                            // path is complete
                            completedpaths.push(pathData);
                        }
                    });
                    // Process completed paths
                    for (const completedpath of completedpaths) {
                        // Get current NPC state to check if it's still in PATH phase
                        const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
                        const npcGroup = npcGroups.getByNpcGroupId(completedpath.npcGroupId);
                        // Only complete path if NPC is still in PATH phase
                        if (npcGroup && npcGroup.phase === types_1.NPCPhase.PATH) {
                            (0, npc_group_service_1.setPathCompleteInRoom)(roomName, npcGroup);
                        }
                    }
                }
            }
            catch (error) {
                console.error("Error in game ticker:", error);
            }
            // Increment counters
            this.botUpdateCounter++;
            // Reset spawn check counter if reached interval
            if (this.spawnCheckCounter >= this.SPAWN_CHECK_INTERVAL) {
                this.spawnCheckCounter = 0;
            }
            // Schedule next tick
            this.tickInterval = (0, timers_1.setTimeout)(() => this.tick(), this.tickRate);
        });
    }
    _processBots(roomName) {
        const bots = bot_management_service_1.BotManagementService.getBotsInRoom(roomName);
        for (const bot of bots) {
            // Check if bot should throw captured NPCs at nearby users
            const didThrow = bot_management_service_1.BotManagementService.checkAndExecuteBotThrow(bot, roomName);
            // Only update position if bot didn't throw (throwing stops movement briefly)
            if (!didThrow) {
                // Update bot position (strategic movement AI)
                bot_management_service_1.BotManagementService.updateBotPosition(bot, roomName);
            }
            // Check for collisions with NPCs (commented out for now)
            bot_collision_service_1.BotCollisionService.checkBotCollisions(roomName, bot);
            // Update bot in room state
            (0, users_1.updateUserInRoom)(roomName, bot);
            // Broadcast bot position update to all clients
            (0, typed_socket_1.emitToRoom)(roomName, "user-updated", { user: bot });
        }
    }
    cleanup() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
}
