/**
 * GPU-accelerated NPC renderer using instanced meshes
 * Renders large numbers of NPCs efficiently for better performance
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { NPCGroup, NPCGroupsBiMap } from 'shared/types';
import { gpuInstanceManager, GPUInstanceManager } from '../../utils/GPUInstanceManager';
import { RENDER_ORDERS, Z_DEPTHS } from 'shared/z-depths';
import { useAnimationManagerContext } from '../../contexts/AnimationManagerContext';

interface InstancedNPCRendererProps {
  npcGroups: NPCGroupsBiMap;
  myUserId: string;
  enabled?: boolean; // Allow toggling GPU instancing on/off
  maxInstancesPerPool?: number;
  enableLOD?: boolean; // Level of detail optimization
}

const InstancedNPCRenderer: React.FC<InstancedNPCRendererProps> = ({
  npcGroups,
  myUserId,
  enabled = true,
  maxInstancesPerPool = 500,
  enableLOD = true,
}) => {
  const { scene } = useThree();
  const animationManager = useAnimationManagerContext();
  const poolMeshesRef = useRef<Map<string, THREE.InstancedMesh>>(new Map());
  const animationIdRef = useRef('instanced-npc-renderer');
  const lastUpdateTimeRef = useRef(0);

  // Determine which NPCs should use GPU instancing
  const shouldUseInstancing = useMemo(() => {
    if (!enabled) return false;
    
    // Only use instancing if we have many NPCs to render
    const npcCount = Array.from(npcGroups.values()).length;
    const threshold = 20; // Start using instancing with 20+ NPCs
    
    return npcCount >= threshold;
  }, [enabled, npcGroups]);

  // Create optimized geometries and materials for different NPC types
  const npcAssets = useMemo(() => {
    const assets = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }>();
    
    // Small NPCs (1-3 entities)
    assets.set('small', {
      geometry: GPUInstanceManager.createOptimizedNPCGeometry(0.8),
      material: GPUInstanceManager.createOptimizedNPCMaterial(0x4CAF50) // Green
    });
    
    // Medium NPCs (4-8 entities)
    assets.set('medium', {
      geometry: GPUInstanceManager.createOptimizedNPCGeometry(1.2),
      material: GPUInstanceManager.createOptimizedNPCMaterial(0x2196F3) // Blue
    });
    
    // Large NPCs (9+ entities)
    assets.set('large', {
      geometry: GPUInstanceManager.createOptimizedNPCGeometry(1.6),
      material: GPUInstanceManager.createOptimizedNPCMaterial(0xFF9800) // Orange
    });
    
    return assets;
  }, []);

  // Initialize GPU instance pools
  useEffect(() => {
    if (!shouldUseInstancing) return;

    const poolsToCreate = ['small', 'medium', 'large'];
    
    poolsToCreate.forEach(poolName => {
      const assets = npcAssets.get(poolName);
      if (assets && !gpuInstanceManager.hasPool(poolName)) {
        const mesh = gpuInstanceManager.createPool(
          poolName,
          assets.geometry,
          assets.material,
          maxInstancesPerPool
        );
        
        // Set render order and depth (use idle NPC group values)
        gpuInstanceManager.setPoolRenderOrder(poolName, RENDER_ORDERS.IDLE_NPC_GROUP);
        gpuInstanceManager.setPoolDepth(poolName, Z_DEPTHS.IDLE_NPC_GROUP);
        
        // Add to scene
        scene.add(mesh);
        poolMeshesRef.current.set(poolName, mesh);
      }
    });

    return () => {
      // Clean up pools when component unmounts
      poolsToCreate.forEach(poolName => {
        const mesh = poolMeshesRef.current.get(poolName);
        if (mesh) {
          scene.remove(mesh);
          poolMeshesRef.current.delete(poolName);
        }
        gpuInstanceManager.clearPool(poolName);
      });
    };
  }, [shouldUseInstancing, npcAssets, maxInstancesPerPool, scene]);

  // Animation callback for updating instance positions
  useEffect(() => {
    if (!shouldUseInstancing) return;

    const animationCallback = (_state: unknown, delta: number) => {
      const now = performance.now();
      
      // Throttle updates to 30 FPS for better performance
      if (now - lastUpdateTimeRef.current < 33) {
        return;
      }
      lastUpdateTimeRef.current = now;

      // Categorize NPCs by size for different instance pools
      const npcUpdates = {
        small: [] as Array<{ npcGroupId: string; position: THREE.Vector3; rotation: number; scale: THREE.Vector3; visible: boolean }>,
        medium: [] as Array<{ npcGroupId: string; position: THREE.Vector3; rotation: number; scale: THREE.Vector3; visible: boolean }>,
        large: [] as Array<{ npcGroupId: string; position: THREE.Vector3; rotation: number; scale: THREE.Vector3; visible: boolean }>
      };

      // Process all NPC groups
      Array.from(npcGroups.values()).forEach((npcGroup: NPCGroup) => {
        // Skip NPCs that are captured by the local player (they use regular rendering)
        if (npcGroup.captorId === myUserId) {
          return;
        }

        // Skip NPCs that are in throwing phase (they should use regular rendering for smooth physics)
        if (npcGroup.phase !== 'IDLE') {
          return;
        }

        // Determine pool based on NPC count
        const npcCount = npcGroup.fileNames.length;
        let poolName: string;
        if (npcCount <= 3) {
          poolName = 'small';
        } else if (npcCount <= 8) {
          poolName = 'medium';
        } else {
          poolName = 'large';
        }

        // Calculate scale based on NPC count (logarithmic scaling)
        const scaleFactor = Math.sqrt(Math.log2(npcCount + 1)) * 0.8;
        
        // Apply LOD (Level of Detail) if enabled
        let finalScale = scaleFactor;
        if (enableLOD) {
          // Reduce detail for distant NPCs (simple distance-based LOD)
          // This would need camera position for proper implementation
          // For now, use a simple scale reduction for large groups
          if (npcCount > 10) {
            finalScale *= 0.7; // Reduce scale for very large groups
          }
        }

        npcUpdates[poolName as keyof typeof npcUpdates].push({
          npcGroupId: npcGroup.id,
          position: new THREE.Vector3(npcGroup.position.x, npcGroup.position.y, npcGroup.position.z || 0),
          rotation: 0, // Could add rotation based on movement direction
          scale: new THREE.Vector3(finalScale, finalScale, 1),
          visible: true
        });
      });

      // Batch update all pools
      Object.entries(npcUpdates).forEach(([poolName, updates]) => {
        if (updates.length > 0) {
          gpuInstanceManager.batchUpdateInstances(poolName, updates);
        }
      });

      // Apply all updates
      gpuInstanceManager.updateAll();
    };

    animationManager.registerAnimationCallback(animationIdRef.current, animationCallback);

    return () => {
      animationManager.unregisterAnimationCallback(animationIdRef.current);
    };
  }, [shouldUseInstancing, npcGroups, myUserId, animationManager, enableLOD]);

  // Debug info (remove in production)
  useEffect(() => {
    if (!shouldUseInstancing) return;

    const debugInterval = setInterval(() => {
      const stats = gpuInstanceManager.getAllStats();
      console.log('GPU Instance Stats:', stats);
    }, 5000);

    return () => clearInterval(debugInterval);
  }, [shouldUseInstancing]);

  // This component doesn't render anything directly
  // The instanced meshes are added to the scene via the GPU instance manager
  return null;
};

export default InstancedNPCRenderer;