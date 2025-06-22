import { UserInfo, Animal, roomId, userId, NPCPhase, pathData, PathPhase } from "shared/types";
import { addUserToRoom, getAllUsersInRoom } from "../state/users";
import { getNPCGroupsfromMemory, setNPCGroupsInMemory } from "../state/npc-groups";
import { getpathsfromMemory, setPathsInMemory } from "../state/paths";
import { v4 as uuidv4 } from "uuid";
import { io } from "../server";

interface BotSpawnTimer {
  roomName: roomId;
  timer: NodeJS.Timeout;
  spawnCount: number;
  roomStartTime: number;
}

/**
 * Manages bot users - creation, spawning, and lifecycle
 */
export class BotManagementService {
  private static botSpawnTimers: Map<roomId, BotSpawnTimer> = new Map();
  private static readonly MAX_USERS_PER_ROOM = 8;
  private static readonly BOT_SPAWN_INTERVAL = 5000; // 5 seconds
  private static readonly INITIAL_SPAWN_DELAY = 5000; // 5 seconds after room creation
  private static readonly MAX_SPAWN_DURATION = 30000; // 30 seconds total
  
  // Available animals for bots (excluding the one human players might choose)
  private static readonly BOT_ANIMALS = [Animal.BEE, Animal.BEAR]; // Add more as they become available

  /**
   * Start bot spawning process for a room
   */
  static startBotSpawning(roomName: roomId): void {
    // Clean up any existing timer for this room
    this.stopBotSpawning(roomName);

    const roomStartTime = Date.now();
    
    // Set initial spawn timer (5 seconds after room creation)
    const initialTimer = setTimeout(() => {
      this.spawnBotIfNeeded(roomName, roomStartTime);
    }, this.INITIAL_SPAWN_DELAY);

    this.botSpawnTimers.set(roomName, {
      roomName,
      timer: initialTimer,
      spawnCount: 0,
      roomStartTime
    });
  }

  /**
   * Stop bot spawning for a room
   */
  static stopBotSpawning(roomName: roomId): void {
    const timerData = this.botSpawnTimers.get(roomName);
    if (timerData) {
      clearTimeout(timerData.timer);
      this.botSpawnTimers.delete(roomName);
    }
  }

  /**
   * Spawn a bot if conditions are met, then schedule next spawn
   */
  private static spawnBotIfNeeded(roomName: roomId, roomStartTime: number): void {
    const currentTime = Date.now();
    const roomAge = currentTime - roomStartTime;
    
    // Stop spawning if room is older than 30 seconds
    if (roomAge >= this.MAX_SPAWN_DURATION) {
      this.stopBotSpawning(roomName);
      return;
    }

    // Check current user count
    const currentUsers = getAllUsersInRoom(roomName);
    if (currentUsers.size >= this.MAX_USERS_PER_ROOM) {
      this.stopBotSpawning(roomName);
      return;
    }

    // Spawn a bot
    const bot = this.createBot(roomName);
    addUserToRoom(roomName, bot);
    
    // Broadcast bot join to all clients in room
    io.to(roomName).emit("user-joined", { user: bot });
    
    console.log(`Bot ${bot.nickname} spawned in room ${roomName}. Total users: ${currentUsers.size + 1}`);

    // Schedule next spawn
    const timerData = this.botSpawnTimers.get(roomName);
    if (timerData) {
      timerData.spawnCount++;
      
      const nextTimer = setTimeout(() => {
        this.spawnBotIfNeeded(roomName, roomStartTime);
      }, this.BOT_SPAWN_INTERVAL);
      
      timerData.timer = nextTimer;
      this.botSpawnTimers.set(roomName, timerData);
    }
  }

  /**
   * Create a new bot user
   */
  private static createBot(roomName: roomId): UserInfo {
    const botId = `bot-${uuidv4()}`;
    const randomAnimal = this.BOT_ANIMALS[Math.floor(Math.random() * this.BOT_ANIMALS.length)];
    
    // Generate random position within reasonable bounds
    const position = {
      x: (Math.random() - 0.5) * 100, // Random position between -50 and 50
      y: (Math.random() - 0.5) * 100
    };

    const bot: UserInfo = {
      id: botId as userId,
      animal: randomAnimal,
      room: roomName,
      position: position,
      direction: { x: 0, y: 0 },
      nickname: this.generateBotNickname()
    };

    return bot;
  }

  /**
   * Generate a random nickname for bots
   */
  private static generateBotNickname(): string {
    const adjectives = ['Swift', 'Clever', 'Brave', 'Quick', 'Wild', 'Sneaky', 'Fierce', 'Agile'];
    const nouns = ['Hunter', 'Explorer', 'Wanderer', 'Seeker', 'Ranger', 'Scout', 'Tracker', 'Roamer'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 99) + 1;
    
    return `${adjective}${noun}${number}`;
  }

  /**
   * Check if a user is a bot
   */
  static isBot(userId: userId): boolean {
    return userId.startsWith('bot-');
  }

  /**
   * Get all bot users in a room
   */
  static getBotsInRoom(roomName: roomId): UserInfo[] {
    const allUsers = getAllUsersInRoom(roomName);
    return Array.from(allUsers.values()).filter(user => this.isBot(user.id));
  }

  /**
   * Update bot position with strategic AI behavior
   * Phase 1: Hunt for NPCs until captured
   * Phase 2: Attack other users' captured groups
   */
  static updateBotPosition(bot: UserInfo, roomName: roomId): void {
    const speed = 0.15;
    let targetPosition: {x: number, y: number} | null = null;
    
    // Get bot's current captured group status
    const botHasCapturedGroup = this.botHasCapturedNPCs(bot.id, roomName);
    
    if (!botHasCapturedGroup) {
      // Phase 1: Hunt for IDLE or PATH NPCs
      targetPosition = this.findNearestTargetNPC(bot, roomName);
    } else {
      // Phase 2: Find other users with captured groups to attack
      targetPosition = this.findNearestUserWithCapturedNPCs(bot, roomName);
    }
    
    if (targetPosition) {
      // Move towards target
      const direction = {
        x: targetPosition.x - bot.position.x,
        y: targetPosition.y - bot.position.y
      };
      
      // Normalize direction
      const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      if (magnitude > 0) {
        direction.x /= magnitude;
        direction.y /= magnitude;
        
        bot.position.x += direction.x * speed;
        bot.position.y += direction.y * speed;
        bot.direction = direction;
      }
    } else {
      // No target found, random movement
      const direction = {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      };
      
      const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      if (magnitude > 0) {
        direction.x /= magnitude;
        direction.y /= magnitude;
      }
      
      bot.position.x += direction.x * speed * 0.3; // Slower random movement
      bot.position.y += direction.y * speed * 0.3;
      bot.direction = direction;
    }
    
    // Keep bots within reasonable bounds
    bot.position.x = Math.max(-100, Math.min(100, bot.position.x));
    bot.position.y = Math.max(-100, Math.min(100, bot.position.y));
  }

  /**
   * Check if bot has captured NPCs
   */
  private static botHasCapturedNPCs(botId: userId, roomName: roomId): boolean {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (!npcGroups) return false;
    
    const botNpcGroup = npcGroups.getByUserId(botId);
    return !!(botNpcGroup && botNpcGroup.fileNames.length > 0);
  }

  /**
   * Find nearest IDLE or PATH NPC for bot to capture
   */
  private static findNearestTargetNPC(bot: UserInfo, roomName: roomId): {x: number, y: number} | null {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (!npcGroups) return null;

    let nearestNPC = null;
    let nearestDistance = Infinity;

    // Find nearest IDLE or PATH NPC
    for (const npcGroup of npcGroups.values()) {
      if (npcGroup.phase === NPCPhase.IDLE || npcGroup.phase === NPCPhase.PATH) {
        const distance = this.calculateDistance(bot.position, npcGroup.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestNPC = npcGroup.position;
        }
      }
    }

    return nearestNPC;
  }

  /**
   * Find nearest user with captured NPCs to attack
   */
  private static findNearestUserWithCapturedNPCs(bot: UserInfo, roomName: roomId): {x: number, y: number} | null {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    const allUsers = getAllUsersInRoom(roomName);
    if (!npcGroups || !allUsers) return null;

    let nearestUser = null;
    let nearestDistance = Infinity;

    // Find nearest user (not bot) with captured NPCs
    for (const [userId, user] of allUsers) {
      // Skip bots and the current bot itself
      if (this.isBot(userId) || userId === bot.id) continue;
      
      const userNpcGroup = npcGroups.getByUserId(userId);
      if (userNpcGroup && userNpcGroup.fileNames.length > 0) {
        const distance = this.calculateDistance(bot.position, user.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestUser = user.position;
        }
      }
    }

    return nearestUser;
  }

  /**
   * Check if bot should throw its captured group at nearby users
   * Returns true if throw was executed
   */
  static checkAndExecuteBotThrow(bot: UserInfo, roomName: roomId): boolean {
    const npcGroups = getNPCGroupsfromMemory(roomName);
    const allUsers = getAllUsersInRoom(roomName);
    if (!npcGroups || !allUsers) return false;

    // Check if bot has captured NPCs
    const botNpcGroup = npcGroups.getByUserId(bot.id);
    if (!botNpcGroup || botNpcGroup.fileNames.length === 0) return false;

    const THROW_RANGE = 8.0; // Distance at which bot will throw

    // Find nearby users with captured NPCs
    for (const [userId, user] of allUsers) {
      // Skip bots and the current bot itself
      if (this.isBot(userId) || userId === bot.id) continue;
      
      const userNpcGroup = npcGroups.getByUserId(userId);
      if (userNpcGroup && userNpcGroup.fileNames.length > 0) {
        const distance = this.calculateDistance(bot.position, user.position);
        
        if (distance <= THROW_RANGE) {
          // Execute throw at this user
          this.executeBotThrow(bot, user, botNpcGroup, roomName);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Execute bot throw at target user
   */
  private static executeBotThrow(bot: UserInfo, targetUser: UserInfo, botNpcGroup: any, roomName: roomId): void {
    // Calculate throw direction
    const direction = {
      x: targetUser.position.x - bot.position.x,
      y: targetUser.position.y - bot.position.y
    };

    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (magnitude > 0) {
      direction.x /= magnitude;
      direction.y /= magnitude;
    }

    // Create path data for the throw
    const throwPath: pathData = {
      id: uuidv4(),
      room: roomName,
      npcGroupId: botNpcGroup.id,
      startPosition: { x: bot.position.x, y: bot.position.y },
      direction: direction,
      velocity: 1.0, // Throw speed
      pathDuration: 3000, // 3 seconds flight time
      timestamp: Date.now(),
      pathPhase: PathPhase.THROWN
    };

    // Update NPC group to PATH phase
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (npcGroups) {
      botNpcGroup.phase = NPCPhase.PATH;
      botNpcGroup.captorId = undefined; // Released from bot
      npcGroups.setByNpcGroupId(botNpcGroup.id, botNpcGroup);
      setNPCGroupsInMemory(roomName, npcGroups);
    }

    // Add path to memory
    const roomPaths = getpathsfromMemory(roomName);
    roomPaths.set(throwPath.npcGroupId, throwPath);
    setPathsInMemory(roomName, roomPaths);

    // Broadcast throw to all clients
    io.to(roomName).emit("update-npc-group", { npcGroup: botNpcGroup });
    io.to(roomName).emit("path-update", { pathData: throwPath });

    console.log(`Bot ${bot.nickname} threw NPCs at ${targetUser.nickname}`);
  }

  /**
   * Calculate distance between two positions
   */
  private static calculateDistance(pos1: {x: number, y: number}, pos2: {x: number, y: number}): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}