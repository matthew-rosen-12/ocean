// Generated NPC background styles - Auto-generated, do not edit manually
const backgrounds = [
  {
    backgroundImage: 'url("/npc-background.png")',
    backgroundRepeat: 'repeat' as const,
    backgroundSize: 'auto' as const,
  },
  {
    backgroundImage: 'url("/animal-background.png")',
    backgroundRepeat: 'repeat' as const,
    backgroundSize: 'auto' as const,
  },
];

// Randomly choose a background each time the app loads
const randomIndex = Math.floor(Math.random() * backgrounds.length);
export const npcBackgroundStyles = backgrounds[randomIndex];
