import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

export interface AnimationCallback {
  id: string;
  callback: (state: any, delta: number) => void;
}

/**
 * Centralized animation manager that consolidates multiple animation loops
 * into a single useFrame hook for better performance
 */
export function useAnimationManager() {
  const lastFrameTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();
  const keyboardUpdateFnRef = useRef<(() => void) | null>(null);
  const frameRateCallbackRef = useRef<(() => void) | null>(null);
  const animationCallbacksRef = useRef<Map<string, (state: any, delta: number) => void>>(new Map());

  useFrame((state, delta) => {
    const now = Date.now();
    const timeSinceLastFrame = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    frameCountRef.current++;

    // Handle keyboard movement updates
    if (keyboardUpdateFnRef.current) {
      keyboardUpdateFnRef.current();
    }

    // Handle all registered animation callbacks
    animationCallbacksRef.current.forEach((callback) => {
      callback(state, delta);
    });

    // Handle frame rate monitoring
    if (frameRateCallbackRef.current) {
      // Clear any existing timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      // If frame gap is longer than 2 seconds, browser is likely throttling
      if (timeSinceLastFrame > 2000) {
        frameRateCallbackRef.current();
        return;
      }

      // Set timeout to detect if no frame comes in the next 3 seconds
      throttleTimeoutRef.current = setTimeout(() => {
        if (frameRateCallbackRef.current) {
          frameRateCallbackRef.current();
        }
      }, 3000);
    }
  });

  return {
    // Register keyboard movement update function
    registerKeyboardUpdate: (updateFn: () => void) => {
      keyboardUpdateFnRef.current = updateFn;
    },
    
    // Register frame rate monitoring callback
    registerFrameRateCallback: (callback: () => void) => {
      frameRateCallbackRef.current = callback;
    },
    
    // Register animation callback
    registerAnimationCallback: (id: string, callback: (state: any, delta: number) => void) => {
      animationCallbacksRef.current.set(id, callback);
    },
    
    // Unregister functions
    unregisterKeyboardUpdate: () => {
      keyboardUpdateFnRef.current = null;
    },
    
    unregisterFrameRateCallback: () => {
      frameRateCallbackRef.current = null;
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = undefined;
      }
    },
    
    // Unregister animation callback
    unregisterAnimationCallback: (id: string) => {
      animationCallbacksRef.current.delete(id);
    },
    
    // Expose frame count for debugging if needed
    getFrameCount: () => frameCountRef.current,
  };
}