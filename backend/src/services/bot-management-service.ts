import { UserInfo, roomId, userId, NPCPhase, pathData, PathPhase, DIRECTION_OFFSET, ANIMAL_SCALES, NPCGroup } from "shared/types";
import { addUserToRoom, getAllUsersInRoom } from "../state/users";
import { getNPCGroupsfromMemory, setNPCGroupsInMemory } from "../state/npc-groups";
import { getpathsfromMemory, setPathsInMemory } from "../state/paths";
import { emitToRoom } from "../typed-socket";
import { v4 as uuidv4 } from "uuid";
import { getPathPosition } from "./path-service";
import { setTimeout } from "timers";
import { getTerrainConfig } from "../state/terrain";
import { getUniqueAnimalForRoom } from "../initialization/user-info";

interface BotSpawnTimer {
  roomName: roomId;
  timer: ReturnType<typeof setTimeout>;
  spawnCount: number;
  roomStartTime: number;
}

interface BotMovementState {
  currentKeys: { up: boolean; down: boolean; left: boolean; right: boolean };
  keyHoldDuration: number;
  maxHoldDuration: number;
  hunting?: { keys: { up: boolean; down: boolean; left: boolean; right: boolean }; duration: number };
  justThrew?: { direction: { x: number; y: number }; duration: number };
  lastThrowTime?: number;
  targetRotation?: { angle: number; speed: number; };
}

/**
 * Manages bot users - creation, spawning, and lifecycle
 */
export class BotManagementService {
  private static botSpawnTimers: Map<roomId, BotSpawnTimer> = new Map();
  private static botMovementStates: Map<userId, BotMovementState> = new Map();
  private static readonly MAX_USERS_PER_ROOM = 8;
  private static readonly BOT_SPAWN_INTERVAL = 5000; // 5 seconds
  private static readonly INITIAL_SPAWN_DELAY = 5000; // 5 seconds after room creation
  private static readonly MAX_SPAWN_DURATION = 15000; // 30 seconds total

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
    // return
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
    
    // Initialize bot movement state
    this.botMovementStates.set(bot.id, {
      currentKeys: { up: false, down: false, left: false, right: false },
      keyHoldDuration: 0,
      maxHoldDuration: 0
    });
    
    // Broadcast bot join to all clients in room
    emitToRoom(roomName, "user-joined", { user: bot });
    
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
    
    // Get all animals already used in the room (both users and bots)
    const existingUsers = getAllUsersInRoom(roomName);
    const usedAnimals = Array.from(existingUsers.values()).map(user => user.animal);
    
    // Get unique animal that doesn't conflict with existing users/bots
    const uniqueAnimal = getUniqueAnimalForRoom(usedAnimals);
    
    // Get terrain configuration for proper boundary checking
    const terrainConfig = getTerrainConfig(roomName);
    const boundaries = terrainConfig.boundaries;
    
    // Generate random position within terrain boundaries with some padding
    const padding = 5; // Stay 5 units away from edges
    const position = {
      x: Math.random() * (boundaries.maxX - boundaries.minX - 2 * padding) + boundaries.minX + padding,
      y: Math.random() * (boundaries.maxY - boundaries.minY - 2 * padding) + boundaries.minY + padding
    };

    const bot: UserInfo = {
      id: botId as userId,
      animal: uniqueAnimal,
      room: roomName,
      position: position,
      direction: { x: 0, y: 0 },
      nickname: this.generateBotNickname(),
      isBot: true
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
   * Update bot position mimicking frontend movement logic
   * Simulates arrow key presses based on strategic AI behavior
   */
  static updateBotPosition(bot: UserInfo, roomName: roomId): void {
    const MOVEMENT_SPEED = 0.5; // Same as frontend
    
    // Get terrain configuration for proper boundary checking
    const terrainConfig = getTerrainConfig(roomName);
    const boundaries = terrainConfig.boundaries;
    
    // Get or initialize bot movement state
    let movementState = this.botMovementStates.get(bot.id);
    if (!movementState) {
      movementState = {
        currentKeys: { up: false, down: false, left: false, right: false },
        keyHoldDuration: 0,
        maxHoldDuration: 0
      };
      this.botMovementStates.set(bot.id, movementState);
    }
    
    // Check if bot has captured NPCs to decide hunting strategy
    const hasCapturedNPCs = this.botHasCapturedNPCs(bot.id, roomName);
    
    // Handle gradual rotation towards target if needed
    if (movementState.targetRotation) {
      const currentAngle = Math.atan2(bot.direction.y, bot.direction.x);
      const targetAngle = movementState.targetRotation.angle;
      let angleDiff = targetAngle - currentAngle;
      
      // Normalize angle difference to [-π, π]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Rotate towards target
      if (Math.abs(angleDiff) > 0.1) { // Small threshold to prevent jittering
        const rotationStep = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), movementState.targetRotation.speed);
        const newAngle = currentAngle + rotationStep;
        bot.direction = {
          x: Math.cos(newAngle),
          y: Math.sin(newAngle)
        };
      } else {
        // Rotation complete
        movementState.targetRotation = undefined;
      }
    }
    
    // Check if bot just threw and should continue in throw direction
    if (movementState.justThrew && movementState.justThrew.duration > 0) {
      // Continue moving in the direction the bot was facing when it threw
      const throwDirection = movementState.justThrew.direction;
      const keys = { up: false, down: false, left: false, right: false };
      
      if (throwDirection.y > 0.1) keys.up = true;
      if (throwDirection.y < -0.1) keys.down = true;
      if (throwDirection.x < -0.1) keys.left = true;
      if (throwDirection.x > 0.1) keys.right = true;
      
      movementState.currentKeys = keys;
      movementState.justThrew.duration--;
    } else {
      // Clear the justThrew state if duration is up
      if (movementState.justThrew && movementState.justThrew.duration <= 0) {
        movementState.justThrew = undefined;
      }
      
      // Sticky hunting state
      if (!movementState.hunting || movementState.hunting.duration <= 0) {
        let targetPosition: {x: number, y: number} | null = null;
        if (hasCapturedNPCs) {
          targetPosition = this.findNearestUserWithCapturedNPCs(bot, roomName);
        } else {
          targetPosition = this.findNearestTargetNPC(bot, roomName);
        }
        if (targetPosition) {
          const direction = {
            x: targetPosition.x - bot.position.x,
            y: targetPosition.y - bot.position.y
          };
          const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
          if (magnitude > 0) {
            direction.x /= magnitude;
            direction.y /= magnitude;
          }
          // Set movement keys based on direction
          const keys = { up: false, down: false, left: false, right: false };
          if (direction.y > 0.1) keys.up = true;
          if (direction.y < -0.1) keys.down = true;
          if (direction.x < -0.1) keys.left = true;
          if (direction.x > 0.1) keys.right = true;
          // Hold hunting direction for 1–2 seconds
          movementState.hunting = {
            keys,
            duration: Math.floor(Math.random() * 20) + 20 // 20–40 ticks (1–2 seconds)
          };
        } else {
          movementState.hunting = undefined;
        }
      }
      // Use sticky hunting keys if available
      if (movementState.hunting && movementState.hunting.duration > 0) {
        movementState.currentKeys = { ...movementState.hunting.keys };
        movementState.hunting.duration--;
      } else if (!movementState.hunting) {
        // No target found - use wandering logic
        if (movementState.keyHoldDuration <= 0) {
          // Time to pick new keys to hold
          movementState.currentKeys = { up: false, down: false, left: false, right: false };
          if (Math.random() < 0.4) {
            const directions = ['up', 'down', 'left', 'right'];
            const numDirections = Math.random() < 0.3 ? 2 : 1;
            const shuffled = [...directions].sort(() => Math.random() - 0.5);
            for (let i = 0; i < numDirections; i++) {
              const direction = shuffled[i];
              switch(direction) {
                case 'up': movementState.currentKeys.up = true; break;
                case 'down': movementState.currentKeys.down = true; break;
                case 'left': movementState.currentKeys.left = true; break;
                case 'right': movementState.currentKeys.right = true; break;
              }
            }
            movementState.maxHoldDuration = Math.floor(Math.random() * 200) + 100;
          } else {
            movementState.maxHoldDuration = Math.floor(Math.random() * 80) + 40;
          }
          movementState.keyHoldDuration = movementState.maxHoldDuration;
        }
      }
    }
    
    // Use current held keys
    const up = movementState.currentKeys.up;
    const down = movementState.currentKeys.down;
    const left = movementState.currentKeys.left;
    const right = movementState.currentKeys.right;
    
    // Decrement hold duration
    movementState.keyHoldDuration--;
    
    // Calculate movement change (mimicking frontend logic)
    const change = { x: 0, y: 0 };
    if (up) change.y += MOVEMENT_SPEED;
    if (down) change.y -= MOVEMENT_SPEED;
    if (left) change.x -= MOVEMENT_SPEED;
    if (right) change.x += MOVEMENT_SPEED;
    
    // Calculate new direction (mimicking frontend logic exactly)
    let newDirection = { x: 0, y: 0 };
    
    // Pure vertical movement - use direction offset like frontend
    if (!left && !right && up && !down) {
      newDirection = {
        x: bot.direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: 1,
      };
    } else if (!left && !right && !up && down) {
      newDirection = {
        x: bot.direction.x > 0 ? DIRECTION_OFFSET : -DIRECTION_OFFSET,
        y: -1,
      };
    } else {
      // All other movement patterns (including pure horizontal and diagonal) - use += logic like frontend
      if (left && !right) {
        newDirection.x -= 1;
      } else if (right && !left) {
        newDirection.x += 1;
      }
      if (up && !down) {
        newDirection.y += 1;
      } else if (down && !up) {
        newDirection.y -= 1;
      }
    }
    
    // Normalize diagonal movement to maintain consistent speed (matching frontend)
    if (newDirection.x !== 0 && newDirection.y !== 0) {
      const length = Math.sqrt(newDirection.x * newDirection.x + newDirection.y * newDirection.y);
      newDirection.x /= length;
      newDirection.y /= length;
    }
    
    // Only update direction if there's actual movement (matching frontend)
    if (change.x !== 0 || change.y !== 0) {
      bot.direction = newDirection;
    }
    
    // Apply position change with proper boundary checking
    if (change.x !== 0 || change.y !== 0) {
      const newPosition = {
        x: bot.position.x + change.x,
        y: bot.position.y + change.y
      };
      
      // Apply boundary constraints (same as frontend)
      bot.position.x = Math.max(boundaries.minX, Math.min(boundaries.maxX, newPosition.x));
      bot.position.y = Math.max(boundaries.minY, Math.min(boundaries.maxY, newPosition.y));
    }
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
        const npcGroupPosition = npcGroup.phase == NPCPhase.IDLE ? npcGroup.position : getPathPosition(npcGroup, roomName)
        const distance = this.calculateDistance(bot.position, npcGroupPosition);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestNPC = npcGroupPosition;
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

    // Find nearest user (including other bots) with captured NPCs
    for (const [userId, user] of allUsers) {
      // Skip only the current bot itself
      if (userId === bot.id) continue;
      
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

    // Check throw cooldown - bots must wait after capturing before throwing
    const movementState = this.botMovementStates.get(bot.id);
    const currentTime = Date.now();
    const THROW_COOLDOWN = 9000; // 3 seconds cooldown
    
    if (movementState?.lastThrowTime && (currentTime - movementState.lastThrowTime) < THROW_COOLDOWN) {
      return false; // Still in cooldown
    }

    // Find nearby users with captured NPCs
    for (const [userId, user] of allUsers) {
      // Skip only the current bot itself
      if (userId === bot.id) continue;
      
      const userNpcGroup = npcGroups.getByUserId(userId);
      if (userNpcGroup && userNpcGroup.fileNames.length > 0) {
        const distance = this.calculateDistance(bot.position, user.position);
        
        // Calculate dynamic throw range based on animal scales
        const botScale = ANIMAL_SCALES[bot.animal as keyof typeof ANIMAL_SCALES] || 1.0;
        const targetScale = ANIMAL_SCALES[user.animal as keyof typeof ANIMAL_SCALES] || 1.0;
        const THROW_RANGE = (botScale + targetScale) * 20.0; // Combined scale factor
        
        if (distance <= THROW_RANGE) {
          // Check if bot needs to rotate to face target before throwing
          const targetDirection = {
            x: user.position.x - bot.position.x,
            y: user.position.y - bot.position.y
          };
          const targetMagnitude = Math.sqrt(targetDirection.x * targetDirection.x + targetDirection.y * targetDirection.y);
          if (targetMagnitude > 0) {
            targetDirection.x /= targetMagnitude;
            targetDirection.y /= targetMagnitude;
          }
          
          // Calculate angle difference between current direction and target
          const currentAngle = Math.atan2(bot.direction.y, bot.direction.x);
          const targetAngle = Math.atan2(targetDirection.y, targetDirection.x);
          let angleDiff = targetAngle - currentAngle;
          
          // Normalize angle difference to [-π, π]
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          // Only throw if bot is facing roughly the right direction (within 30 degrees)
          const THROW_ANGLE_TOLERANCE = Math.PI / 6; // 30 degrees
          if (Math.abs(angleDiff) <= THROW_ANGLE_TOLERANCE) {
            // Execute throw at this user
            this.executeBotThrow(bot, user, botNpcGroup, roomName);
            return true;
          } else {
            // Set target rotation for gradual turning
            if (movementState) {
              movementState.targetRotation = {
                angle: targetAngle,
                speed: Math.PI / 15 // Rotate at π/15 radians per tick (12 degrees per tick)
              };
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Execute bot throw at target user
   */
  private static executeBotThrow(bot: UserInfo, targetUser: UserInfo, botNpcGroup: NPCGroup, roomName: roomId): void {
    // Calculate optimal throw direction toward target
    const optimalDirection = {
      x: targetUser.position.x - bot.position.x,
      y: targetUser.position.y - bot.position.y
    };

    // Normalize optimal direction
    const magnitude = Math.sqrt(optimalDirection.x * optimalDirection.x + optimalDirection.y * optimalDirection.y);
    if (magnitude > 0) {
      optimalDirection.x /= magnitude;
      optimalDirection.y /= magnitude;
    }

    // Update bot's direction to face the target (simulating keyboard input)
    bot.direction = optimalDirection;

    // Set the bot to continue moving in the throw direction for a while
    const movementState = this.botMovementStates.get(bot.id);
    if (movementState) {
      movementState.justThrew = {
        direction: { x: optimalDirection.x, y: optimalDirection.y },
        duration: 30 // Continue in throw direction for 1.5 seconds (30 ticks at 20 ticks/sec)
      };
      // Record throw time for cooldown
      movementState.lastThrowTime = Date.now();
      // Clear any rotation target since we just threw
      movementState.targetRotation = undefined;
    }

    // Use the optimal direction for the throw
    const direction = {
      x: optimalDirection.x,
      y: optimalDirection.y
    };

    // Calculate how many NPCs to throw (like frontend - split the group)
    const groupSize = botNpcGroup.fileNames.length;
    const actualThrowCount = Math.min(Math.max(1, Math.floor(groupSize / 2)), groupSize);
    
    // Split the group: remaining NPCs stay with bot, thrown NPCs get new group
    const remainingFileNames = botNpcGroup.fileNames.slice(0, groupSize - actualThrowCount);
    const thrownFileNames = botNpcGroup.fileNames.slice(-actualThrowCount);
    
    // Create new thrown group with new ID (like frontend)
    const thrownGroupId = uuidv4();
    const thrownNpcGroup = new NPCGroup({
      id: thrownGroupId,
      fileNames: thrownFileNames,
      position: bot.position,
      phase: NPCPhase.PATH,
      captorId: bot.id, // Keep captorId
      direction: { x: 0, y: 0 }
    });

    // Calculate throw velocity and duration using same formula as frontend
    const throwCount = actualThrowCount;
    const baseVelocity = 20.0;
    const baseDuration = 2000;
    
    // Use same proportional calculation as frontend throwing
    const calculateNPCGroupProportion = (numFileNames: number): number => {
      if (numFileNames === 0) return 0;
      const logProportion = Math.log(numFileNames) / Math.log(4);
      return 1 + logProportion;
    };
    
    const calculateNPCGroupVelocityFactor = (numFileNames: number): number => {
      if (numFileNames === 0) return 1;
      return Math.sqrt(calculateNPCGroupProportion(numFileNames));
    };
    
    const calculateNPCGroupDistanceFactor = (numFileNames: number): number => {
      if (numFileNames === 0) return 1;
      return calculateNPCGroupProportion(numFileNames);
    };
    
    const throwVelocity = baseVelocity * calculateNPCGroupVelocityFactor(throwCount);
    const throwDuration = baseDuration * calculateNPCGroupDistanceFactor(throwCount);

    // Create path data for the throw
    const throwPath: pathData = {
      id: uuidv4(),
      room: roomName,
      npcGroupId: thrownGroupId,
      startPosition: { x: bot.position.x, y: bot.position.y },
      direction: direction,
      velocity: throwVelocity, // Throw speed proportional to group size
      pathDuration: throwDuration, // Flight time proportional to group size
      timestamp: Date.now(),
      pathPhase: PathPhase.THROWN
    };

    // Update NPC groups in memory
    const npcGroups = getNPCGroupsfromMemory(roomName);
    if (npcGroups) {
      if (remainingFileNames.length > 0) {
        // Update original group with remaining NPCs
        botNpcGroup.fileNames = remainingFileNames;
        npcGroups.setByNpcGroupId(botNpcGroup.id, botNpcGroup);
      } else {
        // If no NPCs left, remove the original group
        npcGroups.deleteByNpcGroupId(botNpcGroup.id);
      }
      
      // Add the new thrown group
      npcGroups.setByNpcGroupId(thrownGroupId, thrownNpcGroup);
      setNPCGroupsInMemory(roomName, npcGroups);
    }

    // Add path to memory
    const roomPaths = getpathsfromMemory(roomName);
    roomPaths.set(throwPath.npcGroupId, throwPath);
    setPathsInMemory(roomName, roomPaths);

    // Broadcast changes to all clients
    if (remainingFileNames.length > 0) {
      emitToRoom(roomName, "npc-group-update", { npcGroup: botNpcGroup });
    } else {
      // Mark original group as deleted
      emitToRoom(roomName, "npc-group-update", { npcGroup: new NPCGroup({ ...botNpcGroup, fileNames: [] }) });
    }
    emitToRoom(roomName, "npc-group-update", { npcGroup: thrownNpcGroup });
    emitToRoom(roomName, "path-update", { pathData: throwPath });

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