/**
 * Deterministic random function that produces consistent results across all clients
 * Uses server-synchronized data to ensure all clients get the same "random" values
 */
export function getDeterministicRandom(input: Record<string, any>): number {
  // Create deterministic hash from server-synchronized data only
  const hashInput = Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b)) // Sort keys for consistency
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
    
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to a value between -0.5 and 0.5
  return ((hash % 1000) / 1000) - 0.5;
}