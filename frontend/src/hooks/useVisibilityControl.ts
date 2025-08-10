import { useEffect, useRef } from 'react';

/**
 * Hook to kick inactive players after 30 seconds when tab loses focus/visibility
 * Works alongside frame rate monitoring for comprehensive inactivity detection
 */
export function useVisibilityControl(onInactivityKick?: () => void) {
  const inactivityTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };

    const startInactivityTimer = () => {
      clearInactivityTimer(); // Clear any existing timer
      
      inactivityTimerRef.current = setTimeout(() => {
        onInactivityKick?.();
      }, 30000) as unknown as number; // 30 seconds
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        startInactivityTimer();
      } else {
        clearInactivityTimer();
      }
    };

    const handleFocus = () => {
      clearInactivityTimer();
    };

    const handleBlur = () => {
      startInactivityTimer();
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus/blur events as backup
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      clearInactivityTimer();
    };
  }, [onInactivityKick]);
}