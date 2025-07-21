// nature_v_npc/app/components/GuestLogin.tsx
import React, { useState, useEffect, useRef } from "react";
import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';
import {
  NPCGroup,
  pathData,
  UserInfo,
  npcGroupId,
  userId,
  NPCPhase,
  PathPhase,
  NPCGroupsBiMap,
  Position,
  TerrainConfig,
  FinalScores,
} from "shared/types";
import { NPCInteraction, createInteraction } from "shared/interaction-prompts";
import { AIResponse } from "shared/interaction-types";
import { getSocket } from "../socket";
import { ServerTerrainConfig } from "../utils/terrain";
import { TypedSocket } from "../utils/typed-socket";
import GeneratedNPCBackground from "./backgrounds/GeneratedNPCBackground";

// Cookie utility functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') cookie = cookie.substring(1, cookie.length);
    if (cookie.indexOf(nameEQ) === 0) return cookie.substring(nameEQ.length, cookie.length);
  }
  return null;
};

interface Props {
  setMyUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<userId, UserInfo>>>;
  setPaths: React.Dispatch<React.SetStateAction<Map<npcGroupId, pathData>>>;
  setNPCGroups: React.Dispatch<
    React.SetStateAction<NPCGroupsBiMap>
  >;
  setTerrainConfig: React.Dispatch<
    React.SetStateAction<ServerTerrainConfig | null>
  >;
  setGameStartTime: React.Dispatch<React.SetStateAction<number | undefined>>;
  setGameDuration: React.Dispatch<React.SetStateAction<number | undefined>>;
  deletingNPCs: Set<string>;
  setDeletingNPCs: React.Dispatch<React.SetStateAction<Set<string>>>;
  interactionSetter: ((interaction: NPCInteraction, aiResponse: AIResponse) => void) | null;
  // Note: setGameOver, setFinalScores, and setWinnerScreenshot are now handled by Scene component
}

export default function GuestLogin({
  setMyUser,
  setUsers,
  setPaths,
  setNPCGroups,
  setTerrainConfig,
  setGameStartTime,
  setGameDuration,
  deletingNPCs,
  setDeletingNPCs,
  interactionSetter,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [suggestedNickname, setSuggestedNickname] = useState("");
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const myUserRef = useRef<UserInfo | null>(null);
  const pathsRef = useRef<Map<npcGroupId, pathData>>(new Map());

  // Load saved nickname and generate random suggestion
  useEffect(() => {
    const generateNickname = () => {
      return uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: '',
        style: 'capital',
        length: 2
      });
    };
    
    const suggestion = generateNickname();
    setSuggestedNickname(suggestion);
    
    // Try to load saved nickname from cookie
    const savedNickname = getCookie('lastNickname');
    if (savedNickname && savedNickname.trim()) {
      setNickname(savedNickname);
      setUserHasTyped(true); // User has previously typed this nickname
    } else {
      setNickname(suggestion);
      setUserHasTyped(false); // Ensure we're in suggestion mode
    }
    setInitialized(true);
  }, []);

  // Set cursor to beginning whenever we're in suggestion mode
  useEffect(() => {
    if (!userHasTyped && inputRef.current && nickname === suggestedNickname) {
      inputRef.current.setSelectionRange(0, 0);
    }
  }, [userHasTyped, nickname, suggestedNickname]);

  const handleNicknameFocus = () => {
    if (!userHasTyped && inputRef.current) {
      // Ensure cursor is at beginning when focusing on suggestion
      inputRef.current.setSelectionRange(0, 0);
    }
  };

  const handleNicknameClick = () => {
    if (!userHasTyped && inputRef.current) {
      // Ensure cursor is at beginning when clicking on suggestion
      inputRef.current.setSelectionRange(0, 0);
    }
  };

  const handleNicknameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key to submit
    if (e.key === 'Enter') {
      handleGuestLogin();
      return;
    }
    
    // Handle Tab key to accept suggestion and move cursor to end
    if (!userHasTyped && e.key === 'Tab') {
      e.preventDefault(); // Prevent default tab behavior
      setUserHasTyped(true); // Mark as user-typed to change appearance
      // Move cursor to end of text
      if (inputRef.current) {
        const length = nickname.length;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(length, length);
            inputRef.current.focus();
          }
        }, 0);
      }
      return;
    }
    
    // Prevent backspace/delete from clearing suggestion when we're already in suggestion mode
    if (!userHasTyped && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault(); // Prevent the backspace from doing anything
      return;
    }
    
    if (!userHasTyped && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
      // User is starting to type a character - clear suggestion, character will be added by onChange
      setNickname("");
      setUserHasTyped(true);
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === "" && userHasTyped) {
      // User deleted everything, go back to suggestion
      // Batch the state updates to prevent flash
      React.startTransition(() => {
        setNickname(suggestedNickname);
        setUserHasTyped(false);
      });
      // Cursor positioning will be handled by the useEffect
    } else if (userHasTyped) {
      // User is continuing to type
      setNickname(value);
    } else if (value !== suggestedNickname) {
      // User is typing something different from suggestion
      setNickname(value);
      setUserHasTyped(true);
    }
    // If value === suggestedNickname and !userHasTyped, do nothing (stay in suggestion mode)
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      // Get user info and token from auth endpoint
      const authResponse = await fetch("/api/auth", {
        method: "POST",
      });
      const { user, token } = await authResponse.json();
      const socket = getSocket(token);
      socket.connect();


      const typedSocket = new TypedSocket(socket);

      // Join room after connection is established
      socket.on("connect", () => {
        typedSocket.emit("join-room", { name: user.room });
      });


      // Set up socket event handlers
      typedSocket.on("user-joined", ({ user }: { user: UserInfo }) => {
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      typedSocket.on("user-updated", ({ user }: { user: UserInfo }) => {
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      typedSocket.on("all-users", ({ users }: { users: Map<userId, UserInfo> }) => {
        setUsers(users);
      
      });

      typedSocket.on("terrain-config", ({ terrainConfig }: { terrainConfig: TerrainConfig }) => {
        setTerrainConfig(terrainConfig);
      });

      typedSocket.on("game-timer-info", ({ gameStartTime, gameDuration }: { gameStartTime: number; gameDuration: number }) => {
        // Batch game timer state updates together
        React.startTransition(() => {
          setGameStartTime(gameStartTime);
          setGameDuration(gameDuration);
        });
      });

      typedSocket.on("all-npc-groups", ({ npcGroups }: { npcGroups: NPCGroupsBiMap }) => {
        // Received all-npc-groups data
        
        // Create a new NPCGroupsBiMap instance from the received data
        const newNpcGroups = new NPCGroupsBiMap();
        
        // If npcGroups has the expected structure, copy the data
        if (npcGroups && typeof npcGroups === 'object') {
          // Check if it's already a proper NPCGroupsBiMap
          if (npcGroups instanceof NPCGroupsBiMap) {
            const processedNPCGroups = new NPCGroupsBiMap(npcGroups);
            setNPCGroups(processedNPCGroups);

          } else {
            // Handle case where it's deserialized as a plain object
            // Access the internal maps directly if they exist
            const map2Data = (npcGroups as Record<string, unknown>).map2;
            
            if (map2Data && Array.isArray(map2Data)) {
              // map2Data is likely serialized as an array of [key, value] pairs
              map2Data.forEach(([key, value]: [string, Record<string, unknown>]) => {
                newNpcGroups.setByNpcGroupId(key, value as unknown as NPCGroup);
              });
            } else if (map2Data && typeof map2Data === 'object') {
              // Or as an object
              Object.entries(map2Data).forEach(([key, value]) => {
                newNpcGroups.setByNpcGroupId(key, value as unknown as NPCGroup);
              });
            }
            
            // Check current users state - if empty, store as pending
              setNPCGroups(newNpcGroups);
          }
        } else {
          // Check current users state - if empty, store as pending
           setNPCGroups(newNpcGroups);
        }
      });

      typedSocket.on("user-left", ({ lastPosition, userId }: { lastPosition: Position; userId: string }) => {
        // Batch user removal and NPC group updates together
        React.startTransition(() => {
          setUsers((prev) => {
            const newUsers = new Map(prev);
            newUsers.delete(userId);
            return newUsers;
          });

          setNPCGroups((prev) => {
            const newNpcGroups = new NPCGroupsBiMap(prev);
            const captorGroup = newNpcGroups.getByUserId(userId);
            if (captorGroup) {
              const newCaptorGroup = new NPCGroup({
                ...captorGroup,
                captorId: undefined,
                position: lastPosition,
                phase: NPCPhase.IDLE,
              });
              newNpcGroups.setByNpcGroupId(captorGroup.id, newCaptorGroup);
            }

            return newNpcGroups;
          });
        });

      });

      typedSocket.on("all-paths", ({ paths }) => {
        setPaths(paths);
        pathsRef.current = paths;
      });

      typedSocket.on("npc-group-update", ({ npcGroup }: { npcGroup: NPCGroup }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          
          // Check if this update is for a thrown/returning NPC group being captured by local user
          const myUser = myUserRef.current;
          
          // Only log when it's my group with files (reduce spam)
          if (npcGroup.captorId === myUser?.id && npcGroup.fileNames.length > 0) {
            console.log('My NPC group update:', {
              npcGroupId: npcGroup.id.slice(0, 8),
              fileNamesLength: npcGroup.fileNames.length,
              hasPath: !!pathsRef.current.get(npcGroup.id),
              pathPhase: pathsRef.current.get(npcGroup.id)?.pathPhase
            });
          }
          
          // Interaction detection is now handled server-side
          
          if (npcGroup.fileNames.length == 0) {
            newNpcGroups.deleteByNpcGroupId(npcGroup.id);
          }
          else {
            newNpcGroups.setByNpcGroupId(npcGroup.id, npcGroup);
          }
          return newNpcGroups;
        });
      });

      typedSocket.on("npc-groups-bulk-update", ({ npcGroups }: { npcGroups: NPCGroup[] }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          npcGroups.forEach(npcGroup => {
            if (npcGroup.fileNames.length == 0) {
              newNpcGroups.deleteByNpcGroupId(npcGroup.id);
            } else {
              newNpcGroups.setByNpcGroupId(npcGroup.id, npcGroup);
            }
          });
          return newNpcGroups;
        });
      });



      typedSocket.on("path-deleted", ({ pathData }: { pathData: pathData }) => {
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(pathData.npcGroupId);
          pathsRef.current = newPaths; // Update ref too
          return newPaths;
        });
      });

      typedSocket.on("path-update", ({ pathData }: { pathData: pathData }) => {
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.set(pathData.npcGroupId, pathData);
          pathsRef.current = newPaths; // Update ref too
          return newPaths;
        });
        // Note: NPC group data should be sent separately via npc-group-update events
        // This path-update only contains the path data with npcGroupId reference
      });

      typedSocket.on("path-complete", ({ npcGroup }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          newNpcGroups.setByNpcGroupId(npcGroup.id, npcGroup);
          return newNpcGroups;
        });
        setPaths((prev) => {
          const newpaths = new Map(prev);
          newpaths.delete(npcGroup.id);
          pathsRef.current = newpaths; // Update ref too
          return newpaths;
        });
      });

      // Handle NPC group deletion with smoke animation
      typedSocket.on("npc-group-deleted", ({ npcGroupId, currentPosition, captorId, pathPhase, faceFileName }: { npcGroupId: string; currentPosition: { x: number; y: number; z: number }; captorId?: string; pathPhase: PathPhase; faceFileName?: string }) => {
        // Interaction detection is now handled server-side
        
        // Immediately delete the path to prevent NPC from reappearing
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(npcGroupId);
          pathsRef.current = newPaths; // Update ref too
          return newPaths;
        });
        
        // Update the NPC group's position to the current fleeing position before deletion
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          const npcGroup = newNpcGroups.getByNpcGroupId(npcGroupId);
          if (npcGroup) {
            const updatedNpcGroup = new NPCGroup({
              ...npcGroup,
              position: currentPosition
            });
            newNpcGroups.setByNpcGroupId(npcGroupId, updatedNpcGroup);
          }
          return newNpcGroups;
        });
        
        // First trigger smoke animation, then delete after animation completes
        const deletingNpcGroups = new Set(deletingNPCs);
        deletingNpcGroups.add(npcGroupId);
        setDeletingNPCs(deletingNpcGroups);
        
        // Delete NPC group after animation duration
        setTimeout(() => {
          setNPCGroups((prev) => {
            const newNpcGroups = new NPCGroupsBiMap(prev);
            newNpcGroups.deleteByNpcGroupId(npcGroupId);
            return newNpcGroups;
          });
          setDeletingNPCs((prev) => {
            const newSet = new Set(prev);
            newSet.delete(npcGroupId);
            return newSet;
          });
        }, 2000); // 2 second animation duration
      });

      // Handle NPC interactions with AI responses from server
      typedSocket.on("npc-interaction-with-response", ({ interaction, aiResponse }: { interaction: NPCInteraction; aiResponse: AIResponse }) => {
        if (interactionSetter) {
          
          interactionSetter(interaction, aiResponse);
        }
      });

      // Handle game over event - trigger cinematic sequence
      typedSocket.on("times-up", ({ finalScores }: { finalScores: FinalScores }) => {
        // Find the winner from final scores
        const winnerUserId = Object.entries(finalScores)
          .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0]?.[0];
        
        // Store final scores for the cinematic sequence to use
        (window as any).finalScores = finalScores;
        
        // Start cinematic sequence focused on winner
        const captureFunction = (window as any).captureGameScreenshot;
        if (captureFunction && winnerUserId) {
          captureFunction(winnerUserId);
        }
      });

      // Set initial user state with nickname (ensure it's never empty)
      // If user hasn't typed or the current nickname is the suggestion, use suggestion
      // Otherwise use what the user typed
      const finalNickname = (() => {
        const trimmedNickname = nickname.trim();
        if (!trimmedNickname || (!userHasTyped && nickname === suggestedNickname)) {
          return suggestedNickname;
        }
        return trimmedNickname;
      })();
      
      const userWithNickname = { ...user, nickname: finalNickname };
      
      // Save the nickname to cookie for future use
      setCookie('lastNickname', finalNickname);
      
      setMyUser(userWithNickname);
      myUserRef.current = userWithNickname;
      setUsers(new Map([[user.id, userWithNickname]]));
    } catch {
      // Login failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative p-4">
      <GeneratedNPCBackground />
      
      {/* Main content container with grid layout */}
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left third - empty for balance */}
          <div className="hidden lg:block"></div>
          
          {/* Center third - Main login card */}
          <div className="order-1 w-full max-w-md mx-auto lg:mx-0">
            <div className="backdrop-blur-lg bg-white/20 border border-white/30 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
              
              {/* Content */}
              <div className="relative z-10">
                <h1 className="text-4xl font-bold mb-4 text-center text-white drop-shadow-lg">
                  Nature vs NPC
                </h1>
                
                {/* Tagline */}
                <p className="text-lg text-center text-white/90 drop-shadow-md mb-8 font-medium">
                  Capture the most NPCs before time runs out!
                </p>
                
                <div className="mb-6">
                  <label htmlFor="nickname" className="block text-sm font-semibold text-black mb-3">
                    Choose your nickname
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={handleNicknameChange}
                      onKeyDown={handleNicknameKeyDown}
                      onFocus={handleNicknameFocus}
                      onClick={handleNicknameClick}
                      placeholder=""
                      className={`w-full px-4 py-4 bg-white/40 border border-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60 backdrop-blur-sm transition-all duration-200 placeholder-gray-600 text-lg caret-gray-800 ${
                        !initialized || !userHasTyped ? 'text-gray-300' : 'text-gray-900'
                      } hover:bg-white/50 focus:bg-white/60 selection:bg-blue-200/50`}
                      maxLength={20}
                    />
                    {/* Subtle inner glow effect */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-200 bg-gradient-to-r from-blue-400/20 to-purple-400/20 peer-focus:opacity-100"></div>
                  </div>
                </div>
                
                <button
                  onClick={handleGuestLogin}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-8 rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Joining...
                    </span>
                  ) : (
                    "Join Game"
                  )}
                </button>
              </div>
              
              {/* Floating elements for visual interest */}
              <div className="absolute -top-4 -left-4 w-20 h-20 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>
          
          {/* Right third - Controls and guide card */}
          <div className="order-2 lg:order-3 w-full max-w-md mx-auto lg:mx-0">
            <div className="backdrop-blur-lg bg-black/30 border border-white/20 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4 text-center drop-shadow-lg">Controls & Quick Guide</h3>
                
                {/* Controls */}
                <div className="flex flex-col space-y-2 mb-6">
                  <div className="flex items-center justify-center space-x-2 text-white">
                    <div className="flex space-x-1">
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">W</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">A</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">S</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">D</kbd>
                    </div>
                    <span className="text-white/80 font-medium">or</span>
                    <div className="flex space-x-1">
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white">←</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white">↑</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white">→</kbd>
                      <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white">↓</kbd>
                    </div>
                    <span className="text-sm text-white font-medium">= move</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-white">
                    <kbd className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">Space</kbd>
                    <span className="text-sm font-medium">= throw / charge throw</span>
                  </div>
                </div>
                
                {/* Quick Guide */}
                <div className="space-y-2 text-white/90 text-sm mb-6">
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-400 font-bold">1.</span>
                    <span>Move to capture NPC groups</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-400 font-bold">2.</span>
                    <span>Throw NPCs at other groups</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-400 font-bold">3.</span>
                    <span>Bigger groups absorb smaller ones</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-400 font-bold">4.</span>
                    <span>Most NPCs wins!</span>
                  </div>
                </div>
                
                {/* Detailed Guide button */}
                <button
                  onClick={() => setShowHowToPlay(true)}
                  className="w-full bg-white/20 border border-white/30 text-white py-3 px-6 rounded-2xl hover:bg-white/30 transition-all duration-200 text-lg font-medium backdrop-blur-sm drop-shadow-lg"
                >
                  Detailed Guide
                </button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="backdrop-blur-lg bg-black/40 border border-white/30 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent pointer-events-none"></div>
              
              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold text-white drop-shadow-lg">How to Play</h2>
                  <button
                    onClick={() => setShowHowToPlay(false)}
                    className="text-white/80 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all duration-200"
                  >
                    ×
                  </button>
                </div>
                
                {/* Game Instructions */}
                <div className="space-y-6 text-white/90">
                  {/* Basic Concept */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">🎯 Objective</h3>
                    <p className="leading-relaxed">
                      Each player controls an 'animal' character. Your goal is to capture the most NPCs before time runs out!
                    </p>
                  </div>
                  
                  {/* NPC Groups */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">👥 NPC Groups</h3>
                    <ul className="space-y-2 leading-relaxed">
                      <li>• NPCs appear in groups of varying sizes</li>
                      <li>• The top character of each group is what you see rendered</li>
                      <li>• A number above each group shows the total NPCs inside</li>
                      <li>• Larger groups appear bigger on screen</li>
                    </ul>
                  </div>
                  
                  {/* Capturing */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">🎣 Capturing NPCs</h3>
                    <ul className="space-y-2 leading-relaxed">
                      <li>• Move your animal close to NPC groups to capture them</li>
                      <li>• Captured groups will follow your animal around</li>
                      <li>• You can capture multiple groups to build a larger following</li>
                    </ul>
                  </div>
                  
                  {/* Throwing */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">🚀 Throwing NPCs</h3>
                    <ul className="space-y-2 leading-relaxed">
                      <li>• Press <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">Space</kbd> once to throw a single NPC</li>
                      <li>• Hold <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">Space</kbd> to charge up and throw multiple NPCs</li>
                      <li>• Thrown NPCs become a new group that travels in the direction you aimed</li>
                    </ul>
                  </div>
                  
                  {/* Collisions */}
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-3">💥 Group Collisions</h3>
                    <ul className="space-y-2 leading-relaxed">
                      <li>• When two NPC groups collide, the smaller one merges into the larger one</li>
                      <li>• If groups are the same size, they bounce off each other</li>
                      <li>• Use this mechanic strategically to build larger groups!</li>
                    </ul>
                  </div>
                  
                  {/* Controls reminder */}
                  <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-3 text-center drop-shadow-lg">Controls Reminder</h3>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-center space-x-2 text-white">
                        <div className="flex space-x-1">
                          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">W</kbd>
                          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">A</kbd>
                          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">S</kbd>
                          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">D</kbd>
                        </div>
                        <span className="text-white/80 font-medium">or arrow keys</span>
                        <span className="font-medium">= move around</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2 text-white">
                        <kbd className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">Space</kbd>
                        <span className="font-medium">= throw NPCs (tap or hold to charge)</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Close button */}
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setShowHowToPlay(false)}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-8 rounded-2xl hover:from-blue-600 hover:to-purple-700 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
