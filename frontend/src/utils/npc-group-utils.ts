import { NPCGroup, DefaultMap, userId, npcId } from "./types";

/**
 * Creates a new NPCGroup with the same content as the original,
 * but reuses the original object if the content is identical.
 */
export function createOrReuseNPCGroup(
  original: NPCGroup | undefined,
  captorId: userId,
  npcIds: Set<npcId>
): NPCGroup {
  // If no original group, create a new one
  if (!original) {
    return {
      captorId,
      npcIds: new Set(npcIds),
    };
  }

  // Check if content is identical
  const contentSame =
    original.captorId === captorId &&
    original.npcIds.size === npcIds.size &&
    Array.from(original.npcIds).every((id) => npcIds.has(id));

  // If content is the same, reuse the original object
  if (contentSame) {
    return original;
  }

  // Content is different, create a new group
  return {
    captorId,
    npcIds: new Set(npcIds),
  };
}

/**
 * Updates an NPCGroups DefaultMap while preserving object identity
 * for groups that haven't changed.
 */
export function updateNPCGroupsPreservingIdentity(
  original: DefaultMap<userId, NPCGroup>,
  updates: Map<userId, { captorId: userId; npcIds: Set<npcId> }>
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
        createOrReuseNPCGroup(group, update.captorId, update.npcIds)
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
        createOrReuseNPCGroup(undefined, update.captorId, update.npcIds)
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

  const updates = new Map();
  updates.set(captorId, { captorId, npcIds: newNpcIds });

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

  const updates = new Map();
  updates.set(captorId, { captorId, npcIds: newNpcIds });

  return updateNPCGroupsPreservingIdentity(groups, updates);
}
