import React, { useState, useRef, useEffect } from 'react';
import { UserInfo, userId, NPCGroupsBiMap } from 'shared/types';
import { NPCInteraction, AIResponse, AIResponseType } from 'shared/interaction-types';

interface MessagesProps {
  myUserId: userId;
  users: Map<userId, UserInfo>;
  npcGroups: NPCGroupsBiMap;
  latestInteraction: NPCInteraction | null;
  latestAiResponse: AIResponse | null;
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
  const [messageHistory, setMessageHistory] = useState<{interaction: NPCInteraction, response: AIResponse}[]>([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Get local player's captured NPC group
  const myNpcGroup = npcGroups.getByUserId(myUserId);
  const hasCapturedNpc = myNpcGroup && myNpcGroup.fileNames.length > 0;
  const myUser = users.get(myUserId);
  
  // Check if there are any messages to display
  const hasMessages = hasCapturedNpc || latestInteraction || messageHistory.length > 0;

  // Calculate minimum height to show latest message completely
  const calculateMinHeightForLatestMessage = () => {
    const headerHeight = 64; // Header height (updated for p-4)
    if (!hasMessages) {
      return headerHeight + 60; // Just header + small empty state
    }
    
    // Dynamically calculate required height based on actual content
    if (messageContainerRef.current) {
      const container = messageContainerRef.current;
      const scrollHeight = container.scrollHeight;
      const requiredHeight = headerHeight + scrollHeight + 20; // 20px buffer
      return Math.min(requiredHeight, 400); // Cap at max height
    }
    
    // Smarter fallback: estimate based on whether we have actual content or just "typing..."
    const isTypingOnly = !latestAiResponse && latestInteraction;
    const estimatedMessageHeight = isTypingOnly ? 80 : 120; // Much smaller for typing state
    return headerHeight + estimatedMessageHeight + 20; // Reduced buffer
  };

  // Ensure height is sufficient for showing latest message
  const ensureHeightForLatestMessage = () => {
    // Wait for DOM to update, then calculate required height
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { // Double RAF for more reliable DOM measurements
        const minHeight = calculateMinHeightForLatestMessage();
        // Only increase height if current height is significantly smaller (more than 20px difference)
        // This prevents tiny adjustments for similar content
        if (size.height < minHeight - 20) {
          const targetHeight = Math.min(minHeight, 400); // Remove extra buffer, cap at max
          setSize(prev => ({ ...prev, height: targetHeight }));
        }
      });
    });
  };
  const [position, setPosition] = useState<Position>(() => ({
    x: window.innerWidth - 270, // Start near final position (approximate width + margin)
    y: 450 // Below leaderboard area
  }));
  const [size, setSize] = useState<Size>({ width: 250, height: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [initialPositionSet, setInitialPositionSet] = useState(false);
  
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Track previous interaction and response
  const [previousInteraction, setPreviousInteraction] = useState<NPCInteraction | null>(null);
  const [previousResponse, setPreviousResponse] = useState<AIResponse | null>(null);

  // Handle new interaction when latestInteraction changes
  useEffect(() => {
    if (latestInteraction && latestAiResponse) {
      // Batch message history and tracking updates together
      React.startTransition(() => {
        // Save previous interaction and response to history
        if (previousInteraction && previousResponse) {
          setMessageHistory(prev => [...prev, { interaction: previousInteraction, response: previousResponse }]);
        }
        
        // Update previous interaction tracking
        setPreviousInteraction(latestInteraction);
        setPreviousResponse(latestAiResponse);
      });
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
          }, 50); // Increased delay to work better with height transitions
        } else {
          // User was scrolled up, show new message indicator
          setHasNewMessage(true);
        }
      }
    });
  }, [latestInteraction, latestAiResponse, messageHistory, ensureHeightForLatestMessage]);

  // Auto-resize when messages state changes (empty vs has messages)
  useEffect(() => {
    if (!isCollapsed) {
      ensureHeightForLatestMessage();
    }
  }, [hasMessages, isCollapsed, ensureHeightForLatestMessage]);

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
      }, 50); // Increased delay to work better with height transitions
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
        // Use startTransition for smoother dragging experience
        React.startTransition(() => {
          setPosition({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          });
        });
      } else if (isResizing) {
        const rect = messagesRef.current?.getBoundingClientRect();
        if (rect) {
          const newWidth = Math.max(200, e.clientX - rect.left);
          const newHeight = Math.max(100, e.clientY - rect.top);
          // Use startTransition for smoother resizing experience
          React.startTransition(() => {
            setSize({
              width: newWidth,
              height: newHeight
            });
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Batch drag/resize state cleanup together
      React.startTransition(() => {
        setIsDragging(false);
        setIsResizing(false);
      });
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

  // Format AI response based on type
  const formatAIResponse = (response: AIResponse, _interaction: NPCInteraction, userAnimal?: string) => {
    switch (response.type) {
      case AIResponseType.SUCCESS:
        return response.message;
      case AIResponseType.ERROR:
      case AIResponseType.RATE_LIMITED:
        return response.greeting || `Hi ${userAnimal || 'Unknown'}`;
      default:
        return response.message;
    }
  };

  // Show component but adjust content based on messages state

  return (
    <div
      ref={messagesRef}
      className={`fixed backdrop-blur-lg bg-white/80 border border-white/50 rounded-3xl shadow-2xl z-40 select-none ${
        isDragging || isResizing ? '' : 'transition-all duration-500 ease-out'
      } ${
        isDragging ? 'cursor-grabbing' : isResizing ? 'cursor-nw-resize' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isCollapsed ? '64px' : `${size.height}px`, // Collapse to exact header height (p-4 = 16px top + 16px bottom + content height)
        minWidth: '200px',
        maxWidth: '500px',
        minHeight: '64px',
        maxHeight: '400px',
        resize: 'none',
        overflow: 'hidden',
        transition: isDragging || isResizing ? 'none' : 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className={`drag-handle bg-gray-100/90 backdrop-blur-sm ${isCollapsed ? 'rounded-3xl' : 'rounded-t-3xl border-b border-gray-200/50'}`}>
        {/* Title and collapse button */}
        <div className="drag-handle flex items-center justify-between p-4">
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
                }, 450); // Wait for height transition to complete (400ms + buffer)
              }
              setIsCollapsed(!isCollapsed);
            }}
            className="text-gray-600 hover:text-gray-800 focus:outline-none pointer-events-auto transition-colors duration-200"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="relative transition-all duration-400 ease-out" style={{ height: `${size.height - 64}px` }}>
          {!hasMessages ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No messages yet
            </div>
          ) : (
            <div 
              ref={messageContainerRef}
              className="overflow-y-auto h-full pb-4 transition-all duration-400 ease-out"
              onScroll={handleScroll}
            >
              {/* Message History */}
              {messageHistory.map((entry, index) => (
            <div key={`${entry.interaction.timestamp}-${index}`} className="border-b border-gray-200/50 p-3">
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
                    {formatAIResponse(entry.response, entry.interaction, myUser?.animal)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Current Message */}
          {(latestInteraction || hasCapturedNpc) && (
            <div className="px-3 pt-3 pb-1 bg-blue-100/70 backdrop-blur-sm transition-all duration-200 ease-in-out">
              <div className="flex items-start space-x-3">
                <div className="flex flex-col space-y-2">
                  <img 
                    src={`/npcs/${latestInteraction?.npcFaceFileName || myNpcGroup?.faceFileName || 'default.png'}`}
                    alt="Primary NPC"
                    className="w-12 h-12 rounded-full border-2 border-blue-400 object-cover"
                  />
                  {latestInteraction && 'secondaryNpcFaceFileName' in latestInteraction && latestInteraction.secondaryNpcFaceFileName && (
                    <img 
                      src={`/npcs/${latestInteraction.secondaryNpcFaceFileName}`}
                      alt="Secondary NPC"
                      className="w-10 h-10 rounded-full border-2 border-blue-400 object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  {latestInteraction && (
                    <div className="text-xs text-blue-700 mb-1 transition-all duration-150 ease-in-out">
                      {formatMessageTitle(latestInteraction)}
                    </div>
                  )}
                  <div className="text-sm font-bold text-gray-800 break-words transition-all duration-200 ease-in-out">
                    {latestInteraction ? 
                      (latestAiResponse ? 
                        formatAIResponse(latestAiResponse, latestInteraction, myUser?.animal) : 
                        'typing...'
                      ) : 
                      'typing...'
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
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs px-3 py-2 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-1"
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
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-gray-600 hover:bg-gray-800 shadow-lg transition-all duration-200"
        style={{
          clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
        }}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}