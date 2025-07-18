import { useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';

interface AnimationManagerProps {
  keyboardUpdateFn?: () => void;
  frameRateCallback?: () => void;
  animationCallbacks?: Array<(state: any, delta: number) => void>;
}

export interface AnimationCallback {
  id: string;
  callback: (state: any, delta: number) => void;
}

/**
 * Component that lives inside the Canvas to consolidate animation loops
 * This replaces multiple useFrame hooks and RAF loops with a single useFrame
 */
export function AnimationManager({ keyboardUpdateFn, frameRateCallback, animationCallbacks }: AnimationManagerProps) {
  const lastFrameTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();

  useFrame((state, delta) => {
    const now = Date.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    frameCountRef.current++;

    // Handle keyboard movement updates
    if (keyboardUpdateFn) {
      keyboardUpdateFn();
    }

    // Handle all registered animation callbacks
    if (animationCallbacks) {
      animationCallbacks.forEach(callback => {
        callback(state, delta);
      });
    }

    // Handle frame rate monitoring
    if (frameRateCallback) {
      // Clear any existing timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      // If frame gap is longer than 2 seconds, browser is likely throttling
      if (timeSinceLastFrame > 2000) {
        frameRateCallback();
        return;
      }

      // Set timeout to detect if no frame comes in the next 3 seconds
      throttleTimeoutRef.current = setTimeout(() => {
        if (frameRateCallback) {
          frameRateCallback();
        }
      }, 3000);
    }
  });

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  return null; // This component doesn't render anything visible
}