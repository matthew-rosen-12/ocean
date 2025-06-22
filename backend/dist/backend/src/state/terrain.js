"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerrainConfig = getTerrainConfig;
exports.setTerrainConfig = setTerrainConfig;
exports.deleteTerrainConfig = deleteTerrainConfig;
const terrain_1 = require("../initialization/terrain");
const terrainConfigs = new Map();
function getTerrainConfig(roomName) {
    let config = terrainConfigs.get(roomName);
    if (!config) {
        config = (0, terrain_1.generateRoomTerrain)(roomName);
        terrainConfigs.set(roomName, config);
    }
    return config;
}
function setTerrainConfig(roomName, config) {
    terrainConfigs.set(roomName, config);
}
function deleteTerrainConfig(roomName) {
    terrainConfigs.delete(roomName);
}
