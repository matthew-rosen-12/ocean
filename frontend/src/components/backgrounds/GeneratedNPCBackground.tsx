import React from 'react';
import { npcBackgroundStyles } from '../../styles/npc-backgrounds';

interface GeneratedNPCBackgroundProps {
  className?: string;
  opacity?: number;
}

export default function GeneratedNPCBackground({ 
  className = '',
  opacity = 0.7 
}: GeneratedNPCBackgroundProps) {
  const backgroundStyle = npcBackgroundStyles;
  
  return (
    <>
      <div 
        className={`fixed inset-0 pointer-events-none ${className}`}
        style={{
          ...backgroundStyle,
          opacity,
          zIndex: -10,
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
        }}
      />
      {/* Warm filter overlay for the background */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(145deg, rgb(92, 103, 114), rgba(70, 85, 100, 0.9), rgba(50, 65, 90, 0.8))',
          zIndex: -9,
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          mixBlendMode: 'multiply'
        }}
      />
    </>
  );
}