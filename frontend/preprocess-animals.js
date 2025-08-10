#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG path parser to extract geometry data
function parseSVGPath(pathData) {
  const commands = [];
  const regex = /([MLHVCSQTAZ])\s*([^MLHVCSQTAZ]*)/gi;
  let match;

  while ((match = regex.exec(pathData)) !== null) {
    const command = match[1];
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    commands.push({ command, args });
  }

  return commands;
}

// Extract points from SVG path commands
function extractPoints(commands) {
  const points = [];
  let currentX = 0, currentY = 0;

  for (const { command, args } of commands) {
    switch (command.toUpperCase()) {
      case 'M':
        if (command === 'M') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        points.push([currentX, currentY]);
        break;
      case 'L':
        if (command === 'L') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        points.push([currentX, currentY]);
        break;
      case 'H':
        if (command === 'H') {
          currentX = args[0];
        } else {
          currentX += args[0];
        }
        points.push([currentX, currentY]);
        break;
      case 'V':
        if (command === 'V') {
          currentY = args[0];
        } else {
          currentY += args[0];
        }
        points.push([currentX, currentY]);
        break;
      case 'C':
        // For cubic bezier, we'll just take the end point
        if (command === 'C') {
          currentX = args[4];
          currentY = args[5];
        } else {
          currentX += args[4];
          currentY += args[5];
        }
        points.push([currentX, currentY]);
        break;
      case 'S':
        // For smooth cubic bezier
        if (command === 'S') {
          currentX = args[2];
          currentY = args[3];
        } else {
          currentX += args[2];
          currentY += args[3];
        }
        points.push([currentX, currentY]);
        break;
      case 'Q':
        // For quadratic bezier
        if (command === 'Q') {
          currentX = args[2];
          currentY = args[3];
        } else {
          currentX += args[2];
          currentY += args[3];
        }
        points.push([currentX, currentY]);
        break;
      case 'T':
        // For smooth quadratic bezier
        if (command === 'T') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        points.push([currentX, currentY]);
        break;
      case 'A':
        // For arc, just take the end point
        if (command === 'A') {
          currentX = args[5];
          currentY = args[6];
        } else {
          currentX += args[5];
          currentY += args[6];
        }
        points.push([currentX, currentY]);
        break;
      case 'Z':
        // Close path - no new point needed
        break;
    }
  }

  return points;
}

// Simple concave hull algorithm (simplified version)
function simpleConvexHull(points) {
  if (points.length < 3) return points;

  // Sort points by x-coordinate
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Build lower hull
  const lower = [];
  for (let i = 0; i < points.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
      lower.pop();
    }
    lower.push(points[i]);
  }

  // Build upper hull
  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
      upper.pop();
    }
    upper.push(points[i]);
  }

  // Remove last point of each half because it's repeated
  upper.pop();
  lower.pop();

  return lower.concat(upper);
}

function cross(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

// Process a single SVG file
function processSVGFile(filePath, animalName) {
  
  
  const svgContent = fs.readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  const paths = svgDoc.getElementsByTagName('path');
  const allPoints = [];
  const pathData = [];
  
  // Extract viewBox or calculate bounds
  const svgElement = svgDoc.getElementsByTagName('svg')[0];
  let viewBox = svgElement.getAttribute('viewBox');
  let bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  
  if (viewBox) {
    const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
    bounds = { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }
  
  // Process each path
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const d = path.getAttribute('d');
    const fill = path.getAttribute('fill');
    const id = path.getAttribute('id');
    
    if (d) {
      // Check if this is a background rectangle path that covers the entire canvas
      const isBackgroundRect = d.match(/^M\s*0\.?0*\s*0\.?0*\s*L\s*\d+\.?0*\s*0\.?0*\s*L\s*\d+\.?0*\s*\d+\.?0*\s*L\s*0\.?0*\s*\d+\.?0*\s*L\s*0\.?0*\s*0\.?0*\s*Z/);
      
      if (isBackgroundRect) {
        continue; // Skip this path as it's a background rectangle
      }
      
      const commands = parseSVGPath(d);
      const points = extractPoints(commands);
      
      pathData.push({
        id: id || `path-${i}`,
        fill: fill || '#000000',
        d: d,
        points: points
      });
      
      allPoints.push(...points);
    }
  }
  
  // Calculate bounds from points and add consistent padding
  if (allPoints.length > 0) {
    const xs = allPoints.map(p => p[0]);
    const ys = allPoints.map(p => p[1]);
    const pathBounds = {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys)
    };
    
    // Add consistent padding around all sides
    const padding = 50; // Adjust this value as needed
    bounds = {
      minX: pathBounds.minX - padding,
      minY: pathBounds.minY - padding,
      maxX: pathBounds.maxX + padding,
      maxY: pathBounds.maxY + padding
    };
  } else {
    // Fallback to viewBox if no paths found
    if (viewBox) {
      const [vbX, vbY, vbW, vbH] = viewBox.split(/\s+/).map(Number);
      bounds = { minX: vbX, minY: vbY, maxX: vbX + vbW, maxY: vbY + vbH };
    }
  }
  
  // Create outline from all points
  const outline = allPoints.length > 0 ? simpleConvexHull([...allPoints]) : [];
  
  // Find outline path specifically
  const outlinePath = pathData.find(p => p.id === 'outline');
  
  // Create a cleaned SVG and fix viewBox for proper scaling
  let cleanedSvg = svgContent;
  let needsViewBoxFix = false;
  
  // Parse the SVG to check and fix issues
  const svgParser = new DOMParser();
  const cleanSvgDoc = svgParser.parseFromString(svgContent, 'image/svg+xml');
  const svgRoot = cleanSvgDoc.documentElement;
  const svgPaths = cleanSvgDoc.getElementsByTagName('path');
  
  // Remove background rectangle paths if they exist
  if (pathData.length < paths.length) {
    needsViewBoxFix = true;
    
    for (let i = svgPaths.length - 1; i >= 0; i--) {
      const path = svgPaths[i];
      const d = path.getAttribute('d');
      if (d) {
        const isBackgroundRect = d.match(/^M\s*0\.?0*\s*0\.?0*\s*L\s*\d+\.?0*\s*0\.?0*\s*L\s*\d+\.?0*\s*\d+\.?0*\s*L\s*0\.?0*\s*\d+\.?0*\s*L\s*0\.?0*\s*0\.?0*\s*Z/);
        if (isBackgroundRect) {
          path.parentNode.removeChild(path);
        }
      }
    }
  }
  
  // Always fix viewBox to match our calculated bounds with padding
  if (allPoints.length > 0) {
    needsViewBoxFix = true;
  }
  
  // Apply viewBox fix if needed
  if (needsViewBoxFix) {
    const newViewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`;
    svgRoot.setAttribute('viewBox', newViewBox);
    
    // Serialize the cleaned SVG
    const serializer = new XMLSerializer();
    cleanedSvg = serializer.serializeToString(cleanSvgDoc);
  }
  
  const cacheData = {
    animalName,
    bounds,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    paths: pathData,
    outline: outline,
    outlinePath: outlinePath || null,
    originalSvg: cleanedSvg,
    timestamp: Date.now()
  };
  
  return cacheData;
}

// Main processing function
function main() {
  const animalsDir = path.join(__dirname, 'public', 'animals');
  const cacheDir = path.join(__dirname, 'public', 'animal-cache');
  
  // Create cache directory
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  // Get all SVG files
  const svgFiles = fs.readdirSync(animalsDir).filter(file => file.endsWith('.svg'));
  
  
  
  const processedAnimals = [];
  
  for (const file of svgFiles) {
    const animalName = path.basename(file, '.svg').toUpperCase();
    const filePath = path.join(animalsDir, file);
    
    try {
      const cacheData = processSVGFile(filePath, animalName);
      
      // Save individual cache file
      const cacheFilePath = path.join(cacheDir, `${animalName}.json`);
      fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
      
      processedAnimals.push({
        name: animalName,
        file: file,
        cacheFile: `${animalName}.json`,
        bounds: cacheData.bounds,
        pathCount: cacheData.paths.length
      });
      
      
      
    } catch (error) {
      console.error(`✗ Error processing ${animalName}:`, error.message);
    }
  }
  
  // Save manifest
  const manifest = {
    generated: new Date().toISOString(),
    animals: processedAnimals,
    count: processedAnimals.length
  };
  
  fs.writeFileSync(path.join(cacheDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  
  
  
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}