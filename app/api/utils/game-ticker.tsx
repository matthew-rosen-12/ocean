import { NPCPhase } from "@/app/utils/types";
import { calculateLandingPosition } from "../npc/[id]/throw/route";
import {
  channelActiveThrows,
  setThrownCompleteInChannel,
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
    this.tickInterval = setInterval(() => this.tick(), this.tickRate);
  }

  private tick() {
    const now = Date.now();

    // Process throws from all channels
    for (const [channelName, throws] of channelActiveThrows.entries()) {
      // Use filter to keep active throws and process completed ones
      channelActiveThrows.set(
        channelName,
        throws.filter((throwData) => {
          const elapsedTime = now - throwData.timestamp;

          if (elapsedTime >= throwData.throwDuration) {
            // Handle landing
            const finalPosition = calculateLandingPosition(throwData);

            throwData.npc.position = finalPosition;
            throwData.npc.phase = NPCPhase.IDLE;
            setThrownCompleteInChannel(channelName, { ...throwData });

            // Remove by returning false
            return false;
          }

          // Keep this throw active
          return true;
        })
      );
    }
  }

  cleanup() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }
}
