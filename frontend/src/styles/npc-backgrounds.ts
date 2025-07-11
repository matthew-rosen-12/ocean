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

// Generate random position and zoom for background
function generateRandomBackgroundStyle() {
  const randomIndex = Math.floor(Math.random() * backgrounds.length);
  const baseStyle = backgrounds[randomIndex];
  
  // Different zoom ranges for different background types
  let zoom;
  if (baseStyle.backgroundImage.includes('animal-background')) {
    // Animal backgrounds: 100% to 150%
    zoom = 1 + Math.random() * 0.5;
  } else {
    // NPC backgrounds: 100% to 200%
    zoom = 1.5 + Math.random() * 1;
  }
  
  // Random position (0-100% for both x and y)
  const positionX = Math.random() * 100;
  const positionY = Math.random() * 100;
  
  return {
    ...baseStyle,
    backgroundSize: `${zoom * 100}%`,
    backgroundPosition: `${positionX}% ${positionY}%`,
  };
}

// Randomly choose a background with random position and zoom each time the app loads
export const npcBackgroundStyles = generateRandomBackgroundStyle();
