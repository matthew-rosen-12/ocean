import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useAnimationManagerContext } from "../../contexts/AnimationManagerContext";

interface CloudAnimationProps {
  position: THREE.Vector3;
  onComplete?: () => void;
}

const CloudAnimation: React.FC<CloudAnimationProps> = ({ position, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wispRefs = useRef<{
    mesh: THREE.Points;
    direction: THREE.Vector3;
    speed: number;
    startTime: number;
  }[]>([]);
  const duration = 3000;
  const animationManager = useAnimationManagerContext();
  const animationId = useRef<string>(`cloud-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    if (!groupRef.current) return;

    const numWisps = 7;
    const particlesPerWisp = 60;
    const wispLength = 2.5;
    const baseWispRadius = 0.7;

    for (let i = 0; i < numWisps; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particlesPerWisp * 3);
      const opacities = new Float32Array(particlesPerWisp);
      const sizes = new Float32Array(particlesPerWisp);

      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      for (let j = 0; j < particlesPerWisp; j++) {
        const progressAlongWisp = j / (particlesPerWisp - 1);
        const wispRadius = baseWispRadius * Math.sin(progressAlongWisp * Math.PI);

        const p = new THREE.Vector3(progressAlongWisp * wispLength, 0, 0);
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = Math.random() * wispRadius;
        p.y += Math.cos(randomAngle) * randomRadius;
        p.z += Math.sin(randomAngle) * randomRadius;
        
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
        p.applyQuaternion(quaternion);

        positions[j * 3] = p.x;
        positions[j * 3 + 1] = p.y;
        positions[j * 3 + 2] = p.z;
        
        sizes[j] = 1.5 + Math.random() * 2.0;
        opacities[j] = 1.0;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffffff) },
          uFade: { value: 1.0 },
        },
        vertexShader: `
          attribute float size;
          attribute float opacity;
          varying float vOpacity;
          void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (200.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float uFade;
          varying float vOpacity;
          void main() {
            float strength = distance(gl_PointCoord, vec2(0.5));
            if (strength > 0.5) discard;
            
            float finalOpacity = vOpacity * uFade * (1.0 - strength * 2.0);

            gl_FragColor = vec4(color, finalOpacity);
          }
        `,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });

      const wisp = new THREE.Points(geometry, shaderMaterial);
      groupRef.current.add(wisp);

      wispRefs.current.push({
        mesh: wisp,
        direction: direction,
        speed: 0.8 + Math.random() * 0.7,
        startTime: Date.now() + Math.random() * 500,
      });
    }

    return () => {
      wispRefs.current.forEach(({ mesh }) => {
        groupRef.current?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.ShaderMaterial).dispose();
      });
      wispRefs.current = [];
    };
  }, []);

  // Register animation callback with the AnimationManager
  useEffect(() => {
    const callbackId = animationId.current;
    const animationCallback = (_state: unknown, delta: number) => {
      const now = Date.now();
      let allComplete = true;

      if (groupRef.current) {
          groupRef.current.position.copy(position);
      }

      wispRefs.current.forEach(wisp => {
        if (now < wisp.startTime) {
          allComplete = false;
          return;
        }

        const elapsed = now - wisp.startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        if (progress < 1) {
            allComplete = false;
        }

        const travelDistance = progress * wisp.speed * 8;
        wisp.mesh.position.copy(wisp.direction).multiplyScalar(travelDistance);
        
        // --- ✅ CHANGE: Use a power curve for a much more aggressive fade ---
        // This makes the opacity drop very quickly at the start of the animation.
        const fadeValue = 1.0 - Math.pow(progress, 0.3) - .3;

        (wisp.mesh.material as THREE.ShaderMaterial).uniforms.uFade.value = fadeValue;
        
        wisp.mesh.rotation.x += delta * wisp.speed * 0.1;
        wisp.mesh.rotation.y += delta * wisp.speed * 0.1;
      });

      if (allComplete) {
        onComplete?.();
      }
    };

    animationManager.registerAnimationCallback(callbackId, animationCallback);

    return () => {
      animationManager.unregisterAnimationCallback(callbackId);
    };
  }, [position, onComplete, duration, animationManager]);

  return <group ref={groupRef} />;
};

export default CloudAnimation;