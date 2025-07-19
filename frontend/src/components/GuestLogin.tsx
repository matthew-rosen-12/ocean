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
        setGameStartTime(gameStartTime);
        setGameDuration(gameDuration);
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
    <div className="flex flex-col items-center justify-center min-h-screen relative">
      <GeneratedNPCBackground />
      
      {/* Main login card with glassmorphism effect */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-lg bg-white/20 border border-white/30 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          
          {/* Content */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-8 text-center text-white drop-shadow-lg">
              Nature vs NPC
            </h1>
            
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
        </div>
        
        {/* Floating elements for visual interest */}
        <div className="absolute -top-4 -left-4 w-20 h-20 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}
