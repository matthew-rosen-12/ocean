/* eslint-env node */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { ANIMAL_SCALES } from '../shared/dist/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read NPC PNG files dynamically from the public/npcs directory
function getNPCFiles() {
  const npcsDir = path.join(__dirname, 'public', 'npcs');
  return fs.readdirSync(npcsDir).filter(file => file.endsWith('.png'));
}

// Read animal SVG files dynamically from the public/animals directory
function getAnimalFiles() {
  const animalsDir = path.join(__dirname, 'public', 'animals');
  return fs.readdirSync(animalsDir).filter(file => file.endsWith('.svg'));
}

// Shuffle function for deterministic randomization
function deterministicShuffle(array, seed) {
  const shuffled = [...array];
  let currentIndex = shuffled.length;

  // Simple linear congruential generator for deterministic randomness
  const random = (seed) => {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    seed = (a * seed + c) % m;
    return seed / m;
  };

  while (currentIndex !== 0) {
    seed = Math.floor(random(seed) * 10000);
    const randomIndex = Math.floor(random(seed) * currentIndex);
    currentIndex -= 1;

    const temporaryValue = shuffled[currentIndex];
    shuffled[currentIndex] = shuffled[randomIndex];
    shuffled[randomIndex] = temporaryValue;
  }

  return shuffled;
}

async function generateNPCBackgroundPNG(seed = 42) {
  console.log(`Generating NPC background PNG with seed ${seed}...`);
  
  // Configuration for NPC arrangement
  const npcSize = 80; // Size of each NPC image
  const spacing = 120; // Space between NPCs
  const rowOffset = 0; // No offset for perfect tiling
  
  // Create a tileable pattern that properly handles row offset
  // The pattern needs to accommodate the offset for seamless horizontal tiling
  const cols = 8;
  const rows = 4;
  const patternWidth = spacing * cols; // Base width
  const patternHeight = spacing * rows; // Base height
  
  const canvas = createCanvas(patternWidth, patternHeight);
  const ctx = canvas.getContext('2d');
  
  // Subtle background color
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, patternWidth, patternHeight);
  
  // Use all NPCs for maximum variety
  const npcFiles = getNPCFiles();
  const selectedNPCs = deterministicShuffle(npcFiles, seed);
  
  // cols and rows already defined above
  
  let npcIndex = 0;
  let imagesLoaded = 0;
  let imagesFailed = 0;
  
  // Load and draw NPCs
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEvenRow = row % 2 === 0;
      const xOffset = isEvenRow ? 0 : rowOffset;
      
      // Position with proper spacing for seamless tiling
      const x = col * spacing + xOffset + spacing / 2;
      const y = row * spacing + spacing / 2;
      
      // Skip if position extends beyond pattern bounds
      if (x < npcSize/2 || x > patternWidth - npcSize/2 || 
          y < npcSize/2 || y > patternHeight - npcSize/2) continue;
      
      // Get NPC file (cycle through the list)
      const npcFile = selectedNPCs[npcIndex % selectedNPCs.length];
      npcIndex++;
      
      const imagePath = path.join(__dirname, 'public', 'npcs', npcFile);
      
      try {
        // Load and draw the NPC image
        const image = await loadImage(imagePath);
        
        // Draw with slight transparency for better blending
        ctx.globalAlpha = 0.8;
        ctx.drawImage(
          image,
          x - npcSize / 2,
          y - npcSize / 2,
          npcSize,
          npcSize
        );
        ctx.globalAlpha = 1.0;
        
        imagesLoaded++;
      } catch (error) {
        console.warn(`Failed to load ${npcFile} at position (${x}, ${y}):`, error.message);
        // Fallback: draw a circle with the NPC's initial
        const npcName = npcFile.replace('.png', '').replace(/_/g, ' ');
        const initial = npcName.charAt(0).toUpperCase();
        
        // Draw background circle
        ctx.fillStyle = `hsl(${(npcIndex * 137.5) % 360}, 40%, 85%)`;
        ctx.beginPath();
        ctx.arc(x, y, npcSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = `hsl(${(npcIndex * 137.5) % 360}, 40%, 70%)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw initial
        ctx.fillStyle = `hsl(${(npcIndex * 137.5) % 360}, 40%, 30%)`;
        ctx.font = `bold ${npcSize / 3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, x, y);
        
        imagesFailed++;
        console.warn(`Failed to load ${npcFile}, using fallback`);
      }
    }
  }
  
  console.log(`PNG generation complete: ${imagesLoaded} images loaded, ${imagesFailed} fallbacks used`);
  
  return canvas;
}

async function generateAnimalBackgroundPNG(seed = 42) {
  console.log(`Generating animal background PNG with seed ${seed}...`);
  
  // Configuration for animal arrangement - match NPC configuration
  const animalSize = 80; // Same size as NPCs for consistency
  const spacing = 120; // Same spacing as NPCs
  const rowOffset = 0; // No offset for perfect tiling
  
  // Create a tileable pattern that properly handles row offset
  // The pattern needs to accommodate the offset for seamless horizontal tiling
  const cols = 8;
  const rows = 4;
  const patternWidth = spacing * cols; // Base width
  const patternHeight = spacing * rows; // Base height
  
  const canvas = createCanvas(patternWidth, patternHeight);
  const ctx = canvas.getContext('2d');
  
  // Subtle background color
  ctx.fillStyle = '#f0f9ff';
  ctx.fillRect(0, 0, patternWidth, patternHeight);
  
  // Use all animals for maximum variety
  const animalFiles = getAnimalFiles();
  const selectedAnimals = deterministicShuffle(animalFiles, seed);
  
  // cols and rows already defined above
  
  let animalIndex = 0;
  let imagesLoaded = 0;
  let imagesFailed = 0;
  
  // Load and draw animals
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEvenRow = row % 2 === 0;
      const xOffset = isEvenRow ? 0 : rowOffset;
      
      // Position with proper spacing for seamless tiling
      const x = col * spacing + xOffset + spacing / 2;
      const y = row * spacing + spacing / 2;
      
      // Skip if position extends beyond pattern bounds
      if (x < animalSize/2 || x > patternWidth - animalSize/2 || 
          y < animalSize/2 || y > patternHeight - animalSize/2) continue;
      
      // Get animal file (cycle through the list)
      const animalFile = selectedAnimals[animalIndex % selectedAnimals.length];
      animalIndex++;
      
      const imagePath = path.join(__dirname, 'public', 'animals', animalFile);
      
      try {
        // Load and draw the animal image
        const image = await loadImage(imagePath);
        
        // Use animal scales from shared/types.ts to maintain relative sizes
        const animalName = animalFile.replace('.svg', '').toUpperCase();
        const animalScale = ANIMAL_SCALES[animalName] || 1.0;
        
        // Calculate aspect ratio from image
        const imageAspect = image.width / image.height;
        
        // Base size that gets scaled by animal scale
        const baseSize = 30; // Medium base unit size - between 20 and 40
        const scaledSize = baseSize * animalScale;
        
        // Apply aspect ratio while maintaining scale
        let drawWidth, drawHeight;
        if (imageAspect > 1) {
          // Wider than tall
          drawWidth = scaledSize;
          drawHeight = scaledSize / imageAspect;
        } else {
          // Taller than wide
          drawHeight = scaledSize;
          drawWidth = scaledSize * imageAspect;
        }
        
        // Draw with slight transparency for better blending, same as NPCs
        ctx.globalAlpha = 0.8;
        ctx.drawImage(
          image,
          x - drawWidth / 2,
          y - drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.globalAlpha = 1.0;
        
        imagesLoaded++;
      } catch (error) {
        console.warn(`Failed to load ${animalFile} at position (${x}, ${y}):`, error.message);
        // Fallback: draw a circle with the animal's initial
        const animalName = animalFile.replace('.svg', '').replace(/_/g, ' ');
        const initial = animalName.charAt(0).toUpperCase();
        
        // Draw background circle
        ctx.fillStyle = `hsl(${(animalIndex * 137.5) % 360}, 50%, 85%)`;
        ctx.beginPath();
        ctx.arc(x, y, animalSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = `hsl(${(animalIndex * 137.5) % 360}, 50%, 70%)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw initial
        ctx.fillStyle = `hsl(${(animalIndex * 137.5) % 360}, 50%, 30%)`;
        ctx.font = `bold ${animalSize / 3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, x, y);
        
        imagesFailed++;
        console.warn(`Failed to load ${animalFile}, using fallback`);
      }
    }
  }
  
  console.log(`Animal PNG generation complete: ${imagesLoaded} images loaded, ${imagesFailed} fallbacks used`);
  
  return canvas;
}

async function main() {
  try {
    // Generate both NPC and animal background patterns
    const backgrounds = [
      { type: 'npc', seed: 42, name: 'npc-background.png', generator: generateNPCBackgroundPNG },
      { type: 'animal', seed: 123, name: 'animal-background.png', generator: generateAnimalBackgroundPNG }
    ];
    
    for (const bg of backgrounds) {
      console.log(`\nGenerating ${bg.name}...`);
      const canvas = await bg.generator(bg.seed);
      
      // Save PNG to public directory
      const publicDir = path.join(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      const outputPath = path.join(publicDir, bg.name);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`✓ Saved ${bg.name} (${(buffer.length / 1024).toFixed(1)}KB)`);
    }
    
    // Also generate a TypeScript file with background styles for React components
    const backgroundStyles = `// Generated NPC background styles - Auto-generated, do not edit manually
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
    // Animal backgrounds: 50% to 100%
    zoom = 0.5 + Math.random() * 0.5;
  } else {
    // NPC backgrounds: 25% to 300%
    zoom = 0.25 + Math.random() * 2.75;
  }
  
  // Random position (0-100% for both x and y)
  const positionX = Math.random() * 100;
  const positionY = Math.random() * 100;
  
  return {
    ...baseStyle,
    backgroundSize: \`\${zoom * 100}%\`,
    backgroundPosition: \`\${positionX}% \${positionY}%\`,
  };
}

// Randomly choose a background with random position and zoom each time the app loads
export const npcBackgroundStyles = generateRandomBackgroundStyle();
`;
    
    const stylesPath = path.join(__dirname, 'src', 'styles', 'npc-backgrounds.ts');
    fs.writeFileSync(stylesPath, backgroundStyles);
    console.log(`✓ Saved npc-backgrounds.ts (${(backgroundStyles.length / 1024).toFixed(1)}KB)`);
    
    console.log('\n🎉 All background PNGs generated successfully!');
  } catch (error) {
    console.error('Error generating NPC backgrounds:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}