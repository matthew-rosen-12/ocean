import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { userId, UserInfo, NPCGroupsBiMap, FinalScores, ANIMAL_SCALES } from "shared/types";
import * as THREE from "three";

interface CinematicScreenshotProps {
  users: Map<userId, UserInfo>;
  npcGroups: NPCGroupsBiMap;
  onScreenshotCapture?: (screenshot: string) => void;
  onGameOver?: (finalScores: FinalScores) => void;
  setCinematicActive: (active: boolean) => void;
  setShowTimesUpText: (show: boolean) => void;
  setShowFlash: (show: boolean) => void;
}

export function CinematicScreenshot({
  users,
  npcGroups,
  onScreenshotCapture,
  onGameOver,
  setCinematicActive,
  setShowTimesUpText,
  setShowFlash,
}: CinematicScreenshotProps) {
  const { gl, scene, camera } = useThree();
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    const startCinematicSequence = (winnerUserId: string) => {
      if (!onScreenshotCapture || !winnerUserId || isAnimating) return;
      
      const winnerUser = users.get(winnerUserId);
      if (!winnerUser) return;
      
      setIsAnimating(true);
      setCinematicActive(true);
      setShowTimesUpText(true);
      
      // Calculate winner's NPC group size and animal type for zoom adjustment
      const winnerNpcGroup = npcGroups.getByUserId(winnerUserId);
      const npcCount = winnerNpcGroup?.fileNames?.length || 0;
      
      // Get winner's animal scale
      const winnerAnimal = winnerUser.animal?.toUpperCase() as keyof typeof ANIMAL_SCALES;
      const animalScale = ANIMAL_SCALES[winnerAnimal] || 1.0;
      
      // Calculate zoom based on animal size and NPC group size
      const currentCameraDistance = 30; // Normal camera distance
      const baseZoomIn = .1; // Zoom in much closer (smaller Z = closer)
      
      // Adjust zoom based on animal size (larger animals need to be further back)
      const animalSizeAdjustment = animalScale
      
      // Adjust zoom based on NPC count (more NPCs = need to be further back to fit all)
      const npcSizeAdjustment = Math.sqrt(npcCount) + 1
      
      // Final zoom calculation: zoom in from current distance, then adjust for animal and NPC size
      const targetZoom = currentCameraDistance * (baseZoomIn * animalSizeAdjustment * npcSizeAdjustment);
      
      // Store original camera position
      const originalPosition = camera.position.clone();
      
      // Phase 1: Keep camera on current player but zoom to target Z
      const zTargetPosition = new THREE.Vector3(
        originalPosition.x, // Stay at current player's X position
        originalPosition.y, // Stay at current player's Y position
        targetZoom // Zoom to target Z level
      );
      
      // Phase 2: Move from current player to winner in XY plane
      const finalTargetPosition = new THREE.Vector3(
        winnerUser.position.x, // Move to winner's X position
        winnerUser.position.y, // Move to winner's Y position
        targetZoom // Keep the zoomed Z level
      );
      
      // Animation timing
      const phase1Duration = 1000; // 1 second for Z movement
      const phase2Duration = 500;  // 0.5 seconds for XY movement
      const totalDuration = phase1Duration + phase2Duration;
      const startTime = Date.now();
      
      // Hide "TIMES UP!" text 500ms before flash (at 1000ms)
      setTimeout(() => {
        setShowTimesUpText(false);
      }, 1000);
      
      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const totalProgress = Math.min(elapsed / totalDuration, 1);
        
        if (elapsed < phase1Duration) {
          // Phase 1: Keep camera on current player, zoom to target Z
          const phase1Progress = elapsed / phase1Duration;
          const easedProgress = 1 - Math.pow(1 - phase1Progress, 3); // ease-out-cubic
          
          camera.position.lerpVectors(originalPosition, zTargetPosition, easedProgress);
        } else {
          // Phase 2: Move camera from current player to winner in XY plane
          const phase2Progress = (elapsed - phase1Duration) / phase2Duration;
          const easedProgress = 1 - Math.pow(1 - phase2Progress, 3); // ease-out-cubic
          
          camera.position.lerpVectors(zTargetPosition, finalTargetPosition, easedProgress);
        }
        camera.updateProjectionMatrix();
        
        if (totalProgress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          // Animation complete - trigger flash and screenshot
          triggerFlashAndScreenshot();
        }
      };
      
      const triggerFlashAndScreenshot = () => {
        // Show flash effect
        setShowFlash(true);
        
        // Take screenshot after flash starts
        setTimeout(() => {
          try {
            // Force a final render to ensure canvas is up to date
            gl.render(scene, camera);
            
            const canvas = gl.domElement;
            const screenshot = canvas.toDataURL('image/png', 0.9);
            onScreenshotCapture(screenshot);
          } catch (error) {
            console.error('Screenshot failed:', error);
          }
          
          // Hide flash and trigger game over
          setTimeout(() => {
            setShowFlash(false);
            setIsAnimating(false);
            setCinematicActive(false);
            setShowTimesUpText(false);
            if (onGameOver) {
              const storedFinalScores = (window as any).finalScores;
              onGameOver(storedFinalScores);
            }
          }, 200); // Flash duration
          
        }, 100); // Small delay for flash effect
      };
      
      // Start the animation
      requestAnimationFrame(animateCamera);
    };

    // Expose the function globally
    (window as any).captureGameScreenshot = startCinematicSequence;

    return () => {
      delete (window as any).captureGameScreenshot;
    };
  }, [gl, scene, camera, onScreenshotCapture, users, npcGroups, isAnimating, onGameOver, setCinematicActive, setShowTimesUpText, setShowFlash]);

  return null; // This component doesn't render anything in the Canvas
}