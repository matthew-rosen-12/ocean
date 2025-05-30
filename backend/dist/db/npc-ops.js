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
exports.updateNPCInRoomInRedis = updateNPCInRoomInRedis;
exports.updateNPCGroupInRoomInRedis = updateNPCGroupInRoomInRedis;
const config_1 = require("./config");
function updateNPCInRoomInRedis(roomName, npc) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get current NPCs using the direct Map access
            const npcs = yield (0, config_1.getNPCsFromRedis)(roomName);
            // Update NPC in the map
            npcs.set(npc.id, npc);
            // Save back using direct Map access
            yield (0, config_1.setNPCsInRedis)(roomName, npcs);
        }
        catch (error) {
            console.error(`Error updating NPC in room ${roomName}:`, error);
            throw error;
        }
    });
}
function updateNPCGroupInRoomInRedis(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get current groups using direct Map access
            const groups = yield (0, config_1.getNPCGroupsFromRedis)(roomName);
            // Update the group
            const group = groups.get(captorId) || { npcIds: new Set(), captorId };
            if (!group.npcIds.has(npcId)) {
                group.npcIds.add(npcId);
            }
            groups.set(captorId, group);
            // Save back using direct Map access
            yield (0, config_1.setNPCGroupsInRedis)(roomName, groups);
        }
        catch (error) {
            console.error(`Error updating NPC group in room ${roomName}:`, error);
            throw error;
        }
    });
}
