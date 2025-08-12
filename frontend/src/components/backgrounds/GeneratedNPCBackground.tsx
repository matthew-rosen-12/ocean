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
          background: 'radial-gradient(ellipse at 30% 70%, rgba(45, 35, 55, 0.8), rgba(20, 25, 45, 0.9), rgba(10, 15, 25, 0.8))',
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