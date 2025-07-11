import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface SmokeAnimationProps {
  position: THREE.Vector3;
  onComplete?: () => void;
}

const SmokeAnimation: React.FC<SmokeAnimationProps> = ({ position, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wispRefs = useRef<{ mesh: THREE.Points; direction: THREE.Vector3; delay: number; initialPositions: Float32Array }[]>([]);
  const startTime = useRef(Date.now());
  const duration = 2000;

  useEffect(() => {
    if (!groupRef.current) return;

    // Create 12 skinny wisps radiating outward
    const numWisps = 12;
    wispRefs.current = [];

    for (let i = 0; i < numWisps; i++) {
      // Create a much longer, skinnier line of particles for each wisp
      const particleCount = 15;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const opacities = new Float32Array(particleCount);
      const initialPositions = new Float32Array(particleCount * 3);

      // Direction for this wisp to move in any random direction
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 2, // Random x direction
        (Math.random() - 0.5) * 2, // Random y direction (no upward bias)
        (Math.random() - 0.5) * 2  // Random z direction
      ).normalize();

      // Create particles starting in a larger cloud area
      for (let j = 0; j < particleCount; j++) {
        const index = j * 3;
        
        // Start particles in a larger area around center
        positions[index] = (Math.random() - 0.5) * 1.5; // x spread
        positions[index + 1] = (Math.random() - 0.5) * 1.5; // y spread
        positions[index + 2] = (Math.random() - 0.5) * 1.5; // z spread
        
        // Store initial positions
        initialPositions[index] = positions[index];
        initialPositions[index + 1] = positions[index + 1];
        initialPositions[index + 2] = positions[index + 2];
        
        opacities[j] = 1.0;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

      const material = new THREE.PointsMaterial({
        color: 0xffffff, // Pure white instead of light grey
        size: 0.6,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending, // Additive blending for better cloud effect
        depthWrite: false, // Prevent z-fighting issues
      });

      const wisp = new THREE.Points(geometry, material);
      wisp.position.copy(position);
      
      groupRef.current.add(wisp);
      wispRefs.current.push({
        mesh: wisp,
        direction: direction,
        delay: Math.random() * 300,
        initialPositions: initialPositions
      });
    }

    return () => {
      // Cleanup
      wispRefs.current.forEach(({ mesh }) => {
        if (groupRef.current) {
          groupRef.current.remove(mesh);
        }
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
    };
  }, [position]);

  useFrame(() => {
    const elapsed = Date.now() - startTime.current;
    const progress = Math.min(elapsed / duration, 1);

    wispRefs.current.forEach(({ mesh, direction, delay, initialPositions }) => {
      const activeTime = elapsed - delay;
      
      if (activeTime > 0) {
        const positions = mesh.geometry.attributes.position.array as Float32Array;
        const opacities = mesh.geometry.attributes.opacity.array as Float32Array;
        
        // Move each particle along the wisp direction
        for (let i = 0; i < positions.length / 3; i++) {
          const index = i * 3;
          
          // Each particle moves at a different speed to create the wisp trail effect
          const particleSpeed = 0.0003 + (i * 0.00002); // Later particles move slightly faster
          const distance = activeTime * particleSpeed;
          
          // Move particle smoothly along the direction from its initial position
          positions[index] = initialPositions[index] + direction.x * distance;
          positions[index + 1] = initialPositions[index + 1] + direction.y * distance;
          positions[index + 2] = initialPositions[index + 2] + direction.z * distance;
          
          // Fade out over time
          const fadeProgress = Math.min(activeTime / (duration - delay), 1);
          opacities[i] = Math.max(0, 1 - fadeProgress);
        }
        
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.attributes.opacity.needsUpdate = true;
        
        // Update material opacity
        if (mesh.material instanceof THREE.PointsMaterial) {
          const fadeProgress = Math.min(activeTime / (duration - delay), 1);
          mesh.material.opacity = Math.max(0, 0.8 * (1 - fadeProgress));
        }
      }
    });

    // Complete animation
    if (progress >= 1) {
      onComplete?.();
    }
  });

  return <group ref={groupRef} />;
};

export default SmokeAnimation;