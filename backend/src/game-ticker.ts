import { pathData, PathPhase } from "./types";
import { checkAndHandleNPCCollisions, setPathCompleteInRoom } from "./services/npcService";


import { NPCPhase } from "./types";
import { getAllRoomsfromMemory } from "./state/rooms";
import { getActivepathsfromMemory } from "./state/paths";
import { getNPCsfromMemory } from "./state/npcs";

let gameTickerInstance: GameTicker | null = null;

export function getGameTicker(): GameTicker {
  if (!gameTickerInstance) {
    gameTickerInstance = new GameTicker();
  }
  return gameTickerInstance;
}

class GameTicker {
  private tickRate = 100; // ms between ticks (10 ticks per second)
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTicker();
  }

  startTicker() {
    this.tick();
  }

  private async tick() {
    try {
      // Get all room names
      const roomNames =  getAllRoomsfromMemory();

      // Process each room
      for (const roomName of roomNames) {
        // Get paths for this room
        const allPaths =  getActivepathsfromMemory(roomName);
        // filter paths that are not thrown
        const paths = allPaths.filter((path: pathData) => path.pathPhase !== PathPhase.THROWN && path.pathPhase !== PathPhase.RETURNING);
        if (!paths || paths.length === 0) continue;

        const completedpaths: pathData[] = [];

        // Use forEach instead of filter to separate active and completed paths
        paths.forEach((pathData: pathData) => {
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
          const npcs =  getNPCsfromMemory(roomName);
          const currentNpc = npcs.get(completedpath.npc.id);

          // Only complete path if NPC is still in PATH phase
          if (currentNpc && currentNpc.phase === NPCPhase.path) {
             setPathCompleteInRoom(roomName, completedpath.npc);
          }
        }
        checkAndHandleNPCCollisions(roomName)
      }
    } catch (error) {
      console.error("Error in game ticker:", error);
    }

    // Schedule next tick
    this.tickInterval = setTimeout(() => this.tick(), this.tickRate);
  }

  cleanup() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
