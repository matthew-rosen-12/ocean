import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface SmokeAnimationProps {
  position: THREE.Vector3;
  onComplete?: () => void;
}

const SmokeAnimation: React.FC<SmokeAnimationProps> = ({ position, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points[]>([]);
  const startTime = useRef(Date.now());
  const duration = 2000; // 2 seconds

  useEffect(() => {
    if (!groupRef.current) return;

    // Create multiple particle systems for smoke effect
    const numSystems = 5;
    particlesRef.current = [];

    for (let i = 0; i < numSystems; i++) {
      const particleCount = 20;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const opacities = new Float32Array(particleCount);

      // Initialize particles in a small area
      for (let j = 0; j < particleCount; j++) {
        const index = j * 3;
        positions[index] = (Math.random() - 0.5) * 2; // x
        positions[index + 1] = (Math.random() - 0.5) * 2; // y
        positions[index + 2] = Math.random() * 1; // z
        opacities[j] = 1.0;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

      const material = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.5 + i * 0.2,
        transparent: true,
        opacity: 0.8,
        vertexColors: false,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      particles.position.set(
        position.x + (Math.random() - 0.5) * 1,
        position.y + (Math.random() - 0.5) * 1,
        position.z
      );
      
      groupRef.current.add(particles);
      particlesRef.current.push(particles);
    }

    return () => {
      // Cleanup
      particlesRef.current.forEach(particles => {
        if (groupRef.current) {
          groupRef.current.remove(particles);
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

    particlesRef.current.forEach((particles, systemIndex) => {
      const positions = particles.geometry.attributes.position.array as Float32Array;
      const opacities = particles.geometry.attributes.opacity.array as Float32Array;

      for (let i = 0; i < positions.length / 3; i++) {
        const index = i * 3;
        
        // Move particles upward and outward
        positions[index + 1] += 0.02 * (1 + systemIndex * 0.1); // y movement (upward)
        positions[index] += (Math.random() - 0.5) * 0.01; // x drift
        positions[index + 2] += (Math.random() - 0.5) * 0.01; // z drift
        
        // Fade out over time
        opacities[i] = Math.max(0, 1 - progress * 1.5);
      }

      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.opacity.needsUpdate = true;
      
      // Update material opacity
      if (particles.material instanceof THREE.PointsMaterial) {
        particles.material.opacity = Math.max(0, 0.8 - progress * 1.2);
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