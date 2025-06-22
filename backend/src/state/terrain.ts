import { TerrainConfig, roomId } from "shared/types";
import { generateRoomTerrain } from "../initialization/terrain";

const terrainConfigs: Map<roomId, TerrainConfig> = new Map();

export function getTerrainConfig(roomName: roomId): TerrainConfig {
  let config = terrainConfigs.get(roomName);
  if (!config) {
    config = generateRoomTerrain(roomName);
    terrainConfigs.set(roomName, config);
  }
  return config;
}

export function setTerrainConfig(roomName: roomId, config: TerrainConfig): void {
  terrainConfigs.set(roomName, config);
}

export function deleteTerrainConfig(roomName: roomId): void {
  terrainConfigs.delete(roomName);
}