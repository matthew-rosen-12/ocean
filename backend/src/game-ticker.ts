import { throwData } from "./types";
import { setThrowCompleteInRoom } from "./services/npcService";

import { getActiveThrowsFromRedis, getAllRoomsFromRedis } from "./db/config";

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
        // Get throws for this room
        const throws = await getActiveThrowsFromRedis(roomName);
        if (!throws || throws.length === 0) continue;

        const completedThrows: throwData[] = [];

        // Use forEach instead of filter to separate active and completed throws
        throws.forEach((throwData: throwData) => {
          const now = Date.now();
          const throwEndTime = throwData.timestamp + throwData.throwDuration;

          if (now >= throwEndTime) {
            // Throw is complete
            completedThrows.push(throwData);
          }
        });

        // Process completed throws
        for (const completedThrow of completedThrows) {
          await setThrowCompleteInRoom(roomName, completedThrow);
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
