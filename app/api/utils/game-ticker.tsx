import { throwData } from "@/app/utils/types";
import {
  getAllChannelNames,
  getChannelActiveThrows,
  setChannelActiveThrows,
  setThrowCompleteInChannel,
} from "../npc/service";

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
      // Get all channel names
      const channelNames = await getAllChannelNames();

      // Process each channel
      for (const channelName of channelNames) {
        // Get throws for this channel
        const throws = await getChannelActiveThrows(channelName);
        if (!throws || throws.length === 0) continue;

        const activeThrows: throwData[] = [];
        const completedThrows: throwData[] = [];

        // Use forEach instead of filter to separate active and completed throws
        throws.forEach((throwData) => {
          const now = Date.now();
          const throwEndTime = throwData.timestamp + throwData.throwDuration;

          if (now >= throwEndTime) {
            // Throw is complete
            completedThrows.push(throwData);
          } else {
            // Throw is still active
            activeThrows.push(throwData);
          }
        });

        // Process completed throws
        for (const completedThrow of completedThrows) {
          await setThrowCompleteInChannel(channelName, completedThrow);
        }

        // Update active throws in Redis store
        if (activeThrows.length !== throws.length) {
          await setChannelActiveThrows(channelName, activeThrows);
        }
      }
    } catch (error) {
      console.error("Error in game ticker:", error);
    }

    // Important: Use a properly bound function reference
    setTimeout(() => this.tick(), this.tickRate);
  }

  cleanup() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
