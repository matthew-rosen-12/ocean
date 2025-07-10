import React from 'react';
import { npcBackgroundStyles, NPCBackgroundVariant } from '../../styles/npc-backgrounds';

interface GeneratedNPCBackgroundProps {
  variant?: NPCBackgroundVariant;
  className?: string;
  opacity?: number;
}

export default function GeneratedNPCBackground({ 
  variant = 'default', 
  className = '',
  opacity = 0.7 
}: GeneratedNPCBackgroundProps) {
  const backgroundStyle = npcBackgroundStyles[variant];
  
  return (
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
  );
}