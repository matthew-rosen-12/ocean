import { NPCGroup, DefaultMap, userId, npcId } from "./types";
import * as THREE from "three";
import { UserInfo } from "./types";

// Constants for positioning
const FOLLOW_DISTANCE = 2; // Distance behind the user

/**
 * Creates a new NPCGroup with the same content as the original,
 * but reuses the original object if the content is identical.
 */
export function createOrReuseNPCGroup(
  original: NPCGroup | undefined,
  captorId: userId,
  npcIds: Set<npcId>,
  faceNpcId?: npcId
): NPCGroup {
  // If no original group, create a new one
  if (!original) {
    const firstNpcId =
      npcIds.size > 0 ? npcIds.values().next().value : undefined;
    return {
      captorId,
      npcIds: new Set(npcIds),
      faceNpcId: faceNpcId !== undefined ? faceNpcId : firstNpcId,
    };
  }

  // Check if content is identical (including face NPC)
  const expectedFaceNpcId =
    faceNpcId !== undefined
      ? faceNpcId
      : original.faceNpcId && npcIds.has(original.faceNpcId)
      ? original.faceNpcId
      : npcIds.size > 0
      ? npcIds.values().next().value
      : undefined;

  const contentSame =
    original.captorId === captorId &&
    original.npcIds.size === npcIds.size &&
    Array.from(original.npcIds).every((id) => npcIds.has(id)) &&
    original.faceNpcId === expectedFaceNpcId;

  // If content is the same, reuse the original object
  if (contentSame) {
    return original;
  }

  // Content is different, create a new group
  return {
    captorId,
    npcIds: new Set(npcIds),
    faceNpcId: expectedFaceNpcId,
  };
}

/**
 * Updates an NPCGroups DefaultMap while preserving object identity
 * for groups that haven't changed.
 */
export function updateNPCGroupsPreservingIdentity(
  original: DefaultMap<userId, NPCGroup>,
  updates: Map<
    userId,
    { captorId: userId; npcIds: Set<npcId>; faceNpcId?: npcId }
  >
): DefaultMap<userId, NPCGroup> {
  const newGroups = new DefaultMap<userId, NPCGroup>((id: userId) => ({
    npcIds: new Set<npcId>(),
    captorId: id,
  }));

  // Copy all original groups, preserving identity where possible
  Array.from(original.entries()).forEach(([id, group]) => {
    const update = updates.get(id);
    if (update) {
      // Use the helper to preserve identity if content is the same
      newGroups.set(
        id,
        createOrReuseNPCGroup(
          group,
          update.captorId,
          update.npcIds,
          update.faceNpcId
        )
      );
    } else {
      // No update for this group, keep the original
      newGroups.set(id, group);
    }
  });

  // Add any new groups that weren't in the original
  Array.from(updates.entries()).forEach(([id, update]) => {
    if (!original.has(id)) {
      newGroups.set(
        id,
        createOrReuseNPCGroup(
          undefined,
          update.captorId,
          update.npcIds,
          update.faceNpcId
        )
      );
    }
  });

  return newGroups;
}

/**
 * Helper to add an NPC to a group while preserving group identity
 */
export function addNPCToGroup(
  groups: DefaultMap<userId, NPCGroup>,
  captorId: userId,
  npcId: npcId
): DefaultMap<userId, NPCGroup> {
  const currentGroup = groups.get(captorId);
  const newNpcIds = new Set(currentGroup.npcIds);
  newNpcIds.add(npcId);

  // If this is the first NPC in the group, make it the face NPC
  const newFaceNpcId =
    currentGroup.npcIds.size === 0 ? npcId : currentGroup.faceNpcId;

  const updates = new Map();
  updates.set(captorId, {
    captorId,
    npcIds: newNpcIds,
    faceNpcId: newFaceNpcId,
  });

  return updateNPCGroupsPreservingIdentity(groups, updates);
}

/**
 * Helper to remove an NPC from a group while preserving group identity
 */
export function removeNPCFromGroup(
  groups: DefaultMap<userId, NPCGroup>,
  captorId: userId,
  npcId: npcId
): DefaultMap<userId, NPCGroup> {
  const currentGroup = groups.get(captorId);
  const newNpcIds = new Set(currentGroup.npcIds);
  newNpcIds.delete(npcId);

  // Handle face NPC update if needed
  let newFaceNpcId = currentGroup.faceNpcId;
  if (currentGroup.faceNpcId === npcId) {
    // If the removed NPC was the face NPC, select a new one
    const remainingNpcs = Array.from(newNpcIds);
    newFaceNpcId = remainingNpcs.length > 0 ? remainingNpcs[0] : undefined;
  }

  const updates = new Map();
  updates.set(captorId, {
    captorId,
    npcIds: newNpcIds,
    faceNpcId: newFaceNpcId,
  });

  return updateNPCGroupsPreservingIdentity(groups, updates);
}

/**
 * Calculate logarithmic scale factor based on number of NPCs
 */
export function calculateNPCGroupScale(numNpcs: number): number {
  if (numNpcs === 0) return 0;

  // Logarithmic scaling function - log base 4 gives a nice curve
  // Scale starts at 3 for 1 NPC and roughly doubles for each doubling of NPCs
  const baseScale = 3;
  const logScale = Math.log(numNpcs) / Math.log(4);

  return baseScale * (1 + logScale);
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

/**
 * Get or set the face NPC for a group (the first NPC serves as the face)
 */
export function getFaceNpcId(group: NPCGroup): npcId | null {
  if (group.faceNpcId && group.npcIds.has(group.faceNpcId)) {
    return group.faceNpcId;
  }

  // If no face NPC set or it's no longer in the group, use the first NPC
  const firstNpcId =
    group.npcIds.size > 0 ? group.npcIds.values().next().value : null;
  return firstNpcId ?? null;
}

/**
 * Updates the face NPC for a group, ensuring it exists in the group
 */
export function setFaceNpcId(group: NPCGroup, faceNpcId: npcId): NPCGroup {
  if (!group.npcIds.has(faceNpcId)) {
    console.warn(`Attempted to set face NPC ${faceNpcId} that is not in group`);
    return group;
  }

  return {
    ...group,
    faceNpcId,
  };
}
