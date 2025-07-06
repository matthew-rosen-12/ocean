import { NPCInteraction, InteractionType } from './interaction-types.js';

// Re-export for convenience
export type { NPCInteraction } from './interaction-types.js';
export { InteractionType } from './interaction-types.js';

// Configuration for prompt settings
export const PROMPT_CONFIG = {
  MAX_RESPONSE_LENGTH: 50, // Maximum words in response
   RESPONSE_STYLE: 'witty, conversational and brief'
} as const;

// Helper function to get NPC name from filename
function getNPCName(filename: string): string {
  return filename.replace('.png', '').replace(/_/g, ' ').split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Prompt templates for each interaction type
const PROMPTS = {
  [InteractionType.CAPTURED_NPC_GROUP]: (npcName: string, animal?: string) => 
    `You are ${npcName}, a historical figure who has just been captured by a ${animal?.toLowerCase() || 'wild animal'} in a nature game. React to being captured by this ${animal?.toLowerCase() || 'creature'} in character. Keep your response under ${PROMPT_CONFIG.MAX_RESPONSE_LENGTH} words and be ${PROMPT_CONFIG.RESPONSE_STYLE}.`,

  [InteractionType.NPC_GROUP_DELETED]: (npcName: string, animal?: string) => 
    `You are ${npcName}, a historical figure who just went up in smoke and been deleted. Give a brief farewell or final statement in character. Keep your response under ${PROMPT_CONFIG.MAX_RESPONSE_LENGTH} words and be ${PROMPT_CONFIG.RESPONSE_STYLE}.`,

  [InteractionType.RETURNING_NPC_GROUP_RECAPTURED]: (primaryNpcName: string, secondaryNpcName: string, animal?: string) => 
    `You are ${primaryNpcName}, a historical figure who just captured ${secondaryNpcName} in a nature game. React to this capture in character, addressing or mentioning ${secondaryNpcName}. Keep your response under ${PROMPT_CONFIG.MAX_RESPONSE_LENGTH} words and be ${PROMPT_CONFIG.RESPONSE_STYLE}.`,

  [InteractionType.NPC_GROUP_EMITTED]: (primaryNpcName: string, secondaryNpcName: string, animal?: string) => 
    `You are ${primaryNpcName}, a historical figure who just got liberated by ${secondaryNpcName} in a nature game. React in character. Keep your response under ${PROMPT_CONFIG.MAX_RESPONSE_LENGTH} words and be ${PROMPT_CONFIG.RESPONSE_STYLE}.`,

  [InteractionType.THROWN_NPC_GROUP_COLLISION]: (primaryNpcName: string, secondaryNpcName: string, animal?: string) => 
    `You are ${primaryNpcName}, a historical figure whose just collided with ${secondaryNpcName}. React to this collision and emission in character. Keep your response under ${PROMPT_CONFIG.MAX_RESPONSE_LENGTH} words and be ${PROMPT_CONFIG.RESPONSE_STYLE}.`
} as const;

// Main function to convert interaction to prompt
export function interactionToPrompt(interaction: NPCInteraction): string {
  const primaryNpcName = getNPCName(interaction.npcFaceFileName);
  const animal = interaction.capturingAnimal;
  
  switch (interaction.type) {
    case InteractionType.CAPTURED_NPC_GROUP:
      return PROMPTS[InteractionType.CAPTURED_NPC_GROUP](primaryNpcName, animal);
    
    case InteractionType.NPC_GROUP_DELETED:
      return PROMPTS[InteractionType.NPC_GROUP_DELETED](primaryNpcName, animal);
    
    case InteractionType.RETURNING_NPC_GROUP_RECAPTURED:
      const recapturedNpcName = getNPCName(interaction.secondaryNpcFaceFileName);
      return PROMPTS[InteractionType.RETURNING_NPC_GROUP_RECAPTURED](primaryNpcName, recapturedNpcName, animal);
    
    case InteractionType.NPC_GROUP_EMITTED:
      const emittedNpcName = getNPCName(interaction.secondaryNpcFaceFileName);
      return PROMPTS[InteractionType.NPC_GROUP_EMITTED](primaryNpcName, emittedNpcName, animal);
    
    case InteractionType.THROWN_NPC_GROUP_COLLISION:
      const collisionEmittedNpcName = getNPCName(interaction.secondaryNpcFaceFileName);
      return PROMPTS[InteractionType.THROWN_NPC_GROUP_COLLISION](primaryNpcName, collisionEmittedNpcName, animal);
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustiveCheck: never = interaction;
      throw new Error(`Unhandled interaction type: ${(_exhaustiveCheck as any).type}`);
  }
}

// Helper function to create interactions
export const createInteraction = {
  captured: (npcFaceFileName: string, capturingAnimal?: string): NPCInteraction => ({
    type: InteractionType.CAPTURED_NPC_GROUP,
    timestamp: Date.now(),
    npcFaceFileName,
    capturingAnimal
  }),

  deleted: (npcFaceFileName: string, capturingAnimal?: string): NPCInteraction => ({
    type: InteractionType.NPC_GROUP_DELETED,
    timestamp: Date.now(),
    npcFaceFileName,
    capturingAnimal
  }),

  recaptured: (primaryNpcFaceFileName: string, secondaryNpcFaceFileName: string, capturingAnimal?: string): NPCInteraction => ({
    type: InteractionType.RETURNING_NPC_GROUP_RECAPTURED,
    timestamp: Date.now(),
    npcFaceFileName: primaryNpcFaceFileName,
    secondaryNpcFaceFileName,
    capturingAnimal
  }),

  emitted: (primaryNpcFaceFileName: string, secondaryNpcFaceFileName: string, capturingAnimal?: string): NPCInteraction => ({
    type: InteractionType.NPC_GROUP_EMITTED,
    timestamp: Date.now(),
    npcFaceFileName: primaryNpcFaceFileName,
    secondaryNpcFaceFileName,
    capturingAnimal
  }),

  thrownCollision: (primaryNpcFaceFileName: string, secondaryNpcFaceFileName: string, capturingAnimal?: string): NPCInteraction => ({
    type: InteractionType.THROWN_NPC_GROUP_COLLISION,
    timestamp: Date.now(),
    npcFaceFileName: primaryNpcFaceFileName,
    secondaryNpcFaceFileName,
    capturingAnimal
  })
} as const;