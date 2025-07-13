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

              // Blue sky background - darker blue
              ctx.fillStyle = "#2F5F8F"; // Darker blue
              ctx.fillRect(0, 0, 256, 256);

              // Add cloud shapes with different shades of white/off-white
              const cloudShades = [
                "rgba(255, 255, 255, 0.9)", // Pure white
                "rgba(248, 248, 255, 0.85)", // Ghost white
                "rgba(245, 245, 245, 0.8)", // White smoke
                "rgba(240, 248, 255, 0.75)", // Alice blue tint
                "rgba(255, 250, 240, 0.8)", // Floral white (warm off-white)
              ];
              
              for (let i = 0; i < 200; i++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const size = 4 + Math.random() * 8; // Slightly larger clouds
                
                // Choose random shade for this cloud
                ctx.fillStyle = cloudShades[Math.floor(Math.random() * cloudShades.length)];

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
