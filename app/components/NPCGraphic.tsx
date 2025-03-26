import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { NPC } from "../utils/types/npc";

interface NPCGraphicProps {
  npc: NPC;
}

const NPCGraphic: React.FC<NPCGraphicProps> = ({ npc }) => {
  const group = useRef<THREE.Group>(null!);
  const positionRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector2());
  const textureLoaded = useRef(false);

  // Set initial position and direction
  useEffect(() => {
    if (npc.position) {
      positionRef.current.set(npc.position.x, npc.position.y, npc.position.z);
    }
    if (npc.direction) {
      directionRef.current.set(npc.direction.x, npc.direction.y);
    }
  }, [npc]);

  // Load the texture for the NPC
  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    // Store the current group reference for cleanup
    const currentGroup = group.current;

    textureLoader.load(
      `/npcs/${npc.filename}`,
      (texture) => {
        while (currentGroup.children.length > 0) {
          currentGroup.remove(currentGroup.children[0]);
        }

        // Create a simple plane with the texture
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
        });

        const geometry = new THREE.PlaneGeometry(1, 1);
        const mesh = new THREE.Mesh(geometry, material);

        // Scale the mesh based on texture size
        const imageAspect = texture.image.width / texture.image.height;
        const scale = 5; // Base scale factor
        mesh.scale.set(scale * imageAspect, scale, 1);

        currentGroup.add(mesh);
        textureLoaded.current = true;
      },
      undefined,
      (error) => console.error("Error loading NPC texture:", error)
    );

    return () => {
      // Cleanup using the captured reference
      if (currentGroup) {
        while (currentGroup.children.length > 0) {
          const child = currentGroup.children[0];
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            } else if (Array.isArray(child.material)) {
              child.material.forEach((material) => material.dispose());
            }
          }
          currentGroup.remove(child);
        }
      }
    };
  }, [npc.filename]);

  // Update position and rotation every frame
  useFrame(() => {
    if (!group.current) return;

    // Update position from positionRef
    group.current.position.copy(positionRef.current);

    // Update rotation based on direction
    if (directionRef.current.length() > 0) {
      const angle = Math.atan2(directionRef.current.y, directionRef.current.x);
      group.current.rotation.z = angle + Math.PI / 2; // Add 90 degrees to face forward
    }
  });

  return <group ref={group} />;
};

export default NPCGraphic;
