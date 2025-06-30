import React, { useState, useRef, useEffect } from 'react';
import { UserInfo, userId, NPCGroupsBiMap } from 'shared/types';
import { getNicknameOutlineColor, getUserColor } from '../utils/animal-colors';

interface LeaderboardProps {
  users: Map<userId, UserInfo>;
  myUserId: userId;
  npcGroups: NPCGroupsBiMap;
  gameStartTime?: number;
  gameDuration?: number;
}

interface Position {
  x: number;
  y: number;
}

export default function Leaderboard({ users, myUserId, npcGroups, gameStartTime, gameDuration }: LeaderboardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [initialPositionSet, setInitialPositionSet] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const leaderboardRef = useRef<HTMLDivElement>(null);

  // Helper function to create text outline style for a user
  const getNicknameStyle = (user: UserInfo) => {
    const animalColor = getUserColor(user);
    const outlineColor = getNicknameOutlineColor(user);
    
    // Convert THREE.Color to CSS color
    const animalColorCSS = `rgb(${Math.floor(animalColor.r * 255)}, ${Math.floor(animalColor.g * 255)}, ${Math.floor(animalColor.b * 255)})`;
    const outlineColorCSS = `rgb(${Math.floor(outlineColor.r * 255)}, ${Math.floor(outlineColor.g * 255)}, ${Math.floor(outlineColor.b * 255)})`;
    
    return {
      color: animalColorCSS,
      textShadow: `
        -1px -1px 0 ${outlineColorCSS},
        1px -1px 0 ${outlineColorCSS},
        -1px 1px 0 ${outlineColorCSS},
        1px 1px 0 ${outlineColorCSS}
      `
    };
  };

  // Update current time every second for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set initial position in top right after component mounts
  useEffect(() => {
    if (!initialPositionSet && leaderboardRef.current) {
      const rect = leaderboardRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      setPosition({
        x: viewportWidth - rect.width - 20, // 20px from right edge
        y: 20 // 20px from top
      });
      setInitialPositionSet(true);
    }
  }, [initialPositionSet]);

  // Sort users by NPC count (descending)
  const sortedUsers = Array.from(users.values())
    .map(user => {
      // Get NPC count from the npcGroups BiMap
      const userNpcGroup = npcGroups.getByUserId(user.id);
      const npcCount = userNpcGroup?.fileNames?.length || 0;
      
      return {
        ...user,
        npcCount
      };
    })
    .sort((a, b) => b.npcCount - a.npcCount);

  // Calculate remaining time
  const calculateRemainingTime = () => {
    if (!gameStartTime || !gameDuration) {
      return null;
    }

    const elapsed = currentTime - gameStartTime;
    const remaining = Math.max(0, gameDuration - elapsed);
    
    return Math.floor(remaining / 1000); // Return seconds (floor instead of ceil)
  };

  const remainingSeconds = calculateRemainingTime();
  const isLowTime = remainingSeconds !== null && remainingSeconds <= 10;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true);
      const rect = leaderboardRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  // Handle drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={leaderboardRef}
      className={`fixed bg-white bg-opacity-90 border border-gray-300 rounded-lg shadow-lg backdrop-blur-sm z-50 select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '200px',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="drag-handle bg-gray-100 rounded-t-lg border-b border-gray-200">
        {/* Timer */}
        {remainingSeconds !== null && (
          <div className="drag-handle px-3 pt-2 text-center">
            <div className={`text-lg font-bold pointer-events-none ${
              isLowTime ? 'text-red-600' : 'text-gray-800'
            }`}>
              {formatTime(remainingSeconds)}
            </div>
          </div>
        )}
        
        {/* Title and collapse button */}
        <div className="drag-handle flex items-center justify-between p-3">
          <h3 className="text-sm font-semibold text-gray-800 pointer-events-none">Leaderboard</h3>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-600 hover:text-gray-800 focus:outline-none pointer-events-auto"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3">
          {sortedUsers.length === 0 ? (
            <div className="text-gray-500 text-sm">No players</div>
          ) : (
            <div className="space-y-2">
              {sortedUsers.map((user, index) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-2 rounded ${
                    user.id === myUserId
                      ? 'bg-blue-100 border border-blue-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${
                      index === 0 && user.npcCount > 0 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {index === 0 && user.npcCount > 0 ? '🏆' : `#${index + 1}`}
                    </span>
                    <div className="flex flex-col">
                      <span 
                        className="text-sm font-medium"
                        style={getNicknameStyle(user)}
                      >
                        {user.nickname || ''}
                      </span>
                      <span className="text-xs text-gray-500">
                        {user.animal}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`text-sm font-bold ${
                      user.npcCount > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {user.npcCount}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user.npcCount === 1 ? 'NPC' : 'NPCs'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}