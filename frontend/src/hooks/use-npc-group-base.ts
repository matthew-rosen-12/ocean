import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { DEBUG } from "../utils/config";
import { NPCGroup, UserInfo, pathData, PathPhase, NPCPhase } from "shared/types";
import { calculateNPCGroupScale } from "../utils/npc-group-utils";
import { getAnimalColor, getAnimalIndicatorColor } from "../utils/animal-colors";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { Z_DEPTHS, RENDER_ORDERS } from "shared/z-depths";

// Create a global texture cache
const textureCache = new Map<string, THREE.Texture>();
// Create a global material cache
const materialCache = new Map<string, THREE.MeshBasicMaterial>();
// Create a single shared loader
const textureLoader = new THREE.TextureLoader();

console.log(
  `[NPC CACHE] Texture cache initialized, size: ${textureCache.size}`
);

// Use the specific debug flag
const debug = DEBUG.NPC_MOVEMENT;

export function useNPCGroupBase(npcGroup: NPCGroup, user?: UserInfo, pathData?: pathData, throwChargeCount?: number) {
  const group = useMemo(() => {
    const newGroup = new THREE.Group();
    return newGroup;
  }, []);
  const texture = useRef<THREE.Texture | null>(null);
  const material = useRef<THREE.MeshBasicMaterial | null>(null);
  const mesh = useRef<THREE.Mesh | null>(null);
  const positionRef = useRef(new THREE.Vector3());
  const targetPositionRef = useRef(new THREE.Vector3());
  const textureLoaded = useRef(false);
  const previousPosition = useMemo(() => new THREE.Vector3(), []);
  const meshVersion = useRef(0);
  const outline = useRef<THREE.Object3D | null>(null);
  const goldOutline = useRef<THREE.Object3D | null>(null);

  // Add a function to track position changes
  const updatePositionWithTracking = (
    newPos: THREE.Vector3,
    source: string
  ) => {
    if (!positionRef.current.equals(newPos)) {
      if (debug) {
        console.log(`Position updated from ${source}:`, {
          npcGroupId: npcGroup.id,
          from: positionRef.current.clone(),
          to: newPos.clone(),
          phase: npcGroup.phase,
          isFollowing: false, // Each component will determine this
        });
      }
      positionRef.current.copy(newPos);
    }
  };

  // Helper function to get z-depths based on NPC state
  const getNPCZDepths = () => {
    if (pathData?.pathPhase === PathPhase.THROWN || pathData?.pathPhase === PathPhase.RETURNING) {
      return {
        mesh: Z_DEPTHS.PATH_NPC_THROWN,
        outline: Z_DEPTHS.PATH_NPC_THROWN_OUTLINE,
        goldOutline: Z_DEPTHS.PATH_NPC_THROWN_GOLD_OUTLINE,
        renderOrder: RENDER_ORDERS.PATH_NPC_THROWN,
        outlineRenderOrder: RENDER_ORDERS.PATH_NPC_THROWN_OUTLINE,
        goldOutlineRenderOrder: RENDER_ORDERS.PATH_NPC_THROWN_GOLD_OUTLINE
      };
    } else if (pathData?.pathPhase === PathPhase.FLEEING) {
      return {
        mesh: Z_DEPTHS.PATH_NPC_FLEEING,
        outline: Z_DEPTHS.PATH_NPC_FLEEING_OUTLINE,
        goldOutline: Z_DEPTHS.PATH_NPC_FLEEING_GOLD_OUTLINE,
        renderOrder: RENDER_ORDERS.PATH_NPC_FLEEING,
        outlineRenderOrder: RENDER_ORDERS.PATH_NPC_FLEEING_OUTLINE,
        goldOutlineRenderOrder: RENDER_ORDERS.PATH_NPC_FLEEING_GOLD_OUTLINE
      };
    } else if (npcGroup.phase === NPCPhase.CAPTURED) {
      // Captured NPC group
      return {
        mesh: Z_DEPTHS.CAPTURED_NPC_GROUP,
        outline: Z_DEPTHS.CAPTURED_NPC_GROUP_OUTLINE,
        goldOutline: Z_DEPTHS.CAPTURED_NPC_GROUP_GOLD_OUTLINE,
        renderOrder: RENDER_ORDERS.CAPTURED_NPC_GROUP,
        outlineRenderOrder: RENDER_ORDERS.CAPTURED_NPC_GROUP_OUTLINE,
        goldOutlineRenderOrder: RENDER_ORDERS.CAPTURED_NPC_GROUP_GOLD_OUTLINE
      };
    } else {
      // Idle NPC group
      return {
        mesh: Z_DEPTHS.IDLE_NPC_GROUP,
        outline: Z_DEPTHS.IDLE_NPC_GROUP_OUTLINE,
        goldOutline: Z_DEPTHS.IDLE_NPC_GROUP_GOLD_OUTLINE,
        renderOrder: RENDER_ORDERS.IDLE_NPC_GROUP,
        outlineRenderOrder: RENDER_ORDERS.IDLE_NPC_GROUP_OUTLINE,
        goldOutlineRenderOrder: RENDER_ORDERS.IDLE_NPC_GROUP_GOLD_OUTLINE
      };
    }
  };

  // Helper function to create shimmering outline with segments
  const createShimmeringOutline = (scale: number, userColor: THREE.Color) => {
    const halfWidth = 0.5;
    const halfHeight = 0.5;
    
    // Create a group to hold multiple line segments
    const outlineGroup = new THREE.Group();
    
    // Define the square outline with 8 segments (2 per side)
    const segments = [
      // Bottom edge - left half
      { start: [-halfWidth, -halfHeight, 0], end: [0, -halfHeight, 0] },
      // Bottom edge - right half  
      { start: [0, -halfHeight, 0], end: [halfWidth, -halfHeight, 0] },
      // Right edge - bottom half
      { start: [halfWidth, -halfHeight, 0], end: [halfWidth, 0, 0] },
      // Right edge - top half
      { start: [halfWidth, 0, 0], end: [halfWidth, halfHeight, 0] },
      // Top edge - right half
      { start: [halfWidth, halfHeight, 0], end: [0, halfHeight, 0] },
      // Top edge - left half
      { start: [0, halfHeight, 0], end: [-halfWidth, halfHeight, 0] },
      // Left edge - top half
      { start: [-halfWidth, halfHeight, 0], end: [-halfWidth, 0, 0] },
      // Left edge - bottom half
      { start: [-halfWidth, 0, 0], end: [-halfWidth, -halfHeight, 0] },
    ];
    
    segments.forEach((segment, index) => {
      const lineGeometry = new LineGeometry();
      lineGeometry.setPositions(new Float32Array([
        ...segment.start,
        ...segment.end
      ]));
      
      const lineMaterial = new LineMaterial({
        color: userColor, // Start with user color
        linewidth: 15.0,
        transparent: false,
        opacity: 1.0,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      });
      
      const lineSegment = new LineSegments2(lineGeometry, lineMaterial);
      lineSegment.scale.set(scale, scale, 1);
      // Individual segments inherit the group's render order - set explicitly to avoid conflicts
      const zDepths = getNPCZDepths();
      lineSegment.renderOrder = zDepths.goldOutlineRenderOrder;
      
      // Store animation data for this segment
      (lineSegment as LineSegments2 & { userData: Record<string, unknown> }).userData = {
        segmentIndex: index,
        userColor: userColor.clone(),
        goldColor: new THREE.Color('#FFD700'),
        material: lineMaterial,
        isShimmering: true
      };
      
      outlineGroup.add(lineSegment);
    });
    
    const zDepths = getNPCZDepths();
    outlineGroup.renderOrder = zDepths.goldOutlineRenderOrder;
    console.log('GOLD outline render order:', outlineGroup.renderOrder, 'vs NPC mesh:', zDepths.renderOrder);
    outlineGroup.position.z = 0; // Use render order only for depth sorting
    
    // Mark the group for animation
    (outlineGroup as THREE.Group & { userData: Record<string, unknown> }).userData = {
      isShimmeringGroup: true,
      animationSpeed: 1.5
    };
    
    return outlineGroup;
  };


  // Helper function to create outline with swirling gold/user color effect
  const createOutline = (scale: number, borderColor: THREE.Color, isGold: boolean = false) => {
    
    // Create a square outline (1x1) like the original, then scale it
    const halfWidth = 0.5;
    const halfHeight = 0.5;
    
    // Create square outline points (clockwise)
    const linePositions = [
      // Bottom edge
      -halfWidth, -halfHeight, 0,
      halfWidth, -halfHeight, 0,
      // Right edge  
      halfWidth, -halfHeight, 0,
      halfWidth, halfHeight, 0,
      // Top edge
      halfWidth, halfHeight, 0,
      -halfWidth, halfHeight, 0,
      // Left edge
      -halfWidth, halfHeight, 0,
      -halfWidth, -halfHeight, 0,
    ];
    
    // Use LineGeometry and LineMaterial for thick lines like the original
    const lineGeometry = new LineGeometry();
    lineGeometry.setPositions(new Float32Array(linePositions));
    
    let edgeMaterial: LineMaterial;
    
    if (isGold) {
      // Create swirling gold/user color material with shader-like effect
      const goldColor = new THREE.Color('#FFD700');
      
      edgeMaterial = new LineMaterial({
        color: goldColor,
        linewidth: 18.0, // Thicker for the swirl effect
        transparent: false,
        opacity: 1.0,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      });
      
      // Add animation properties to the material for swirling effect
      (edgeMaterial as LineMaterial & { userData: Record<string, unknown> }).userData = {
        baseColor: goldColor.clone(),
        userColor: borderColor.clone(),
        animationTime: 0,
        swirling: true
      };
      
    } else {
      // Regular outline
      edgeMaterial = new LineMaterial({
        color: borderColor,
        linewidth: 12.0,
        transparent: false,
        opacity: 1.0,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      });
    }
    
    const zDepths = getNPCZDepths();
    const outlineObj = new LineSegments2(lineGeometry, edgeMaterial);
    outlineObj.renderOrder = isGold ? zDepths.goldOutlineRenderOrder : zDepths.outlineRenderOrder;
    outlineObj.scale.set(scale * (isGold ? 1.15 : 1), scale * (isGold ? 1.15 : 1), 1); // Gold outline larger
    outlineObj.position.z = 0; // Use render order only for depth sorting
    
    // Add swirling animation for gold outline
    if (isGold) {
      (outlineObj as LineSegments2 & { userData: Record<string, unknown> }).userData = {
        isSwirling: true,
        material: edgeMaterial,
        baseColor: new THREE.Color('#FFD700'),
        userColor: borderColor.clone(),
        animationSpeed: 2.0
      };
    }
    
    return outlineObj;
  };

  // Return text info for React component to render (like original)
  const getTextInfo = (count: number, scale: number) => {
    if (count <= 1) return null;
    
    // Always show text for groups > 1, use lightened user color if available, otherwise gray
    const baseColor = user ? getAnimalIndicatorColor(user) : new THREE.Color('#888888');
    
    return {
      count,
      position: [0, scale / 2 + 2.3, 0] as [number, number, number],
      fontSize: 2.8,
      color: baseColor
    };
  };

  // Memoize the gold color to prevent creating new objects on each render
  const goldColor = useMemo(() => new THREE.Color('#FFD700'), []);

  // Regular useEffect for texture loading and setup
  useEffect(() => {
    // Reset texture loaded flag when NPC changes
    textureLoaded.current = false;

    // Position update
    previousPosition.copy(positionRef.current);
    group.position.copy(previousPosition);

    // Check if mesh is already set up and attached to the group
    if (
      mesh.current &&
      mesh.current.parent === group &&
      textureLoaded.current
    ) {
      return;
    }

    // If we get here, we need to set up the mesh
    const texturePath = `/npcs/${npcGroup.faceFileName}`;
    // Clean up any existing elements first to avoid adding duplicates
    if (mesh.current && mesh.current.parent === group) {
      group.remove(mesh.current);
      if (mesh.current.geometry) {
        mesh.current.geometry.dispose();
      }
    }
    if (outline.current && outline.current.parent === group) {
      group.remove(outline.current);
      if (outline.current instanceof LineSegments2) {
        outline.current.geometry?.dispose();
        (outline.current.material as LineMaterial).dispose();
      }
    }
    if (goldOutline.current && goldOutline.current.parent === group) {
      group.remove(goldOutline.current);
      // If it's a group (shimmering outline), dispose all children
      if (goldOutline.current instanceof THREE.Group) {
        goldOutline.current.children.forEach(child => {
          if (child instanceof LineSegments2) {
            child.geometry?.dispose();
            (child.material as LineMaterial).dispose();
          }
        });
      } else if (goldOutline.current instanceof LineSegments2) {
        goldOutline.current.geometry?.dispose();
        (goldOutline.current.material as LineMaterial).dispose();
      }
    }

    if (textureCache.has(texturePath)) {
      texture.current = textureCache.get(texturePath)!;

      // Check if we also have a cached material
      if (materialCache.has(texturePath)) {
        material.current = materialCache.get(texturePath)!;
      } else {
        // Create material and cache it
        material.current = new THREE.MeshBasicMaterial({
          map: texture.current,
          transparent: true,
          side: THREE.DoubleSide,
        });
        materialCache.set(texturePath, material.current);
      }

      const geometry = new THREE.PlaneGeometry(1, 1);
      mesh.current = new THREE.Mesh(geometry, material.current);

      // Apply z-depth positioning
      const zDepths = getNPCZDepths();
      mesh.current.position.z = zDepths.mesh;
      mesh.current.renderOrder = zDepths.renderOrder;
      console.log('NPC MESH render order set to:', mesh.current.renderOrder);

      // Scale based on texture aspect ratio and fileNames count
      const imageAspect =
        texture.current.image.width / texture.current.image.height;
      const scale = calculateNPCGroupScale(npcGroup.fileNames.length);
      mesh.current.scale.set(scale * imageAspect, scale, 1);

      group.add(mesh.current);
      
      // Get the color for outline
      const borderColor = user ? getAnimalColor(user) : new THREE.Color('#888888');
      
      // Create and add outline (or special shimmering outline for thrown/returning NPCs)
      if (pathData?.pathPhase === PathPhase.THROWN || pathData?.pathPhase === PathPhase.RETURNING) {
        // Create special shimmering outline for thrown/returning NPCs
        goldOutline.current = createShimmeringOutline(scale, borderColor);
        if (goldOutline.current) {
          group.add(goldOutline.current);
        }
      } else {
        // Regular outline for non-thrown NPCs
        outline.current = createOutline(scale, borderColor);
        if (outline.current) {
          group.add(outline.current);
        }
      }
      
      textureLoaded.current = true;
      meshVersion.current += 1;
    } else {
      // Load texture if not cached
      textureLoader.load(
        texturePath,
        (loadedTexture) => {
          // Cache the texture
          textureCache.set(texturePath, loadedTexture);

          // Double-check we don't already have elements (in case of rapid re-renders)
          if (mesh.current && mesh.current.parent === group) {
            group.remove(mesh.current);
            if (mesh.current.geometry) {
              mesh.current.geometry.dispose();
            }
          }
          if (outline.current && outline.current.parent === group) {
            group.remove(outline.current);
            if (outline.current instanceof LineSegments2) {
              outline.current.geometry?.dispose();
              (outline.current.material as LineMaterial).dispose();
            }
          }
          if (goldOutline.current && goldOutline.current.parent === group) {
            group.remove(goldOutline.current);
            // If it's a group (shimmering outline), dispose all children
            if (goldOutline.current instanceof THREE.Group) {
              goldOutline.current.children.forEach(child => {
                if (child instanceof LineSegments2) {
                  child.geometry?.dispose();
                  (child.material as LineMaterial).dispose();
                }
              });
            } else if (goldOutline.current instanceof LineSegments2) {
              goldOutline.current.geometry?.dispose();
              (goldOutline.current.material as LineMaterial).dispose();
            }
          }

          texture.current = loadedTexture;

          // Create material and cache it
          material.current = new THREE.MeshBasicMaterial({
            map: loadedTexture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          materialCache.set(texturePath, material.current);

          const geometry = new THREE.PlaneGeometry(1, 1);
          mesh.current = new THREE.Mesh(geometry, material.current);

          // Apply z-depth positioning
          const zDepths = getNPCZDepths();
          mesh.current.position.z = zDepths.mesh;
          mesh.current.renderOrder = zDepths.renderOrder;

          // Scale based on texture aspect ratio and fileNames count
          const imageAspect =
            loadedTexture.image.width / loadedTexture.image.height;
          const scale = calculateNPCGroupScale(npcGroup.fileNames.length);
          mesh.current.scale.set(scale * imageAspect, scale, 1);

          group.add(mesh.current);
          
          // Get the color for outline
          const borderColor = user ? getAnimalColor(user) : new THREE.Color('#888888');
          
          // Create and add outline (or special shimmering outline for thrown/returning NPCs)
          if (pathData?.pathPhase === PathPhase.THROWN || pathData?.pathPhase === PathPhase.RETURNING) {
            // Create special shimmering outline for thrown/returning NPCs
            goldOutline.current = createShimmeringOutline(scale, borderColor);
            if (goldOutline.current) {
              group.add(goldOutline.current);
            }
          } else {
            // Regular outline for non-thrown NPCs
            outline.current = createOutline(scale, borderColor);
            if (outline.current) {
              group.add(outline.current);
            }
          }
          
          textureLoaded.current = true;
          meshVersion.current += 1;
        },
        undefined,
        (error) => {
          console.error(`Error loading NPC texture: ${texturePath}`, error);
        }
      );
    }

    return () => {
      // Only dispose texture if it's not in the cache (i.e., if it failed to load)
      if (texture.current && !textureCache.has(`/npcs/${npcGroup.faceFileName}`)) {
        texture.current.dispose();
      }

      // Only dispose material if it's not in the cache
      if (material.current && !materialCache.has(`/npcs/${npcGroup.faceFileName}`)) {
        material.current.dispose();
      }

      // Clean up our elements specifically, not the entire group
      if (mesh.current) {
        if (mesh.current.geometry) {
          mesh.current.geometry.dispose();
        }
        if (mesh.current.parent === group) {
          group.remove(mesh.current);
        }
      }
      if (outline.current) {
        if (outline.current instanceof LineSegments2) {
          outline.current.geometry?.dispose();
          if (outline.current.material) {
            (outline.current.material as LineMaterial).dispose();
          }
        }
        if (outline.current.parent === group) {
          group.remove(outline.current);
        }
      }
      if (goldOutline.current) {
        // If it's a group (shimmering outline), dispose all children
        if (goldOutline.current instanceof THREE.Group) {
          goldOutline.current.children.forEach(child => {
            if (child instanceof LineSegments2) {
              child.geometry?.dispose();
              if (child.material) {
                (child.material as LineMaterial).dispose();
              }
            }
          });
        } else if (goldOutline.current instanceof LineSegments2) {
          goldOutline.current.geometry?.dispose();
          if (goldOutline.current.material) {
            (goldOutline.current.material as LineMaterial).dispose();
          }
        }
        if (goldOutline.current.parent === group) {
          group.remove(goldOutline.current);
        }
      }
    };
  }, [npcGroup.faceFileName, npcGroup.fileNames.length, pathData?.pathPhase, group, user, previousPosition]);

  // Calculate current scale for text positioning
  const currentScale = useMemo(() => {
    return calculateNPCGroupScale(npcGroup.fileNames.length);
  }, [npcGroup.fileNames.length]);

  // Memoize throw charge count text info
  const throwChargeCountTextInfo = useMemo(() => {
    if (!throwChargeCount) return null;
    if (throwChargeCount < 1) return null;

    return {
      count: throwChargeCount,
      position: [0, - currentScale / 2 - 2.3, 0] as [number, number, number],
      fontSize: 2.8,
      color: goldColor
    };
  }, [throwChargeCount, currentScale, goldColor]);


  // Animate the shimmering gold outline
  useFrame((state) => {
    if (goldOutline.current && (goldOutline.current as THREE.Group & { userData: Record<string, unknown> }).userData?.isShimmeringGroup) {
      const groupUserData = (goldOutline.current as THREE.Group & { userData: Record<string, unknown> }).userData;
      const time = state.clock.getElapsedTime() * (groupUserData.animationSpeed as number);
      
      // Animate each segment in the group
      goldOutline.current.children.forEach((child, index) => {
        if (child instanceof LineSegments2) {
          const segmentUserData = (child as LineSegments2 & { userData: Record<string, unknown> }).userData;
          if (segmentUserData?.isShimmering) {
            const material = segmentUserData.material as LineMaterial;
            const userColor = segmentUserData.userColor as THREE.Color;
            const goldColor = segmentUserData.goldColor as THREE.Color;
            
            // Create traveling wave effect - each segment has a phase offset
            const segmentPhase = (index / 8) * Math.PI * 2; // 8 segments around the square
            const wave = Math.sin(time + segmentPhase) * 0.5 + 0.5; // 0 to 1
            
            // Blend between user color and gold based on the wave
            const blendedColor = new THREE.Color();
            blendedColor.lerpColors(userColor, goldColor, wave);
            
            material.color.copy(blendedColor);
            
            // Add slight intensity variation for extra shimmer
            const intensity = Math.sin(time * 2 + segmentPhase) * 0.1 + 0.9; // 0.8 to 1.0
            material.opacity = intensity;
          }
        }
      });
    }
  });

  return {
    group,
    mesh,
    positionRef,
    targetPositionRef,
    textureLoaded,
    updatePositionWithTracking,
    previousPosition,
    meshVersion,
    textInfo: getTextInfo(npcGroup.fileNames.length, currentScale),
    throwChargeCountTextInfo,
  };
}

export function useMount(callback: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, []);
}
