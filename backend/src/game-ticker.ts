import { pathData, NPCPhase } from "shared/types";
import { checkAndHandleNPCCollisions, setPathCompleteInRoom, checkAndHandleNPCFleeing, checkAndDeleteFleeingNPCs, checkAndSpawnNPCs } from "./services/npc-group-service";
import { BotCollisionService } from "./services/bot-collision-service";
import { BotManagementService } from "./services/bot-management-service";
import { emitToRoom } from "./typed-socket";

import { getAllRoomsfromMemory } from "./state/rooms";
import { getpathsfromMemory } from "./state/paths";
import { getNPCGroupsfromMemory } from "./state/npc-groups";
import { updateUserInRoom } from "./state/users";
import { setTimeout } from "timers";

let gameTickerInstance: GameTicker | null = null;

export function getGameTicker(): GameTicker {
  if (!gameTickerInstance) {
    gameTickerInstance = new GameTicker();
  }
  return gameTickerInstance;
}

class GameTicker {
  private tickRate = 50; // ms between ticks (20 ticks per second) - faster for smoother bots
  private tickInterval: ReturnType<typeof setTimeout> | null = null;
  private botUpdateCounter = 0;
  private spawnCheckCounter = 0;
  private readonly SPAWN_CHECK_INTERVAL = 20; // Check spawning every 20 ticks (1 second at 20 ticks/second)

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

      this.spawnCheckCounter++;

      
      // 
      
      // Check if we should run spawn checks this tick
      const shouldRunSpawnCheck = this.spawnCheckCounter >= this.SPAWN_CHECK_INTERVAL;

      // Process each room
      for (const roomName of roomNames) {
        // Always check for collisions first (for thrown paths)
        checkAndHandleNPCCollisions(roomName);
        
        // Process bot users: movement and collision detection 
        this._processBots(roomName);
        
        // Check for NPC fleeing after bot movement (same as for human players)
        checkAndHandleNPCFleeing(roomName);
        
        // Check for fleeing NPCs that are far outside terrain boundaries and delete them
        checkAndDeleteFleeingNPCs(roomName);

        // Check if we need to spawn new NPCs (once per second)
        if (shouldRunSpawnCheck) {
          checkAndSpawnNPCs(roomName);
        }

        // Get paths for this room
        const allPaths =  getpathsfromMemory(roomName);
        // Include all paths for completion checking (server handles all transitions)
        const paths = Array.from(allPaths.values());
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

    // Increment counters
    this.botUpdateCounter++;
    
    // Reset spawn check counter if reached interval
    if (this.spawnCheckCounter >= this.SPAWN_CHECK_INTERVAL) {
      this.spawnCheckCounter = 0;
    }

    // Schedule next tick
    this.tickInterval = setTimeout(() => this.tick(), this.tickRate);
  }

  private _processBots(roomName: string) {
    const bots = BotManagementService.getBotsInRoom(roomName);
    
    for (const bot of bots) {
      // Check if bot should throw captured NPCs at nearby users
      const didThrow = BotManagementService.checkAndExecuteBotThrow(bot, roomName);
      
      // Only update position if bot didn't throw (throwing stops movement briefly)
      if (!didThrow) {
        // Update bot position (strategic movement AI)
        BotManagementService.updateBotPosition(bot, roomName);
      }
      
      // Check for collisions with NPCs (commented out for now)
      BotCollisionService.checkBotCollisions(roomName, bot);
      
      // Update bot in room state
      updateUserInRoom(roomName, bot);
      
      // Broadcast bot position update to all clients
      emitToRoom(roomName, "user-updated", { user: bot });
    }
  }

  cleanup() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
