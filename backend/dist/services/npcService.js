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
const types_1 = require("../types");
const user_info_1 = require("../user-info");
const uuid_1 = require("uuid");
// Redis Key prefixes for different data types
const NUM_NPCS = 4;
const server_1 = require("../server");
const config_1 = require("../db/config");
const npc_ops_1 = require("../db/npc-ops");
const serializers_1 = require("../utils/serializers");
function updateNPCInRoom(roomName, npc) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, npc_ops_1.updateNPCInRoomInRedis)(roomName, npc);
        server_1.io.to(roomName).emit("npc-update", (0, serializers_1.serialize)({ npc }));
    });
}
function updateNPCGroupInRoom(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, npc_ops_1.updateNPCGroupInRoomInRedis)(roomName, captorId, npcId);
        server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({ groupId: captorId, npcId }));
    });
}
function removeNPCFromGroupInRoom(roomName, captorId, npcId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, config_1.removeNPCFromGroupInRoomInRedis)(roomName, captorId, npcId);
        server_1.io.to(roomName).emit("group-update", (0, serializers_1.serialize)({
            groupId: captorId,
            npcId,
            removed: true,
        }));
    });
}
function calculateLandingPosition(pathData) {
    const { startPosition, direction, velocity, pathDuration } = pathData;
    const distance = velocity * (pathDuration / 1000);
    const landingPosition = {
        x: startPosition.x + direction.x * distance,
        y: startPosition.y + direction.y * distance,
        z: 0,
    };
    return landingPosition;
}
function setPathCompleteInRoom(roomName, npc) {
    return __awaiter(this, void 0, void 0, function* () {
        const paths = yield (0, config_1.getActivepathsFromRedis)(roomName);
        const pathData = paths.filter((t) => t.npc.id === npc.id)[0];
        const updatedpaths = paths.filter((t) => t.npc.id !== npc.id);
        yield (0, config_1.setPathsInRedis)(roomName, updatedpaths);
        // update npc from path to have phase IDLE
        npc.phase = types_1.NPCPhase.IDLE;
        npc.position = calculateLandingPosition(pathData);
        yield (0, npc_ops_1.updateNPCInRoomInRedis)(roomName, npc);
        server_1.io.to(roomName).emit("path-complete", (0, serializers_1.serialize)({ npc }));
    });
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
