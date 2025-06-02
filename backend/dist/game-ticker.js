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
const npcService_1 = require("./services/npcService");
const config_1 = require("./db/config");
const types_1 = require("./types");
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
                const roomNames = yield (0, config_1.getAllRoomsfromMemory)();
                // Process each room
                for (const roomName of roomNames) {
                    // Get paths for this room
                    const paths = yield (0, config_1.getActivepathsfromMemory)(roomName);
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
                        const npcs = yield (0, config_1.getNPCsfromMemory)(roomName);
                        const currentNpc = npcs.get(completedpath.npc.id);
                        // Only complete path if NPC is still in PATH phase
                        if (currentNpc && currentNpc.phase === types_1.NPCPhase.path) {
                            yield (0, npcService_1.setPathCompleteInRoom)(roomName, completedpath.npc);
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
