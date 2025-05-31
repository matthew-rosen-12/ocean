import React from "react";
import * as THREE from "three";
import { CLOUD_PLANE_CONFIG } from "../../utils/terrain";

export default function CloudBackground() {
  return (
    <>
      {/* Infinite horizontal cloud plane - same XY plane as animals, behind terrain pattern */}
      <mesh position={CLOUD_PLANE_CONFIG.position}>
        <planeGeometry args={[10000, 10000]} />
        <meshBasicMaterial transparent opacity={CLOUD_PLANE_CONFIG.opacity}>
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement("canvas");
              canvas.width = 512;
              canvas.height = 512;
              const ctx = canvas.getContext("2d")!;

              // Create gradient background
              const gradient = ctx.createLinearGradient(0, 0, 0, 512);
              gradient.addColorStop(0, "#87CEEB"); // Sky blue
              gradient.addColorStop(0.7, "#E0F6FF"); // Light blue
              gradient.addColorStop(1, "#F0F8FF"); // Alice blue
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);

              // Add cloud shapes - much smaller and more numerous
              ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
              for (let i = 0; i < 50; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const size = 8 + Math.random() * 12; // Much smaller clouds

                // Draw cloud as overlapping circles
                for (let j = 0; j < 3; j++) {
                  ctx.beginPath();
                  ctx.arc(
                    x + (Math.random() - 0.5) * size * 0.8,
                    y + (Math.random() - 0.5) * size * 0.3,
                    size * (0.2 + Math.random() * 0.3),
                    0,
                    Math.PI * 2
                  );
                  ctx.fill();
                }
              }

              return canvas;
            })()}
            wrapS={THREE.RepeatWrapping}
            wrapT={THREE.RepeatWrapping}
            repeat={new THREE.Vector2(20, 20)}
          />
        </meshBasicMaterial>
      </mesh>
    </>
  );
}
