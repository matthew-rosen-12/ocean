import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { NPC_HEIGHT } from "shared/types";

interface FireAnimationProps {
  position: THREE.Vector3;
  npcId: string;
  onComplete: (npcId: string) => void;
}

const FireAnimation: React.FC<FireAnimationProps> = ({ position, npcId, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points[]>([]);
  const startTime = useRef(Date.now());
  const duration = 1500; // 1.5 seconds to allow particles to reach full height

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Create multiple particle systems for fire effect
    const numSystems = 8;
    particlesRef.current = [];

    for (let i = 0; i < numSystems; i++) {
      const particleCount = 30;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const opacities = new Float32Array(particleCount);

      // Initialize particles at spawn position, scaled to NPC height
      const npcRadius = NPC_HEIGHT / 2; // Use NPC height to determine fire spread
      for (let j = 0; j < particleCount; j++) {
        const index = j * 3;
        // Start particles in a circle matching NPC footprint
        const angle = (j / particleCount) * Math.PI * 2;
        const radius = Math.random() * (npcRadius * 0.8); // Stay within NPC bounds
        positions[index] = Math.cos(angle) * radius; // x
        positions[index + 1] = -npcRadius; // y (start at bottom of NPC)
        positions[index + 2] = Math.sin(angle) * radius; // z
        
        // Initial velocities - upward to NPC height with slight outward spread
        velocities[index] = (Math.random() - 0.5) * 0.02; // x velocity
        velocities[index + 1] = NPC_HEIGHT * (0.02 + Math.random() * 0.01); // y velocity to reach NPC height
        velocities[index + 2] = (Math.random() - 0.5) * 0.02; // z velocity
        
        opacities[j] = 1.0;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
      geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

      // Fire colors - red/orange/yellow gradient
      const colors = ['#ff4500', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00'];
      const color = colors[i % colors.length];

      const material = new THREE.PointsMaterial({
        color: color,
        size: (NPC_HEIGHT / 4) * (0.3 + i * 0.1), // Scale particle size to NPC height
        transparent: true,
        opacity: 0.9,
        vertexColors: false,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      particles.position.set(position.x, position.y, position.z);
      
      group.add(particles);
      particlesRef.current.push(particles);
    }

    return () => {
      // Cleanup
      particlesRef.current.forEach(particles => {
        if (group) {
          group.remove(particles);
        }
        particles.geometry.dispose();
        if (particles.material instanceof THREE.Material) {
          particles.material.dispose();
        }
      });
    };
  }, [position]);

  useFrame(() => {
    const elapsed = Date.now() - startTime.current;
    const progress = Math.min(elapsed / duration, 1);

    particlesRef.current.forEach((particles, _systemIndex) => {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const velocities = particles.geometry.attributes.velocity.array as Float32Array;
      const opacities = particles.geometry.attributes.opacity.array as Float32Array;

      for (let i = 0; i < positions.length / 3; i++) {
        const index = i * 3;
        
        // Update positions based on velocities
        positions[index] += velocities[index]; // x
        positions[index + 1] += velocities[index + 1]; // y
        positions[index + 2] += velocities[index + 2]; // z
        
        // Add some turbulence
        positions[index] += (Math.random() - 0.5) * 0.005;
        positions[index + 2] += (Math.random() - 0.5) * 0.005;
        
        // Fade out over time - ensure all particles fade consistently
        opacities[i] = Math.max(0, 1 - progress);
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.opacity.needsUpdate = true;
      
      // Update material opacity - ensure it fades out completely
      if (particles.material instanceof THREE.PointsMaterial) {
        particles.material.opacity = Math.max(0, 1 - progress);
      }
    });

    // Complete animation
    if (progress >= 1) {
      onComplete(npcId);
    }
  });

  return <group ref={groupRef} />;
};

export default FireAnimation;