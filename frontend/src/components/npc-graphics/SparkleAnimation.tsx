import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { NPC_HEIGHT } from "shared/types";

interface SparkleAnimationProps {
  position: THREE.Vector3;
  npcId: string;
  onComplete: (npcId: string) => void;
}

const SparkleAnimation: React.FC<SparkleAnimationProps> = ({ position, npcId, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points[]>([]);
  const startTime = useRef(Date.now());
  const duration = 1000;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Create multiple particle systems for sparkle effect
    const numSystems = 4;
    particlesRef.current = [];

    for (let i = 0; i < numSystems; i++) {
      const particleCount = 25;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const opacities = new Float32Array(particleCount);
      const phases = new Float32Array(particleCount); // For twinkling effect

      // Initialize particles around spawn position
      const npcRadius = NPC_HEIGHT / 2;
      for (let j = 0; j < particleCount; j++) {
        const index = j * 3;
        // Start particles in a cylinder around NPC footprint
        const angle = (j / particleCount) * Math.PI * 2;
        const radius = Math.random() * (npcRadius * 1.2);
        const height = Math.random() * NPC_HEIGHT; // Particles stay within half NPC height
        
        positions[index] = Math.cos(angle) * radius; // x
        positions[index + 1] = -npcRadius + height; // y (distributed vertically)
        positions[index + 2] = Math.sin(angle) * radius; // z
        
        // Gentle upward and outward movement
        velocities[index] = (Math.random() - 0.5) * 0.01; // x velocity
        velocities[index + 1] = 0.005 + Math.random() * 0.01; // y velocity (gentle upward)
        velocities[index + 2] = (Math.random() - 0.5) * 0.01; // z velocity
        
        opacities[j] = 1.0;
        phases[j] = Math.random() * Math.PI * 2; // Random phase for twinkling
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
      geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
      geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

      // Sparkle colors - golden/nature tones
      const colors = ['#ffeb3b', '#ffc107', '#ff9800', '#81c784', '#4fc3f7'];
      const color = colors[i % colors.length];

      const material = new THREE.PointsMaterial({
        color: color,
        size: (NPC_HEIGHT / 6) * (0.5 + i * 0.2), // Smaller varied sparkle sizes
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
    const time = elapsed * 0.001; // Convert to seconds for animation

    particlesRef.current.forEach((particles, _systemIndex) => {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const velocities = particles.geometry.attributes.velocity.array as Float32Array;
      const opacities = particles.geometry.attributes.opacity.array as Float32Array;
      const phases = particles.geometry.attributes.phase.array as Float32Array;

      for (let i = 0; i < positions.length / 3; i++) {
        const index = i * 3;
        
        // Update positions with gentle movement
        positions[index] += velocities[index]; // x
        positions[index + 1] += velocities[index + 1]; // y
        positions[index + 2] += velocities[index + 2]; // z
        
        // Add gentle floating motion
        positions[index] += Math.sin(time * 2 + phases[i]) * 0.002;
        positions[index + 2] += Math.cos(time * 2 + phases[i]) * 0.002;
        
        // Twinkling opacity effect combined with fade out
        const twinkle = (Math.sin(time * 4 + phases[i]) + 1) * 0.5; // 0 to 1
        const fadeOut = Math.max(0, 1 - progress);
        opacities[i] = fadeOut * (0.3 + twinkle * 0.7); // Base opacity + twinkling
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.opacity.needsUpdate = true;
      
      // Update material opacity for overall fade
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

export default SparkleAnimation;