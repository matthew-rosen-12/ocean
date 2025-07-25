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
exports.GAME_DURATION = void 0;
exports.startGameTimer = startGameTimer;
exports.stopGameTimer = stopGameTimer;
exports.isGameActive = isGameActive;
exports.getGameStartTime = getGameStartTime;
exports.getRemainingTime = getRemainingTime;
exports.cleanupGameTimer = cleanupGameTimer;
const users_1 = require("./state/users");
const npc_groups_1 = require("./state/npc-groups");
const game_data_cleaner_1 = require("./game-data-cleaner");
const typed_socket_1 = require("./typed-socket");
// Map of room names to their game timers
const gameTimers = new Map();
exports.GAME_DURATION = 1.5 * 60 * 10 * 5; // 1.5 minutes in milliseconds
function startGameTimer(roomName) {
    // Don't start a new timer if one already exists for this room
    if (gameTimers.has(roomName)) {
        return;
    }
    const startTime = Date.now();
    const timeoutId = setTimeout(() => {
        handleGameEnd(roomName);
    }, exports.GAME_DURATION);
    const gameTimer = {
        startTime,
        duration: exports.GAME_DURATION,
        timeoutId,
        roomName,
    };
    gameTimers.set(roomName, gameTimer);
}
function stopGameTimer(roomName) {
    const gameTimer = gameTimers.get(roomName);
    if (gameTimer) {
        clearTimeout(gameTimer.timeoutId);
        gameTimers.delete(roomName);
    }
}
function calculateFinalScores(roomName) {
    const finalScores = {};
    const users = (0, users_1.getAllUsersInRoom)(roomName);
    const npcGroups = (0, npc_groups_1.getNPCGroupsfromMemory)(roomName);
    // Calculate scores based on NPC count for each user
    users.forEach((user) => {
        var _a;
        const userNpcGroup = npcGroups.getByUserId(user.id);
        const npcCount = ((_a = userNpcGroup === null || userNpcGroup === void 0 ? void 0 : userNpcGroup.fileNames) === null || _a === void 0 ? void 0 : _a.length) || 0;
        finalScores[user.id] = npcCount;
    });
    return finalScores;
}
function handleGameEnd(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Calculate final scores before clearing data
            const finalScores = calculateFinalScores(roomName);
            // Emit times-up event to all clients in the room
            (0, typed_socket_1.emitToRoom)(roomName, "times-up", { finalScores });
            // Clean up the timer
            gameTimers.delete(roomName);
            // Clear all game data after a short delay to allow clients to process the event
            setTimeout(() => {
                (0, game_data_cleaner_1.clearAllGameData)(roomName);
            }, 1000);
        }
        catch (error) {
            console.error(`Error handling game end for room ${roomName}:`, error);
        }
    });
}
function isGameActive(roomName) {
    return gameTimers.has(roomName);
}
function getGameStartTime(roomName) {
    const gameTimer = gameTimers.get(roomName);
    return gameTimer ? gameTimer.startTime : null;
}
function getRemainingTime(roomName) {
    const gameTimer = gameTimers.get(roomName);
    if (!gameTimer)
        return null;
    const elapsed = Date.now() - gameTimer.startTime;
    const remaining = Math.max(0, gameTimer.duration - elapsed);
    return remaining;
}
// Clean up timer when room is deleted
function cleanupGameTimer(roomName) {
    stopGameTimer(roomName);
}
