"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInitialPosition = getInitialPosition;
exports.getInitialDirection = getInitialDirection;
function getInitialPosition(terrainBoundaries) {
    if (terrainBoundaries) {
        // Generate position within terrain boundaries with some padding
        const padding = 5; // Stay 5 units away from edges
        const x = Math.random() * (terrainBoundaries.maxX - terrainBoundaries.minX - 2 * padding) + terrainBoundaries.minX + padding;
        const y = Math.random() * (terrainBoundaries.maxY - terrainBoundaries.minY - 2 * padding) + terrainBoundaries.minY + padding;
        return { x, y };
    }
    // Fallback to original hardcoded values if no terrain boundaries provided
    const x = Math.random() * 20 - 0.5;
    const y = Math.random() * 20 - 1.5;
    return { x, y };
}
function getInitialDirection() {
    return { x: 0, y: 0 };
}
