import React from 'react';

interface DevWrapperProps {
  children: React.ReactNode;
}

/**
 * Custom development wrapper that provides some StrictMode benefits
 * without the double-invocation that can cause issues with external systems
 */
export const DevWrapper: React.FC<DevWrapperProps> = ({ children }) => {
  // Only apply in development
  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>;
  }

  // Add development-only checks without double-invocation
  React.useEffect(() => {
    // Detect deprecated features
    const originalWarn = console.warn;
    console.warn = (...args) => {
      // Highlight React warnings
      if (args[0]?.includes?.('Warning:')) {
        console.error('🚨 REACT WARNING:', ...args);
      } else {
        originalWarn(...args);
      }
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);

  return <>{children}</>;
};