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
  // Variable row offset for different starting indices per row
  
  // Create a larger pattern to avoid visible tiling at 4x zoom out
  const cols = 32; // 4x larger for 4x zoom out
  const rows = 16; // 4x larger for 4x zoom out
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
  
  // Create a grid to store which NPC is at each position
  const grid = Array(rows).fill(null).map(() => Array(cols).fill(-1));
  
  // Simple deterministic random number generator for consistent results
  let randomSeed = seed;
  const nextRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  let imagesLoaded = 0;
  let imagesFailed = 0;
  
  // Fill grid with NPCs, avoiding neighboring duplicates (including wraparound)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Get list of neighbors (including wraparound for tiling)
      const neighbors = [];
      
      // Calculate wrapped coordinates
      const upRow = row > 0 ? row - 1 : rows - 1;
      const downRow = (row + 1) % rows;
      const leftCol = col > 0 ? col - 1 : cols - 1;
      const rightCol = (col + 1) % cols;
      
      // Check cardinal directions (up, down, left, right)
      if (grid[upRow][col] !== -1) neighbors.push(grid[upRow][col]);
      if (grid[row][leftCol] !== -1) neighbors.push(grid[row][leftCol]);
      if (grid[downRow][col] !== -1) neighbors.push(grid[downRow][col]);
      if (grid[row][rightCol] !== -1) neighbors.push(grid[row][rightCol]);
      
      // Check diagonal directions
      if (grid[upRow][leftCol] !== -1) neighbors.push(grid[upRow][leftCol]); // up-left
      if (grid[upRow][rightCol] !== -1) neighbors.push(grid[upRow][rightCol]); // up-right
      if (grid[downRow][leftCol] !== -1) neighbors.push(grid[downRow][leftCol]); // down-left
      if (grid[downRow][rightCol] !== -1) neighbors.push(grid[downRow][rightCol]); // down-right
      
      // Create list of available NPCs (excluding neighbors)
      const availableNPCs = [];
      for (let i = 0; i < selectedNPCs.length; i++) {
        if (!neighbors.includes(i)) {
          availableNPCs.push(i);
        }
      }
      
      // Randomly select from available NPCs
      const selectedIndex = Math.floor(nextRandom() * availableNPCs.length);
      const npcIndex = availableNPCs[selectedIndex];
      grid[row][col] = npcIndex;
    }
  }
  
  // Draw NPCs based on grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing + spacing / 2;
      const y = row * spacing + spacing / 2;
      
      // Skip if position extends beyond pattern bounds
      if (x < npcSize/2 || x > patternWidth - npcSize/2 || 
          y < npcSize/2 || y > patternHeight - npcSize/2) continue;
      
      const npcIndex = grid[row][col];
      const npcFile = selectedNPCs[npcIndex];
      
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
  // Variable row offset for different starting indices per row
  
  // Create a larger pattern to avoid visible tiling at 1.5x zoom out
  const cols = 12; // 1.5x larger for 1.5x zoom out
  const rows = 6; // 1.5x larger for 1.5x zoom out
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
  
  // Create a grid to store which animal is at each position
  const grid = Array(rows).fill(null).map(() => Array(cols).fill(-1));
  
  // Simple deterministic random number generator for consistent results
  let randomSeed = seed;
  const nextRandom = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  let imagesLoaded = 0;
  let imagesFailed = 0;
  
  // Fill grid with animals, avoiding neighboring duplicates (including wraparound)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Get list of neighbors (including wraparound for tiling)
      const neighbors = [];
      
      // Calculate wrapped coordinates
      const upRow = row > 0 ? row - 1 : rows - 1;
      const downRow = (row + 1) % rows;
      const leftCol = col > 0 ? col - 1 : cols - 1;
      const rightCol = (col + 1) % cols;
      
      // Check cardinal directions (up, down, left, right)
      if (grid[upRow][col] !== -1) neighbors.push(grid[upRow][col]);
      if (grid[row][leftCol] !== -1) neighbors.push(grid[row][leftCol]);
      if (grid[downRow][col] !== -1) neighbors.push(grid[downRow][col]);
      if (grid[row][rightCol] !== -1) neighbors.push(grid[row][rightCol]);
      
      // Check diagonal directions
      if (grid[upRow][leftCol] !== -1) neighbors.push(grid[upRow][leftCol]); // up-left
      if (grid[upRow][rightCol] !== -1) neighbors.push(grid[upRow][rightCol]); // up-right
      if (grid[downRow][leftCol] !== -1) neighbors.push(grid[downRow][leftCol]); // down-left
      if (grid[downRow][rightCol] !== -1) neighbors.push(grid[downRow][rightCol]); // down-right
      
      // Create list of available animals (excluding neighbors)
      const availableAnimals = [];
      for (let i = 0; i < selectedAnimals.length; i++) {
        if (!neighbors.includes(i)) {
          availableAnimals.push(i);
        }
      }
      
      // Randomly select from available animals
      const selectedIndex = Math.floor(nextRandom() * availableAnimals.length);
      const animalIndex = availableAnimals[selectedIndex];
      grid[row][col] = animalIndex;
    }
  }
  
  // Draw animals based on grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing + spacing / 2;
      const y = row * spacing + spacing / 2;
      
      // Skip if position extends beyond pattern bounds
      if (x < animalSize/2 || x > patternWidth - animalSize/2 || 
          y < animalSize/2 || y > patternHeight - animalSize/2) continue;
      
      const animalIndex = grid[row][col];
      const animalFile = selectedAnimals[animalIndex];
      
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
    // Animal backgrounds: 75% to 100%
    zoom = 0.75 + Math.random() * 0.5;
  } else {
    // NPC backgrounds: 50% to 150%
    zoom = 0.5 + Math.random() * 1.25;
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