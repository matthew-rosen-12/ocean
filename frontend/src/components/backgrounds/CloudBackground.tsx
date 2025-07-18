import React from "react";
import * as THREE from "three";
import { CLOUD_PLANE_CONFIG } from "../../utils/terrain";

export default function CloudBackground() {
  return (
    <>
      {/* Cloud plane background - same XY plane as animals, behind terrain pattern */}
      <mesh position={CLOUD_PLANE_CONFIG.position}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial 
          transparent 
          opacity={CLOUD_PLANE_CONFIG.opacity}
          depthWrite={false}
          depthTest={true}
        >
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

              // Add cloud shapes with white and gray tones for more variation
              const cloudShades = [
                "rgba(255, 255, 255, 0.95)", // Pure white
                "rgba(248, 248, 255, 0.9)", // Ghost white
                "rgba(245, 245, 245, 0.85)", // White smoke
                "rgba(220, 220, 220, 0.8)", // Light gray
                "rgba(200, 200, 200, 0.75)", // Silver gray
                "rgba(240, 248, 255, 0.8)", // Alice blue tint
                "rgba(230, 230, 230, 0.7)", // Medium light gray
                "rgba(211, 211, 211, 0.65)", // Light gray tone
              ];
              
              for (let i = 0; i < 200; i++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const size = 4 + Math.random() * 8; // Slightly larger clouds
                
                // Choose random shade for this cloud
                const shadeIndex = Math.floor(Math.random() * cloudShades.length);
                ctx.fillStyle = cloudShades[shadeIndex];

                // Draw cloud as 3-4 overlapping circles for more realistic shape
                const blobCount = 3 + Math.random() * 2;
                for (let j = 0; j < blobCount; j++) {
                  const blobX = x + (Math.random() - 0.5) * size * 0.8;
                  const blobY = y + (Math.random() - 0.5) * size * 0.4;
                  const blobRadius = size * (0.4 + Math.random() * 0.6);
                  
                  ctx.beginPath();
                  ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Add outline to make blob shapes more visible
                  if (Math.random() > 0.1) { // Almost all blobs get an outline
                    ctx.strokeStyle = `rgba(170, 170, 170, ${0.6 + Math.random() * 0.3})`;
                    ctx.lineWidth = 1.5 + Math.random() * 1.5;
                    ctx.stroke();
                  }
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
