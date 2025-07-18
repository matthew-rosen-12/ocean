import { useEffect, useRef } from 'react';

/**
 * Hook to monitor requestAnimationFrame performance and detect when browser
 * stops giving resources to the tab (throttling/freezing)
 */
export function useFrameRateMonitor(onResourceThrottling?: () => void) {
  const lastFrameTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const checkFrameRate = () => {
      const now = Date.now();
      const timeSinceLastFrame = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      frameCountRef.current++;

      // Clear any existing timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }

      // If frame gap is longer than 2 seconds, browser is likely throttling
      if (timeSinceLastFrame > 2000) {
        
        onResourceThrottling?.();
        return;
      }

      // Set timeout to detect if no frame comes in the next 3 seconds
      throttleTimeoutRef.current = setTimeout(() => {
        
        onResourceThrottling?.();
      }, 3000);

      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(checkFrameRate);
    };

    // Start monitoring
    animationFrameRef.current = requestAnimationFrame(checkFrameRate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [onResourceThrottling]);

  return {
    // Expose frame count for debugging if needed
    getFrameCount: () => frameCountRef.current,
  };
}