import React from "react";
import * as THREE from "three";
import { CLOUD_PLANE_CONFIG } from "../../utils/terrain";

export default function CloudBackground() {
  return (
    <>
      {/* Cloud plane background - same XY plane as animals, behind terrain pattern */}
      <mesh position={CLOUD_PLANE_CONFIG.position}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={CLOUD_PLANE_CONFIG.opacity}>
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement("canvas");
              canvas.width = 256;
              canvas.height = 256;
              const ctx = canvas.getContext("2d")!;

              // Add much smaller cloud shapes
              ctx.fillStyle = "rgba(255, 0, 255, 0.4)";
              for (let i = 0; i < 300; i++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const size = 3 + Math.random() * 6; // Very small clouds

                // Draw cloud as 2 overlapping circles
                for (let j = 0; j < 2; j++) {
                  ctx.beginPath();
                  ctx.arc(
                    x + (Math.random() - 0.5) * size * 0.6,
                    y + (Math.random() - 0.5) * size * 0.2,
                    size * (0.3 + Math.random() * 0.4),
                    0,
                    Math.PI * 2
                  );
                  ctx.fill();
                }
              }

              return canvas;
            })()}
          />
        </meshBasicMaterial>
      </mesh>
    </>
  );
}
