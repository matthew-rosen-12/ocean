/**
 * Animation Pool for optimizing animation callback registration
 * Reduces overhead by batching similar animation types
 */

type AnimationCallback = (state: unknown, delta: number) => void;

interface PooledAnimation {
  id: string;
  callback: AnimationCallback;
  isActive: boolean;
  lastUpdate: number;
}

export class AnimationPool {
  private static pools: Map<string, Map<string, PooledAnimation>> = new Map();
  private static registeredPools: Set<string> = new Set();

  /**
   * Register an animation in a specific pool
   * @param poolName - Name of the animation pool (e.g., 'animals', 'npcs', 'effects')
   * @param animationId - Unique ID for this animation
   * @param callback - Animation callback function
   */
  static register(poolName: string, animationId: string, callback: AnimationCallback): void {
    if (!this.pools.has(poolName)) {
      this.pools.set(poolName, new Map());
    }

    const pool = this.pools.get(poolName)!;
    
    pool.set(animationId, {
      id: animationId,
      callback,
      isActive: true,
      lastUpdate: performance.now()
    });

    // Register the pool with animation manager if not already done
    if (!this.registeredPools.has(poolName)) {
      this.registerPoolWithAnimationManager(poolName);
      this.registeredPools.add(poolName);
    }
  }

  /**
   * Unregister an animation from a pool
   */
  static unregister(poolName: string, animationId: string): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      pool.delete(animationId);
      
      // Clean up empty pools
      if (pool.size === 0) {
        this.pools.delete(poolName);
        this.registeredPools.delete(poolName);
      }
    }
  }

  /**
   * Activate/deactivate an animation without unregistering it
   */
  static setActive(poolName: string, animationId: string, isActive: boolean): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      const animation = pool.get(animationId);
      if (animation) {
        animation.isActive = isActive;
      }
    }
  }

  /**
   * Get pool statistics for debugging
   */
  static getPoolStats(): Record<string, { total: number; active: number }> {
    const stats: Record<string, { total: number; active: number }> = {};
    
    this.pools.forEach((pool, poolName) => {
      const total = pool.size;
      const active = Array.from(pool.values()).filter((anim: PooledAnimation) => anim.isActive).length;
      stats[poolName] = { total, active };
    });
    
    return stats;
  }

  /**
   * Register the pool's batched callback with the animation manager
   */
  private static registerPoolWithAnimationManager(poolName: string): void {
    // This would integrate with your existing AnimationManager
    // For now, we'll simulate the registration
    const batchedCallback = (state: unknown, delta: number) => {
      this.executePoolAnimations(poolName, state, delta);
    };

    // In a real implementation, you'd call:
    // animationManager.registerAnimationCallback(`pool-${poolName}`, batchedCallback);
    
    // For now, store the callback for manual execution
    (globalThis as any).__animationPools = (globalThis as any).__animationPools || {};
    (globalThis as any).__animationPools[poolName] = batchedCallback;
  }

  /**
   * Execute all active animations in a pool
   */
  private static executePoolAnimations(poolName: string, state: unknown, delta: number): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const now = performance.now();
    
    pool.forEach((animation) => {
      if (animation.isActive) {
        try {
          animation.callback(state, delta);
          animation.lastUpdate = now;
        } catch (error) {
          console.error(`Animation error in pool ${poolName}, animation ${animation.id}:`, error);
          // Deactivate problematic animations
          animation.isActive = false;
        }
      }
    });
  }

  /**
   * Manual execution of all pools (for testing)
   */
  static executeAllPools(state: unknown, delta: number): void {
    this.pools.forEach((pool, poolName) => {
      this.executePoolAnimations(poolName, state, delta);
    });
  }

  /**
   * Clean up all pools and global state
   */
  static dispose(): void {
    this.pools.clear();
    this.registeredPools.clear();
    
    // Clean up global state
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).__animationPools;
    }
  }
}

// Add pool statistics to window for debugging
if (typeof window !== 'undefined') {
  (window as any).animationPoolStats = () => AnimationPool.getPoolStats();
}