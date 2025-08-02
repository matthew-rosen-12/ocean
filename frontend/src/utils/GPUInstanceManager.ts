/**
 * GPU Instance Manager for rendering large numbers of NPCs efficiently
 * Uses Three.js InstancedMesh to batch render similar objects
 */

import * as THREE from 'three';
import { NPCGroup } from 'shared/types';

interface InstanceData {
  npcGroupId: string;
  position: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  visible: boolean;
}

interface InstancePool {
  mesh: THREE.InstancedMesh;
  instances: Map<string, number>; // npcGroupId -> instance index
  availableIndices: number[];
  maxInstances: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  needsUpdate: boolean;
}

class GPUInstanceManager {
  private pools: Map<string, InstancePool> = new Map();
  private updateQueue: Set<string> = new Set(); // Pool names that need updates
  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempQuaternion = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();

  /**
   * Create or get an instance pool for a specific NPC type
   */
  public createPool(
    poolName: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    maxInstances: number = 1000
  ): THREE.InstancedMesh {
    if (this.pools.has(poolName)) {
      return this.pools.get(poolName)!.mesh;
    }

    // Create instanced mesh
    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    instancedMesh.frustumCulled = false; // Disable frustum culling for better batching
    instancedMesh.castShadow = false; // Disable shadows for better performance
    instancedMesh.receiveShadow = false;

    // Initialize all instances as invisible
    for (let i = 0; i < maxInstances; i++) {
      this.tempMatrix.makeScale(0, 0, 0); // Make invisible by scaling to 0
      instancedMesh.setMatrixAt(i, this.tempMatrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    const pool: InstancePool = {
      mesh: instancedMesh,
      instances: new Map(),
      availableIndices: Array.from({ length: maxInstances }, (_, i) => i),
      maxInstances,
      geometry: geometry.clone(),
      material: material.clone(),
      needsUpdate: false
    };

    this.pools.set(poolName, pool);
    return instancedMesh;
  }

  /**
   * Add or update an NPC instance in a pool
   */
  public setInstance(
    poolName: string,
    npcGroupId: string,
    position: THREE.Vector3,
    rotation: number = 0,
    scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
    visible: boolean = true
  ): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      console.warn(`GPU Instance pool '${poolName}' not found`);
      return false;
    }

    let instanceIndex = pool.instances.get(npcGroupId);

    // If this is a new instance, allocate an index
    if (instanceIndex === undefined) {
      if (pool.availableIndices.length === 0) {
        console.warn(`GPU Instance pool '${poolName}' is full (${pool.maxInstances} instances)`);
        return false;
      }

      instanceIndex = pool.availableIndices.pop()!;
      pool.instances.set(npcGroupId, instanceIndex);
    }

    // Update the instance matrix
    if (visible) {
      this.tempPosition.copy(position);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
      this.tempScale.copy(scale);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
    } else {
      // Make invisible by scaling to 0
      this.tempMatrix.makeScale(0, 0, 0);
    }

    pool.mesh.setMatrixAt(instanceIndex, this.tempMatrix);
    pool.needsUpdate = true;
    this.updateQueue.add(poolName);

    return true;
  }

  /**
   * Remove an NPC instance from a pool
   */
  public removeInstance(poolName: string, npcGroupId: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    const instanceIndex = pool.instances.get(npcGroupId);
    if (instanceIndex === undefined) {
      return false;
    }

    // Make the instance invisible
    this.tempMatrix.makeScale(0, 0, 0);
    pool.mesh.setMatrixAt(instanceIndex, this.tempMatrix);

    // Free the index
    pool.availableIndices.push(instanceIndex);
    pool.instances.delete(npcGroupId);
    pool.needsUpdate = true;
    this.updateQueue.add(poolName);

    return true;
  }

  /**
   * Batch update multiple instances for better performance
   */
  public batchUpdateInstances(
    poolName: string,
    updates: Array<{
      npcGroupId: string;
      position: THREE.Vector3;
      rotation?: number;
      scale?: THREE.Vector3;
      visible?: boolean;
    }>
  ): number {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return 0;
    }

    let successCount = 0;
    for (const update of updates) {
      const success = this.setInstance(
        poolName,
        update.npcGroupId,
        update.position,
        update.rotation || 0,
        update.scale || new THREE.Vector3(1, 1, 1),
        update.visible !== false
      );
      if (success) successCount++;
    }

    return successCount;
  }

  /**
   * Update all dirty pools - call this once per frame
   */
  public updateAll(): void {
    this.updateQueue.forEach(poolName => {
      const pool = this.pools.get(poolName);
      if (pool && pool.needsUpdate) {
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.needsUpdate = false;
      }
    });
    this.updateQueue.clear();
  }

  /**
   * Get pool statistics for debugging
   */
  public getPoolStats(poolName: string): {
    activeInstances: number;
    availableSlots: number;
    maxInstances: number;
    utilizationPercent: number;
  } | null {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return null;
    }

    const activeInstances = pool.instances.size;
    const availableSlots = pool.availableIndices.length;
    const utilizationPercent = (activeInstances / pool.maxInstances) * 100;

    return {
      activeInstances,
      availableSlots,
      maxInstances: pool.maxInstances,
      utilizationPercent
    };
  }

  /**
   * Get all pool statistics
   */
  public getAllStats(): Record<string, ReturnType<typeof this.getPoolStats>> {
    const stats: Record<string, ReturnType<typeof this.getPoolStats>> = {};
    this.pools.forEach((pool, poolName) => {
      stats[poolName] = this.getPoolStats(poolName);
    });
    return stats;
  }

  /**
   * Clear a specific pool
   */
  public clearPool(poolName: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    // Reset all instances
    for (let i = 0; i < pool.maxInstances; i++) {
      this.tempMatrix.makeScale(0, 0, 0);
      pool.mesh.setMatrixAt(i, this.tempMatrix);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;

    // Reset pool state
    pool.instances.clear();
    pool.availableIndices = Array.from({ length: pool.maxInstances }, (_, i) => i);
    pool.needsUpdate = false;

    return true;
  }

  /**
   * Dispose of a pool and free resources
   */
  public disposePool(poolName: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    // Dispose of geometry and material
    pool.geometry.dispose();
    if (pool.material instanceof THREE.Material) {
      pool.material.dispose();
    }

    // Remove from scene should be handled by the caller
    this.pools.delete(poolName);
    this.updateQueue.delete(poolName);

    return true;
  }

  /**
   * Dispose of all pools
   */
  public dispose(): void {
    const poolNames = Array.from(this.pools.keys());
    poolNames.forEach(poolName => {
      this.disposePool(poolName);
    });
  }

  /**
   * Get the instanced mesh for a pool (for adding to scene)
   */
  public getPoolMesh(poolName: string): THREE.InstancedMesh | null {
    const pool = this.pools.get(poolName);
    return pool ? pool.mesh : null;
  }

  /**
   * Check if a pool exists
   */
  public hasPool(poolName: string): boolean {
    return this.pools.has(poolName);
  }

  /**
   * Set the render order for a pool
   */
  public setPoolRenderOrder(poolName: string, renderOrder: number): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    pool.mesh.renderOrder = renderOrder;
    return true;
  }

  /**
   * Set the position.z (depth) for a pool
   */
  public setPoolDepth(poolName: string, depth: number): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      return false;
    }

    pool.mesh.position.z = depth;
    return true;
  }

  /**
   * Create optimized geometry for NPC groups (simplified for better performance)
   */
  public static createOptimizedNPCGeometry(size: number = 1): THREE.BufferGeometry {
    // Use a simple circle geometry for NPCs instead of complex SVG shapes
    const geometry = new THREE.CircleGeometry(size / 2, 8); // 8 segments for good balance of quality/performance
    
    // Optimize the geometry
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    return geometry;
  }

  /**
   * Create optimized material for NPC groups
   */
  public static createOptimizedNPCMaterial(color: number = 0x888888): THREE.Material {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: false,
      side: THREE.FrontSide, // Only render front faces
      depthWrite: true,
      depthTest: true,
      fog: false, // Disable fog for better performance
    });
  }
}

// Export singleton instance
export const gpuInstanceManager = new GPUInstanceManager();

// Export class for custom instances
export { GPUInstanceManager };