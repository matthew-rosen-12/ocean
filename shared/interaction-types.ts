// Interaction types for NPC interactions
export enum InteractionType {
  CAPTURED_NPC_GROUP = 'CAPTURED_NPC_GROUP',
  RETURNING_NPC_GROUP_RECAPTURED = 'RETURNING_NPC_GROUP_RECAPTURED', 
  NPC_GROUP_EMITTED = 'NPC_GROUP_EMITTED',
  NPC_GROUP_DELETED = 'NPC_GROUP_DELETED',
  THROWN_NPC_GROUP_COLLISION = 'THROWN_NPC_GROUP_COLLISION'
}

// Base interaction interface
export interface BaseInteraction {
  type: InteractionType;
  timestamp: number;
  npcFaceFileName: string; // Primary NPC face (e.g., "napoleon.png")
  capturingAnimal?: string; // The animal that captured/interacted (e.g., "BEAR", "WOLF")
}

// Single NPC interactions
export interface CapturedNPCGroupInteraction extends BaseInteraction {
  type: InteractionType.CAPTURED_NPC_GROUP;
}

export interface NPCGroupDeletedInteraction extends BaseInteraction {
  type: InteractionType.NPC_GROUP_DELETED;
}

// Dual NPC interactions (involving two NPCs)
export interface ReturningNPCGroupRecapturedInteraction extends BaseInteraction {
  type: InteractionType.RETURNING_NPC_GROUP_RECAPTURED;
  secondaryNpcFaceFileName: string; // The recaptured NPC face
}

export interface NPCGroupEmittedInteraction extends BaseInteraction {
  type: InteractionType.NPC_GROUP_EMITTED;
  secondaryNpcFaceFileName: string; // The emitted NPC face
}

export interface ThrownNPCGroupCollisionInteraction extends BaseInteraction {
  type: InteractionType.THROWN_NPC_GROUP_COLLISION;
  secondaryNpcFaceFileName: string; // The face file of the NPC group that gets emitted
}

// Union type for all interactions
export type NPCInteraction = 
  | CapturedNPCGroupInteraction
  | NPCGroupDeletedInteraction
  | ReturningNPCGroupRecapturedInteraction
  | NPCGroupEmittedInteraction
  | ThrownNPCGroupCollisionInteraction;