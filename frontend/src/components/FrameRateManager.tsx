import React, { useEffect, useRef } from 'react';
import { useAnimationManagerContext } from '../contexts/AnimationManagerContext';

interface FrameRateManagerProps {
  onInactivityKick?: () => void;
}

export const FrameRateManager: React.FC<FrameRateManagerProps> = ({ onInactivityKick }) => {
  const animationManager = useAnimationManagerContext();

  // Register frame rate monitoring with AnimationManager
  useEffect(() => {
    if (onInactivityKick) {
      animationManager.registerFrameRateCallback(onInactivityKick);
    }

    return () => {
      animationManager.unregisterFrameRateCallback();
    };
  }, [animationManager, onInactivityKick]);

  return null; // This component doesn't render anything
};