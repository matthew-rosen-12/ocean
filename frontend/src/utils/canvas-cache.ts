// Canvas texture caching system for background patterns
// Prevents expensive canvas operations from being re-executed on every render

import * as THREE from "three";

interface CacheKey {
  width: number;
  height: number;
  type: string;
  hash?: string;
}

interface CachedCanvas {
  canvas: HTMLCanvasElement;
  texture: THREE.Texture;
  lastUsed: number;
}

class CanvasCache {
  private cache = new Map<string, CachedCanvas>();
  private maxCacheSize = 20; // Limit cache size to prevent memory issues
  private readonly cleanupInterval = 60000; // 1 minute

  constructor() {
    // Periodic cleanup of unused textures
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  private generateKey(params: CacheKey): string {
    return `${params.type}_${params.width}x${params.height}_${params.hash || ''}`;
  }

  private cleanup(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by last used time and remove oldest entries
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    
    toRemove.forEach(([key, cached]) => {
      // Dispose of THREE.js texture
      cached.texture.dispose();
      this.cache.delete(key);
    });

    console.log(`[CANVAS CACHE] Cleaned up ${toRemove.length} cached textures`);
  }

  getOrCreate(
    params: CacheKey,
    generator: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void
  ): THREE.Texture {
    const key = this.generateKey(params);
    const existing = this.cache.get(key);

    if (existing) {
      existing.lastUsed = Date.now();
      return existing.texture;
    }

    // Create new canvas and texture
    const canvas = document.createElement('canvas');
    canvas.width = params.width;
    canvas.height = params.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context');
    }

    // Generate the canvas content
    generator(canvas, ctx);

    // Create THREE.js texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Cache the result
    const cached: CachedCanvas = {
      canvas,
      texture,
      lastUsed: Date.now()
    };

    this.cache.set(key, cached);

    // Trigger cleanup if cache is getting large
    if (this.cache.size > this.maxCacheSize) {
      this.cleanup();
    }

    console.log(`[CANVAS CACHE] Created new texture: ${key} (${this.cache.size} total)`);
    
    return texture;
  }

  // Create hash for content-dependent caching
  static createHash(data: any): string {
    return JSON.stringify(data).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(36);
  }

  // Clear all cached textures (useful for development)
  clear(): void {
    this.cache.forEach(cached => {
      cached.texture.dispose();
    });
    this.cache.clear();
    console.log('[CANVAS CACHE] Cleared all cached textures');
  }

  // Get cache statistics
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

// Export singleton instance
export const canvasCache = new CanvasCache();

// Export utility functions for common background patterns
export const backgroundGenerators = {
  cloud: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    // Blue sky background - darker blue
    ctx.fillStyle = "#2F5F8F";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Batch cloud generation for better performance
    const cloudData = [];
    const cloudShades = [
      "rgba(255, 255, 255, 0.95)",
      "rgba(248, 248, 255, 0.9)",
      "rgba(245, 245, 245, 0.85)",
      "rgba(220, 220, 220, 0.8)",
      "rgba(200, 200, 200, 0.75)",
      "rgba(240, 248, 255, 0.8)",
      "rgba(230, 230, 230, 0.7)",
      "rgba(211, 211, 211, 0.65)",
    ];

    // Pre-calculate cloud positions and properties
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = 4 + Math.random() * 8;
      const shadeIndex = Math.floor(Math.random() * cloudShades.length);
      const blobCount = 3 + Math.random() * 2;
      
      cloudData.push({ x, y, size, shadeIndex, blobCount });
    }

    // Batch draw clouds by grouping similar colors
    cloudShades.forEach((shade, shadeIndex) => {
      ctx.fillStyle = shade;
      ctx.strokeStyle = `rgba(170, 170, 170, ${0.6 + Math.random() * 0.3})`;
      
      cloudData
        .filter(cloud => cloud.shadeIndex === shadeIndex)
        .forEach(cloud => {
          for (let j = 0; j < cloud.blobCount; j++) {
            const blobX = cloud.x + (Math.random() - 0.5) * cloud.size * 0.8;
            const blobY = cloud.y + (Math.random() - 0.5) * cloud.size * 0.4;
            const blobRadius = cloud.size * (0.4 + Math.random() * 0.6);
            
            ctx.beginPath();
            ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
            ctx.fill();
            
            if (Math.random() > 0.1) {
              ctx.lineWidth = 1.5 + Math.random() * 1.5;
              ctx.stroke();
            }
          }
        });
    });
  }
};