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
const rooms_1 = require("./state/rooms");
const paths_1 = require("./state/paths");
const npc_groups_1 = require("./state/npc-groups");
let gameTickerInstance = null;
function getGameTicker() {
    if (!gameTickerInstance) {
        gameTickerInstance = new GameTicker();
    }
    return gameTickerInstance;
}
class GameTicker {
    constructor() {
        this.tickRate = 100; // ms between ticks (10 ticks per second)
        this.tickInterval = null;
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
                // Process each room
                for (const roomName of roomNames) {
                    // Always check for collisions first (for thrown paths)
                    (0, npc_group_service_1.checkAndHandleNPCCollisions)(roomName);
                    // Get paths for this room
                    const allPaths = (0, paths_1.getpathsfromMemory)(roomName);
                    // filter paths that are not thrown or returning (for completion checking)
                    // Include FLEEING paths for completion checking
                    const paths = Array.from(allPaths.values()).filter((path) => path.pathPhase !== types_1.PathPhase.THROWN && path.pathPhase !== types_1.PathPhase.RETURNING);
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
            // Schedule next tick
            this.tickInterval = setTimeout(() => this.tick(), this.tickRate);
        });
    }
    cleanup() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
}
