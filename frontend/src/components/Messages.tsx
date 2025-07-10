import React, { useState, useRef, useEffect } from 'react';
import { UserInfo, userId, NPCGroupsBiMap } from 'shared/types';
import { NPCInteraction } from 'shared/interaction-types';

interface MessagesProps {
  myUserId: userId;
  users: Map<userId, UserInfo>;
  npcGroups: NPCGroupsBiMap;
  latestInteraction: NPCInteraction | null;
  latestAiResponse: string | null;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export default function Messages({ 
  myUserId, 
  users, 
  npcGroups, 
  latestInteraction, 
  latestAiResponse
}: MessagesProps) {
  const [messageHistory, setMessageHistory] = useState<{interaction: NPCInteraction, response: string}[]>([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [showHi, setShowHi] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Get local player's captured NPC group
  const myNpcGroup = npcGroups.getByUserId(myUserId);
  const hasCapturedNpc = myNpcGroup && myNpcGroup.fileNames.length > 0;
  const myUser = users.get(myUserId);
  
  // Check if there are any messages to display
  const hasMessages = hasCapturedNpc || latestInteraction || messageHistory.length > 0;

  // Calculate minimum height to show latest message completely
  const calculateMinHeightForLatestMessage = () => {
    const headerHeight = 48; // Header height
    if (!hasMessages) {
      return headerHeight + 60; // Just header + small empty state
    }
    const messageHeight = 180; // More generous height for message with NPC images and text
    return headerHeight + messageHeight + 30; // Extra 30px buffer
  };

  // Ensure height is sufficient for showing latest message
  const ensureHeightForLatestMessage = () => {
    const minHeight = calculateMinHeightForLatestMessage();
    if (size.height < minHeight) {
      setSize(prev => ({ ...prev, height: minHeight }));
    }
  };
  const [position, setPosition] = useState<Position>({ x: 0, y: 450 }); // Start below leaderboard area
  const [size, setSize] = useState<Size>({ width: 250, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [initialPositionSet, setInitialPositionSet] = useState(false);
  
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Track previous interaction and response
  const [previousInteraction, setPreviousInteraction] = useState<NPCInteraction | null>(null);
  const [previousResponse, setPreviousResponse] = useState<string | null>(null);

  // Handle new interaction when latestInteraction changes
  useEffect(() => {
    if (latestInteraction && latestAiResponse) {
      // Save previous interaction and response to history
      if (previousInteraction && previousResponse) {
        setMessageHistory(prev => [...prev, { interaction: previousInteraction, response: previousResponse }]);
      }
      
      // Update previous interaction tracking
      setPreviousInteraction(latestInteraction);
      setPreviousResponse(latestAiResponse);
    }
  }, [latestInteraction, latestAiResponse]);

  // Check if user is scrolled to bottom (within 5px tolerance)
  const isScrolledToBottom = () => {
    if (!messageContainerRef.current) return true;
    const container = messageContainerRef.current;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
  };

  // Handle scroll events to update new message indicator and track position
  const handleScroll = () => {
    const atBottom = isScrolledToBottom();
    wasAtBottomRef.current = atBottom;
    if (atBottom) {
      setHasNewMessage(false);
    }
  };

  // Smart auto-scroll: only scroll if user was already at bottom, otherwise show indicator
  useEffect(() => {
    if (!messageContainerRef.current) return;
    
    // Check if user was at bottom before this message arrived
    const shouldAutoScroll = wasAtBottomRef.current;
    
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (messageContainerRef.current) {
        if (shouldAutoScroll) {
          // Ensure height is sufficient for latest message
          ensureHeightForLatestMessage();
          
          // User was at bottom, auto-scroll to new message
          setTimeout(() => {
            if (messageContainerRef.current) {
              messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
              setHasNewMessage(false);
              wasAtBottomRef.current = true; // Keep tracking as at bottom
            }
          }, 10);
        } else {
          // User was scrolled up, show new message indicator
          setHasNewMessage(true);
        }
      }
    });
  }, [latestInteraction, latestAiResponse, messageHistory]);

  // Auto-resize when messages state changes (empty vs has messages)
  useEffect(() => {
    if (!isCollapsed) {
      ensureHeightForLatestMessage();
    }
  }, [hasMessages, isCollapsed]);

  // Scroll to bottom function for the new message indicator
  const scrollToBottom = () => {
    if (messageContainerRef.current) {
      // Ensure height is sufficient for latest message
      ensureHeightForLatestMessage();
      
      setTimeout(() => {
        if (messageContainerRef.current) {
          messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
          setHasNewMessage(false);
          wasAtBottomRef.current = true; // Update tracking state
        }
      }, 10);
    }
  };

  // Set initial position in top right after component mounts
  useEffect(() => {
    if (!initialPositionSet && messagesRef.current) {
      const rect = messagesRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      setPosition({
        x: viewportWidth - rect.width - 20, // 20px from right edge
        y: 450 // Below leaderboard area
      });
      setInitialPositionSet(true);
    }
  }, [initialPositionSet]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true);
      const rect = messagesRef.current?.getBoundingClientRect();
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
        const rect = messagesRef.current?.getBoundingClientRect();
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

  // Alternate Hi/Bye every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowHi(prev => !prev);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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

  // Show component but adjust content based on messages state

  return (
    <div
      ref={messagesRef}
      className={`fixed bg-white bg-opacity-90 border border-gray-300 rounded-lg shadow-lg backdrop-blur-sm z-40 select-none ${
        isDragging ? 'cursor-grabbing' : isResizing ? 'cursor-nw-resize' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isCollapsed ? '48px' : `${size.height}px`, // Collapse to exact header height (p-3 = 12px top + 12px bottom + content height)
        minWidth: '200px',
        maxWidth: '500px',
        minHeight: '48px',
        maxHeight: '400px',
        resize: 'none',
        overflow: 'hidden'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className={`drag-handle bg-gray-100 ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-gray-200'}`}>
        {/* Title and collapse button */}
        <div className="drag-handle flex items-center justify-between p-3">
          <h3 className="text-sm font-semibold text-gray-800 pointer-events-none">Messages</h3>
          <button
            onClick={() => {
              if (isCollapsed) {
                // When uncollapsing, ensure height is enough for latest message
                ensureHeightForLatestMessage();
                // Auto-scroll to bottom when uncollapsing
                setTimeout(() => {
                  if (messageContainerRef.current) {
                    messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
                    wasAtBottomRef.current = true;
                  }
                }, 20); // Slightly longer delay to allow height change
              }
              setIsCollapsed(!isCollapsed);
            }}
            className="text-gray-600 hover:text-gray-800 focus:outline-none pointer-events-auto"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="relative" style={{ height: `${size.height - 48}px` }}>
          {!hasMessages ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No messages yet
            </div>
          ) : (
            <div 
              ref={messageContainerRef}
              className="overflow-y-auto h-full"
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
            <div className="px-3 pt-3 pb-1 bg-blue-50">
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
                      (latestAiResponse || 'Processing...') : 
                      `${showHi ? 'Hi' : 'Bye'} ${myUser?.animal || 'Unknown'}`
                    }
                  </div>
                </div>
              </div>
            </div>
            )}
            </div>
          )}
          
          {/* New Message Indicator - only show when there are messages */}
          {hasMessages && hasNewMessage && (
            <div className="absolute bottom-1 right-2">
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