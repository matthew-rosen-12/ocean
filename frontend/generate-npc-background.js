import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All NPC PNG files from the public/npcs directory
const NPC_FILES = [
  "ada_lovelace.png",
  "akbar.png", 
  "angela_merkel.png",
  "beethoven.png",
  "benjamin_franklin.png",
  "boudica.png",
  "bruce_lee.png",
  "chang_e.png",
  "cleopatra.png",
  "da_vinci.png",
  "emperor_meiji.png",
  "fdr.png",
  "florence_nightingale.png",
  "fred_astaire.png",
  "frederick_douglass.png",
  "girl_with_a_pearl_earring.png",
  "hermes.png",
  "isaac_netwon.png",
  "jane_austen.png",
  "jim_thorpe.png",
  "julia_codesido.png",
  "julius_caesar.png",
  "leif_erikson.png",
  "mansa_musa.png",
  "margaret_thatcher.png",
  "marie_curie.png",
  "mary_queen_of_scots.png",
  "mary_wollenstonecraft.png",
  "morgan_la_fey.png",
  "napoleon_bonaparte.png",
  "nelson_mandela.png",
  "nzinga_of_ndongo_and_matamba.png",
  "queen_elizabeth_I.png",
  "queen_lili_uokalani.png",
  "robinhood.png",
  "rumi.png",
  "sacagawea.png",
  "shakespeare.png",
  "sukarno.png",
  "winston_churchill.png",
];

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
  const rowOffset = 60; // Offset for alternating rows
  
  // Create a larger tileable pattern to show more NPCs
  const patternWidth = 1080; // 9 columns * 120px spacing
  const patternHeight = 720; // 6 rows * 120px spacing
  
  const canvas = createCanvas(patternWidth, patternHeight);
  const ctx = canvas.getContext('2d');
  
  // Subtle background color
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, patternWidth, patternHeight);
  
  // Use all NPCs for maximum variety
  const selectedNPCs = deterministicShuffle(NPC_FILES, seed);
  
  const cols = Math.ceil(patternWidth / spacing);
  const rows = Math.ceil(patternHeight / spacing);
  
  let npcIndex = 0;
  let imagesLoaded = 0;
  let imagesFailed = 0;
  
  // Load and draw NPCs
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEvenRow = row % 2 === 0;
      const xOffset = isEvenRow ? 0 : rowOffset;
      
      const x = col * spacing + xOffset + spacing / 2;
      const y = row * spacing + spacing / 2;
      
      // Skip if position is outside canvas
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

async function main() {
  try {
    // Generate different background PNG patterns with different seeds
    const backgrounds = [
      { seed: 42, name: 'npc-background-default.png' },
      { seed: 123, name: 'npc-background-alt1.png' },
      { seed: 789, name: 'npc-background-alt2.png' }
    ];
    
    for (const bg of backgrounds) {
      console.log(`\nGenerating ${bg.name}...`);
      const canvas = await generateNPCBackgroundPNG(bg.seed);
      
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
export const npcBackgroundStyles = {
  default: {
    backgroundImage: 'url("/npc-background-default.png")',
    backgroundRepeat: 'repeat' as const,
    backgroundSize: 'auto' as const,
  },
  alt1: {
    backgroundImage: 'url("/npc-background-alt1.png")',
    backgroundRepeat: 'repeat' as const,
    backgroundSize: 'auto' as const,
  },
  alt2: {
    backgroundImage: 'url("/npc-background-alt2.png")',
    backgroundRepeat: 'repeat' as const,
    backgroundSize: 'auto' as const,
  },
};

export type NPCBackgroundVariant = keyof typeof npcBackgroundStyles;
`;
    
    const stylesPath = path.join(__dirname, 'src', 'styles', 'npc-backgrounds.ts');
    fs.writeFileSync(stylesPath, backgroundStyles);
    console.log(`✓ Saved npc-backgrounds.ts (${(backgroundStyles.length / 1024).toFixed(1)}KB)`);
    
    console.log('\n🎉 All NPC background PNGs generated successfully!');
  } catch (error) {
    console.error('Error generating NPC backgrounds:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}