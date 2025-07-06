import { useEffect, useRef } from 'react';

/**
 * Hook to kick inactive players after 30 seconds
 * Simple and immediate - no attempt to keep game running in background
 */
export function useVisibilityControl(onInactivityKick?: () => void) {
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log('Player kicked due to 30 seconds of inactivity');
        onInactivityKick?.();
      }, 30000); // 30 seconds
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden - starting inactivity timer');
        startInactivityTimer();
      } else {
        console.log('Tab visible - clearing inactivity timer');
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