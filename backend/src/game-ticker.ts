import { pathData, PathPhase, NPCPhase } from "shared/types";
import { checkAndHandleNPCCollisions, setPathCompleteInRoom } from "./services/npc-group-service";


import { getAllRoomsfromMemory } from "./state/rooms";
import { getpathsfromMemory } from "./state/paths";
import { getNPCGroupsfromMemory } from "./state/npc-groups";

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
        // Always check for collisions first (for thrown paths)
        checkAndHandleNPCCollisions(roomName);

        // Get paths for this room
        const allPaths =  getpathsfromMemory(roomName);
        // filter paths that are not thrown or returning (for completion checking)
        // Include FLEEING paths for completion checking
        const paths = Array.from(allPaths.values()).filter((path: pathData) => path.pathPhase !== PathPhase.THROWN && path.pathPhase !== PathPhase.RETURNING);
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
          const npcGroups = getNPCGroupsfromMemory(roomName);
          const npcGroup = npcGroups.getByNpcGroupId(completedpath.npcGroupId);

          // Only complete path if NPC is still in PATH phase
          if (npcGroup && npcGroup.phase === NPCPhase.PATH) {
             setPathCompleteInRoom(roomName, npcGroup);
          }
        }
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
