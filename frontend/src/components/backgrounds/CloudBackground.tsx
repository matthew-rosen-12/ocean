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

              // Blue sky background
              ctx.fillStyle = "#4682B4"; // Darker steel blue
              ctx.fillRect(0, 0, 256, 256);

              // Add white cloud shapes
              ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; // White clouds
              for (let i = 0; i < 200; i++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const size = 4 + Math.random() * 8; // Slightly larger clouds

                // Draw cloud as 3-4 overlapping circles for more realistic shape
                for (let j = 0; j < 3 + Math.random() * 2; j++) {
                  ctx.beginPath();
                  ctx.arc(
                    x + (Math.random() - 0.5) * size * 0.8,
                    y + (Math.random() - 0.5) * size * 0.4,
                    size * (0.4 + Math.random() * 0.6),
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
