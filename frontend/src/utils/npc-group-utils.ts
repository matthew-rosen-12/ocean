import { NPCGroup, DefaultMap, userId, npcGroupId, UserInfo, fileName, NPCPhase, Position, Direction } from "shared/types";
import * as THREE from "three";

// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user

/**
 * Creates a new NPCGroup with the same content as the original,
 * but reuses the original object if the content is identical.
 */
export function createOrReuseNPCGroup(
  original: NPCGroup | undefined,
  id: npcGroupId,
  fileNames: fileName[],
  captorId?: userId,
  position?: Position,
  direction?: Direction,
  phase?: NPCPhase
): NPCGroup {
  // If no original group, create a new one
  if (!original) {
    return new NPCGroup({
      id,
      fileNames: [...fileNames],
      captorId,
      position: position || { x: 0, y: 0 },
      direction: direction || { x: 0, y: 0 },
      phase: phase || NPCPhase.IDLE,
    });
  }

  // Check if content is identical
  const contentSame =
    original.id === id &&
    original.captorId === captorId &&
    original.fileNames.length === fileNames.length &&
    original.fileNames.every((fileName, index) => fileNames[index] === fileName) &&
    original.position.x === (position?.x || original.position.x) &&
    original.position.y === (position?.y || original.position.y) &&
    original.direction.x === (direction?.x || original.direction.x) &&
    original.direction.y === (direction?.y || original.direction.y) &&
    original.phase === (phase || original.phase);

  // If content is the same, reuse the original object
  if (contentSame) {
    return original;
  }

  // Content is different, create a new group
  return new NPCGroup({
    id,
    fileNames: [...fileNames],
    captorId,
    position: position || original.position,
    direction: direction || original.direction,
    phase: phase || original.phase,
  });
}

/**
 * Updates an NPCGroups DefaultMap while preserving object identity
 * for groups that haven't changed.
 */
export function updateNPCGroupsPreservingIdentity(
  original: DefaultMap<userId, NPCGroup>,
  updates: Map<
    userId,
    { 
      id: npcGroupId;
      fileNames: fileName[];
      captorId?: userId;
      position?: Position;
      direction?: Direction;
      phase?: NPCPhase;
    }
  >
): DefaultMap<userId, NPCGroup> {
  const newGroups = new DefaultMap<userId, NPCGroup>((userId: userId) => 
    new NPCGroup({
      id: `${userId}-group`,
      fileNames: [],
      captorId: userId,
      position: { x: 0, y: 0 },
      direction: { x: 0, y: 0 },
      phase: NPCPhase.IDLE,
    })
  );

  // Copy all original groups, preserving identity where possible
  Array.from(original.entries()).forEach(([userId, group]) => {
    const update = updates.get(userId);
    if (update) {
      // Use the helper to preserve identity if content is the same
      newGroups.set(
        userId,
        createOrReuseNPCGroup(
          group,
          update.id,
          update.fileNames,
          update.captorId,
          update.position,
          update.direction,
          update.phase
        )
      );
    } else {
      // No update for this group, keep the original
      newGroups.set(userId, group);
    }
  });

  // Add any new groups that weren't in the original
  Array.from(updates.entries()).forEach(([userId, update]) => {
    if (!original.has(userId)) {
      newGroups.set(
        userId,
        createOrReuseNPCGroup(
          undefined,
          update.id,
          update.fileNames,
          update.captorId,
          update.position,
          update.direction,
          update.phase
        )
      );
    }
  });

  return newGroups;
}

/**
 * Helper to add a fileName to a group while preserving group identity
 */
export function addFileNameToGroup(
  groups: DefaultMap<userId, NPCGroup>,
  captorId: userId,
  fileName: fileName
): DefaultMap<userId, NPCGroup> {
  const currentGroup = groups.get(captorId);
  const newFileNames = [...currentGroup.fileNames, fileName];

  const updates = new Map();
  updates.set(captorId, {
    id: currentGroup.id,
    fileNames: newFileNames,
    captorId,
    position: currentGroup.position,
    direction: currentGroup.direction,
    phase: currentGroup.phase,
  });

  return updateNPCGroupsPreservingIdentity(groups, updates);
}

/**
 * Helper to remove a fileName from a group while preserving group identity
 */
export function removeFileNameFromGroup(
  groups: DefaultMap<userId, NPCGroup>,
  captorId: userId,
  fileName: fileName
): DefaultMap<userId, NPCGroup> {
  const currentGroup = groups.get(captorId);
  const newFileNames = currentGroup.fileNames.filter(f => f !== fileName);

  const updates = new Map();
  updates.set(captorId, {
    id: currentGroup.id,
    fileNames: newFileNames,
    captorId,
    position: currentGroup.position,
    direction: currentGroup.direction,
    phase: currentGroup.phase,
  });

  return updateNPCGroupsPreservingIdentity(groups, updates);
}

/**
 * Calculate logarithmic proportion factor based on number of fileNames in group
 * This is the core scaling function used for size, speed, and distance calculations
 */
export function calculateNPCGroupProportion(numFileNames: number): number {
  if (numFileNames === 0) return 0;

  // Logarithmic scaling function - log base 4 gives a nice curve
  // Starts at 1 for 1 fileName and roughly doubles for each doubling of fileNames
  const logProportion = Math.log(numFileNames) / Math.log(4);

  return 1 + logProportion;
}

/**
 * Calculate visual scale factor based on number of fileNames in group
 */
export function calculateNPCGroupScale(numFileNames: number): number {
  if (numFileNames === 0) return 0;

  // Use the proportion function with a base scale multiplier
  const baseScale = 3;
  return baseScale * calculateNPCGroupProportion(numFileNames);
}

/**
 * Calculate path velocity factor based on group size
 */
export function calculateNPCGroupVelocityFactor(numFileNames: number): number {
  if (numFileNames === 0) return 1;
  
  // Larger groups throw faster (square root scaling for reasonable progression)
  return Math.sqrt(calculateNPCGroupProportion(numFileNames));
}

/**
 * Calculate path distance factor based on group size  
 */
export function calculateNPCGroupDistanceFactor(numFileNames: number): number {
  if (numFileNames === 0) return 1;
  
  // Larger groups travel farther (linear scaling with the proportion)
  return calculateNPCGroupProportion(numFileNames);
}

/**
 * Calculate target position for NPC group behind the user based on their direction
 */
export function calculateNPCGroupPosition(
  user: UserInfo,
  animalWidth: number,
  npcScale: number
): THREE.Vector3 {
  // Default direction if not specified (backward is -x)
  let directionX = -1;
  let directionY = 0;

  // If user has a direction, use the inverse of it to position behind
  if (user.direction) {
    // Normalize direction
    const length = Math.sqrt(
      user.direction.x * user.direction.x + user.direction.y * user.direction.y
    );
    if (length > 0.001) {
      directionX = -user.direction.x / length; // Opposite X direction
      directionY = -user.direction.y / length; // Opposite Y direction
    }
  }

  // Calculate position that is animalWidth + scaled NPC width + FOLLOW_DISTANCE units behind the user
  const npcWidth = npcScale; // The scaled width of the NPC mesh

  const targetPosition = new THREE.Vector3(
    user.position.x +
      directionX * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
    user.position.y +
      directionY * (animalWidth / 2 + npcWidth / 2 + FOLLOW_DISTANCE),
    0.05 // Place in front of wave grid
  );

  return targetPosition;
}

