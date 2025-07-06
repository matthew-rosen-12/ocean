import React, { useState, useRef, useEffect } from 'react';
import { UserInfo, userId, NPCGroupsBiMap } from 'shared/types';
import { NPCInteraction } from 'shared/interaction-types';
import { getNicknameOutlineColor, getUserColor } from '../utils/animal-colors';

interface LeaderboardProps {
  users: Map<userId, UserInfo>;
  myUserId: userId;
  npcGroups: NPCGroupsBiMap;
  gameStartTime?: number;
  gameDuration?: number;
  onInteractionUpdate?: (setter: (interaction: NPCInteraction) => void) => void;
  latestInteraction: NPCInteraction | null;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export default function Leaderboard({ users, myUserId, npcGroups, gameStartTime, gameDuration, onInteractionUpdate, latestInteraction }: LeaderboardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 20 });
  const [size, setSize] = useState<Size>({ width: 250, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [initialPositionSet, setInitialPositionSet] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showHi, setShowHi] = useState(true);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageHistory, setMessageHistory] = useState<{interaction: NPCInteraction, response: string}[]>([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Function to call AI API - non-blocking
  const callAIAPI = (interaction: NPCInteraction, previousInteraction?: NPCInteraction, previousResponse?: string) => {
    // Save previous interaction and response to history
    if (previousInteraction && previousResponse) {
      setMessageHistory(prev => [...prev, { interaction: previousInteraction, response: previousResponse }]);
    }
    
    setIsLoading(true);
    setAiResponse(null);
    
    console.log('Sending interaction:', interaction);
    
    // Make API call without blocking the UI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    fetch('http://localhost:3001/api/ai-chat/generate-from-interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ interaction }),
      signal: controller.signal,
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      return response.json();
    })
    .then(data => {
      setAiResponse(data.response);
    })
    .catch(error => {
      console.error('Error calling AI API:', error);
      setAiResponse('Error generating response');
    })
    .finally(() => {
      clearTimeout(timeoutId);
      setIsLoading(false);
    });
  };

  // Track previous interaction and response
  const [previousInteraction, setPreviousInteraction] = useState<NPCInteraction | null>(null);
  const [previousResponse, setPreviousResponse] = useState<string | null>(null);

  // Call AI API when latestInteraction changes
  useEffect(() => {
    if (latestInteraction) {
      callAIAPI(latestInteraction, previousInteraction || undefined, previousResponse || undefined);
      
      // Update previous interaction tracking
      setPreviousInteraction(latestInteraction);
    }
  }, [latestInteraction]);

  // Update previous response when AI response changes
  useEffect(() => {
    if (aiResponse && !isLoading) {
      setPreviousResponse(aiResponse);
    }
  }, [aiResponse, isLoading]);

  // Check if user is scrolled to bottom (within 5px tolerance)
  const isScrolledToBottom = () => {
    if (!messageContainerRef.current) return true;
    const container = messageContainerRef.current;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
  };

  // Handle scroll events to update new message indicator
  const handleScroll = () => {
    if (isScrolledToBottom()) {
      setHasNewMessage(false);
    }
  };

  // Smart auto-scroll: only scroll if user was already at bottom, otherwise show indicator
  useEffect(() => {
    if (messageContainerRef.current) {
      const wasAtBottom = isScrolledToBottom();
      
      if (wasAtBottom) {
        // User was at bottom, auto-scroll to new message
        messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        setHasNewMessage(false);
      } else {
        // User was scrolled up, show new message indicator
        setHasNewMessage(true);
      }
    }
  }, [latestInteraction, aiResponse]);

  // Scroll to bottom function for the new message indicator
  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      setHasNewMessage(false);
    }
  };

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

  // Alternate Hi/Bye every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowHi(prev => !prev);
    }, 10000);

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

  // Format interaction for message display
  const formatMessageTitle = (interaction: NPCInteraction) => {
    const primaryNpc = interaction.npcFaceFileName.replace('.png', '');
    const hasSecondary = 'secondaryNpcFaceFileName' in interaction && interaction.secondaryNpcFaceFileName;
    const secondaryNpc = hasSecondary ? interaction.secondaryNpcFaceFileName.replace('.png', '') : null;
    
    if (secondaryNpc) {
      return `[${primaryNpc} to ${secondaryNpc}]`;
    } else {
      return `[${primaryNpc}]`;
    }
  };

  // Get local player's captured NPC group
  const myNpcGroup = npcGroups.getByUserId(myUserId);
  const hasCapturedNpc = myNpcGroup && myNpcGroup.fileNames.length > 0;
  const myUser = users.get(myUserId);
  


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

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  // Handle drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      } else if (isResizing) {
        const rect = leaderboardRef.current?.getBoundingClientRect();
        if (rect) {
          const newWidth = Math.max(200, e.clientX - rect.left);
          const newHeight = Math.max(100, e.clientY - rect.top);
          setSize({
            width: newWidth,
            height: newHeight
          });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset]);

  return (
    <div
      ref={leaderboardRef}
      className={`fixed bg-white bg-opacity-90 border border-gray-300 rounded-lg shadow-lg backdrop-blur-sm z-50 select-none ${
        isDragging ? 'cursor-grabbing' : isResizing ? 'cursor-nw-resize' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: '200px',
        maxWidth: '500px',
        minHeight: '100px',
        maxHeight: '600px',
        resize: 'none',
        overflow: 'hidden'
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
        <div className="p-3 overflow-y-auto" style={{ maxHeight: `${size.height - 120}px` }}>
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

      {/* Messages - show if not collapsed and (has captured NPC OR has interactions) */}
      {!isCollapsed && (hasCapturedNpc || latestInteraction || messageHistory.length > 0) && (
        <div className="border-t border-gray-200">
          <div className="relative">
            <div 
              ref={messageContainerRef}
              className="max-h-40 overflow-y-auto"
              style={{ maxHeight: `${Math.min(160, size.height - 200)}px` }}
              onScroll={handleScroll}
            >
            {/* Message History */}
            {messageHistory.map((entry, index) => (
              <div key={`${entry.interaction.timestamp}-${index}`} className="border-b border-gray-100 p-3">
                <div className="flex items-start space-x-3">
                  <div className="flex flex-col space-y-2">
                    <img 
                      src={`/npcs/${entry.interaction.npcFaceFileName}`}
                      alt="Primary NPC"
                      className="w-10 h-10 rounded-full border-2 border-gray-300 object-cover"
                    />
                    {('secondaryNpcFaceFileName' in entry.interaction && entry.interaction.secondaryNpcFaceFileName) && (
                      <img 
                        src={`/npcs/${entry.interaction.secondaryNpcFaceFileName}`}
                        alt="Secondary NPC"
                        className="w-8 h-8 rounded-full border-2 border-gray-300 object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="text-xs text-gray-600 mb-1">
                      {formatMessageTitle(entry.interaction)}
                    </div>
                    <div className="text-sm text-gray-800 break-words">
                      {entry.response}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Current Message */}
            {(latestInteraction || hasCapturedNpc) && (
              <div className="p-3 bg-blue-50">
                <div className="flex items-start space-x-3">
                  <div className="flex flex-col space-y-2">
                    <img 
                      src={`/npcs/${latestInteraction?.npcFaceFileName || myNpcGroup?.faceFileName || 'default.png'}`}
                      alt="Primary NPC"
                      className="w-12 h-12 rounded-full border-2 border-blue-300 object-cover"
                    />
                    {latestInteraction && 'secondaryNpcFaceFileName' in latestInteraction && latestInteraction.secondaryNpcFaceFileName && (
                      <img 
                        src={`/npcs/${latestInteraction.secondaryNpcFaceFileName}`}
                        alt="Secondary NPC"
                        className="w-10 h-10 rounded-full border-2 border-blue-300 object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    {latestInteraction && (
                      <div className="text-xs text-blue-600 mb-1">
                        {formatMessageTitle(latestInteraction)}
                      </div>
                    )}
                    <div className="text-sm font-bold text-gray-800 break-words">
                      {latestInteraction ? 
                        (isLoading ? 'Thinking...' : aiResponse || 'Processing...') : 
                        `${showHi ? 'Hi' : 'Bye'} ${myUser?.animal || 'Unknown'}`
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
            
            {/* New Message Indicator */}
            {hasNewMessage && (
              <div className="absolute bottom-2 right-2">
                <button
                  onClick={scrollToBottom}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-lg transition-colors flex items-center space-x-1"
                >
                  <span>New</span>
                  <span>↓</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-gray-400 opacity-50 hover:opacity-100 transition-opacity"
        style={{
          clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
        }}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}