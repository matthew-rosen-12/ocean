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
exports.getpathsfromMemory = getpathsfromMemory;
exports.setPathsInMemory = setPathsInMemory;
exports.setPathsMapInMemory = setPathsMapInMemory;
exports.setPathInMemory = setPathInMemory;
exports.deletePathInMemory = deletePathInMemory;
exports.deletePathsInMemory = deletePathsInMemory;
const types_1 = require("../types");
const paths = new types_1.DefaultMap(() => new Map());
// Path functions - direct Map access, no serialization
function getpathsfromMemory(room) {
    return paths.get(room);
}
function setPathsInMemory(roomName, newPaths) {
    paths.set(roomName, newPaths);
}
function setPathsMapInMemory(room, newPaths) {
    paths.set(room, newPaths);
}
// Direct Path operations - no read-modify-set needed
function setPathInMemory(roomName, npcGroupId, pathData) {
    return __awaiter(this, void 0, void 0, function* () {
        let roomPaths = paths.get(roomName);
        if (!roomPaths) {
            roomPaths = new Map();
            paths.set(roomName, roomPaths);
        }
        roomPaths.set(npcGroupId, pathData);
    });
}
function deletePathInMemory(roomName, npcGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        const roomPaths = paths.get(roomName);
        if (roomPaths) {
            roomPaths.delete(npcGroupId);
        }
    });
}
function deletePathsInMemory(roomName) {
    return __awaiter(this, void 0, void 0, function* () {
        paths.delete(roomName);
    });
}
