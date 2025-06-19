import { FinalScores } from "shared/types";
import { getAllUsersInRoom } from "./state/users";
import { getNPCGroupsfromMemory } from "./state/npc-groups";
import { clearAllGameData } from "./game-data-cleaner";
import { emitToRoom } from "./typed-socket";

interface GameTimer {
  startTime: number;
  duration: number;
  timeoutId: NodeJS.Timeout;
  roomName: string;
}

// Map of room names to their game timers
const gameTimers: Map<string, GameTimer> = new Map();

export const GAME_DURATION = 3 * 1000; // 5 minutes in milliseconds

export function startGameTimer(roomName: string): void {
  // Don't start a new timer if one already exists for this room
  if (gameTimers.has(roomName)) {
    return;
  }

  const startTime = Date.now();
  const timeoutId = setTimeout(() => {
    handleGameEnd(roomName);
  }, GAME_DURATION);

  const gameTimer: GameTimer = {
    startTime,
    duration: GAME_DURATION,
    timeoutId,
    roomName,
  };

  gameTimers.set(roomName, gameTimer);
  console.log(`Game timer started for room ${roomName} - ${GAME_DURATION / 1000} seconds`);
}

export function stopGameTimer(roomName: string): void {
  const gameTimer = gameTimers.get(roomName);
  if (gameTimer) {
    clearTimeout(gameTimer.timeoutId);
    gameTimers.delete(roomName);
    console.log(`Game timer stopped for room ${roomName}`);
  }
}

function calculateFinalScores(roomName: string): FinalScores {
  const finalScores: FinalScores = {};
  const users = getAllUsersInRoom(roomName);
  const npcGroups = getNPCGroupsfromMemory(roomName);

  // Calculate scores based on NPC count for each user
  users.forEach((user) => {
    const userNpcGroup = npcGroups.getByUserId(user.id);
    const npcCount = userNpcGroup?.fileNames?.length || 0;
    finalScores[user.id] = npcCount;
  });

  return finalScores;
}

async function handleGameEnd(roomName: string): Promise<void> {
  try {
    console.log(`Game ended for room ${roomName}`);

    // Calculate final scores before clearing data
    const finalScores = calculateFinalScores(roomName);

    // Emit times-up event to all clients in the room
    emitToRoom(roomName, "times-up", { finalScores });

    // Clean up the timer
    gameTimers.delete(roomName);

    // Clear all game data after a short delay to allow clients to process the event
    setTimeout(() => {
      clearAllGameData(roomName);
    }, 1000);

  } catch (error) {
    console.error(`Error handling game end for room ${roomName}:`, error);
  }
}

export function isGameActive(roomName: string): boolean {
  return gameTimers.has(roomName);
}

export function getGameStartTime(roomName: string): number | null {
  const gameTimer = gameTimers.get(roomName);
  return gameTimer ? gameTimer.startTime : null;
}

export function getRemainingTime(roomName: string): number | null {
  const gameTimer = gameTimers.get(roomName);
  if (!gameTimer) return null;

  const elapsed = Date.now() - gameTimer.startTime;
  const remaining = Math.max(0, gameTimer.duration - elapsed);
  return remaining;
}

// Clean up timer when room is deleted
export function cleanupGameTimer(roomName: string): void {
  stopGameTimer(roomName);
}