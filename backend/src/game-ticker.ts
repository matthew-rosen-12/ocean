import { pathData } from "./types";
import { setPathCompleteInRoom } from "./services/npcService";

import { getActivepathsFromRedis, getAllRoomsFromRedis } from "./db/config";

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
      const roomNames = await getAllRoomsFromRedis();

      // Process each room
      for (const roomName of roomNames) {
        // Get paths for this room
        const paths = await getActivepathsFromRedis(roomName);
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
          await setPathCompleteInRoom(roomName, completedpath.npc);
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
