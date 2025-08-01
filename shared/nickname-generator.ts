// Shared nickname generation utility for users and bots
import { uniqueNamesGenerator, adjectives, colors } from "unique-names-generator";

// Extended noun list (~30 nouns) based on existing bot nicknames and nature theme
const nouns = [
  "Hunter", "Explorer", "Wanderer", "Seeker", "Ranger", "Scout", "Tracker", "Roamer",
  "Guardian", "Warrior", "Runner", "Stalker", "Shadow", "Spirit", "Keeper", "Watcher",
  "Rider", "Walker", "Fisher", "Climber", "Diver", "Flyer", "Jumper", "Swimmer",
  "Defender", "Protector", "Guide", "Leader", "Survivor", "Voyager"
];

export interface NicknameOptions {
  includeNumber?: boolean;
  numberDigits?: number;
}

/**
 * Generate a nickname with format: (adjective or color) + noun + optional number
 * @param options Configuration for nickname generation
 * @returns Generated nickname string
 */
export function generateNickname(options: NicknameOptions = {}): string {
  const { includeNumber = false, numberDigits = 2 } = options;
  
  // Randomly choose between adjectives and colors (50/50 chance)
  const useColor = Math.random() < 0.5;
  const descriptorPart = uniqueNamesGenerator({
    dictionaries: useColor ? [colors] : [adjectives],
    separator: "",
    style: "capital",
    length: 1,
  });
  
  // Pick a random noun
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  // Combine parts
  let nickname = `${descriptorPart}${noun}`;
  
  // Add number suffix if requested (for bots)
  if (includeNumber) {
    const maxNumber = Math.pow(10, numberDigits) - 1;
    const number = Math.floor(Math.random() * maxNumber) + 1;
    const paddedNumber = number.toString().padStart(numberDigits, '0');
    nickname += paddedNumber;
  }
  
  return nickname;
}

/**
 * Generate a user nickname (no number suffix)
 */
export function generateUserNickname(): string {
  return generateNickname({ includeNumber: false });
}

/**
 * Generate a bot nickname (with 2-digit number suffix)
 */
export function generateBotNickname(): string {
  return generateNickname({ includeNumber: true, numberDigits: 2 });
}