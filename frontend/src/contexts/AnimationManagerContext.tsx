import React, { createContext, useContext, ReactNode } from 'react';
import { useAnimationManager } from '../hooks/useAnimationManager';

type AnimationManagerContextType = ReturnType<typeof useAnimationManager> | null;

const AnimationManagerContext = createContext<AnimationManagerContextType>(null);

export const useAnimationManagerContext = () => {
  const context = useContext(AnimationManagerContext);
  if (!context) {
    throw new Error('useAnimationManagerContext must be used within AnimationManagerProvider');
  }
  return context;
};

interface AnimationManagerProviderProps {
  children: ReactNode;
}

export const AnimationManagerProvider: React.FC<AnimationManagerProviderProps> = ({ children }) => {
  const animationManager = useAnimationManager();
  
  return (
    <AnimationManagerContext.Provider value={animationManager}>
      {children}
    </AnimationManagerContext.Provider>
  );
};