import React, { useState, useEffect, useRef } from "react";
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
import { NPCInteraction } from "shared/interaction-prompts";
import { AIResponse } from "shared/interaction-types";
import { getSocket } from "../socket";
import { ServerTerrainConfig } from "../utils/terrain";
import { TypedSocket } from "../utils/typed-socket";
import GeneratedNPCBackground from "./backgrounds/GeneratedNPCBackground";
import NicknameInput from "./NicknameInput";

// Reusable components
const ControlsSection = () => (
  <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-6">
    <h3 className="text-lg font-semibold text-white mb-3 text-center drop-shadow-lg">
      Controls
    </h3>
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-center space-x-2 text-white">
        <div className="flex space-x-1">
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            W
          </kbd>
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            A
          </kbd>
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            S
          </kbd>
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            D
          </kbd>
        </div>
        <span className="text-white/80 font-medium">or arrow keys</span>
        <span className="font-medium">= move around</span>
      </div>
      <div className="flex items-center justify-center space-x-2 text-white">
        <kbd className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
          Space
        </kbd>
        <span className="font-medium">= throw NPCs (hold to charge)</span>
      </div>
    </div>
  </div>
);

const GameInstructions = () => (
  <div className="space-y-6 text-white/90">
    {/* Basic Concept */}
    <div>
      <h3 className="text-xl font-semibold text-white mb-3">🎯 Objective</h3>
      <p className="leading-relaxed">
        Each player controls an animal. Your goal is to have the most NPCs captured when the 90-second timer runs out!
      </p>
    </div>

    <div>
      <h3 className="text-xl font-semibold text-white mb-3">🏃 Capturing NPCs</h3>
      <ul className="space-y-2 leading-relaxed">
        <li>• Move your animal over uncaptured NPCs to capture them</li>
        <li>• Your captured NPCs follow your animal around</li>
        <li>• The player with the most captured NPCs when time runs out wins!</li>
      </ul>
    </div>

    {/* Throwing */}
    <div>
      <h3 className="text-xl font-semibold text-white mb-3">🚀 Throwing NPCs</h3>
      <ul className="space-y-2 leading-relaxed">
        <li>
          • Press{" "}
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            Space
          </kbd>{" "}
          to throw one of your captured NPCs
        </li>
        <li>
          • Hold{" "}
          <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-white">
            Space
          </kbd>{" "}
          to charge up, then release to throw more NPCs
        </li>
        <li>• <strong>While thrown, these NPCs don't count toward your score</strong></li>
        <li>• If your thrown NPCs don't get captured by another group, they return to you (now counting towards your score again)</li>
        <li>• If a larger group captures your thrown NPCs, you lose them</li>
      </ul>
    </div>

    {/* Collisions */}
    <div>
      <h3 className="text-xl font-semibold text-white mb-3">💥 Group Interactions</h3>
      <ul className="space-y-2 leading-relaxed">
        <li>• <strong>Thrown vs Uncaptured:</strong> The smaller group gets captured by the larger group; if the groups are the same size then the thrown group captures the uncaptured group</li>
        <li>• <strong>Thrown vs Thrown:</strong> The smaller group gets captured by the larger group; if the groups are the same size then the groups bounce off each other</li>
        <li>• <strong>Thrown vs Captured:</strong> Some NPCs get freed from the captured group</li>
      </ul>
    </div>
  </div>
);


interface Props {
  setMyUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<userId, UserInfo>>>;
  setPaths: React.Dispatch<React.SetStateAction<Map<npcGroupId, pathData>>>;
  setNPCGroups: React.Dispatch<React.SetStateAction<NPCGroupsBiMap>>;
  setTerrainConfig: React.Dispatch<React.SetStateAction<ServerTerrainConfig | null>>;
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
  const [initialized, setInitialized] = useState(false);
  const [currentNickname, setCurrentNickname] = useState("Guest");
  const myUserRef = useRef<UserInfo | null>(null);
  const pathsRef = useRef<Map<npcGroupId, pathData>>(new Map());
  const mainCardRef = useRef<HTMLDivElement>(null);
  const guideCardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const desktopScrollContainerRef = useRef<HTMLDivElement>(null);
  const [desktopCanScrollUp, setDesktopCanScrollUp] = useState(false);
  const [desktopCanScrollDown, setDesktopCanScrollDown] = useState(false);

  // Initialize component
  useEffect(() => {
    setInitialized(true);
  }, []);

  // Match guide card height to main card height
  useEffect(() => {
    const matchHeights = () => {
      if (mainCardRef.current && guideCardRef.current) {
        const mainCardHeight = mainCardRef.current.offsetHeight;
        guideCardRef.current.style.height = `${mainCardHeight}px`;
      }
      
      // Recheck scroll indicators after height changes
      setTimeout(() => {
        checkScrollIndicators();
        checkDesktopScrollIndicators();
      }, 0);
    };

    // Match heights after component mounts and when window resizes
    matchHeights();
    window.addEventListener('resize', matchHeights);
    
    return () => window.removeEventListener('resize', matchHeights);
  }, [initialized]);

  // Check scroll indicators
  const checkScrollIndicators = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const canScrollUp = container.scrollTop > 0;
      const canScrollDown = container.scrollTop < (container.scrollHeight - container.clientHeight - 1);
      
      setCanScrollUp(canScrollUp);
      setCanScrollDown(canScrollDown);
    }
  };

  // Check desktop scroll indicators
  const checkDesktopScrollIndicators = () => {
    if (desktopScrollContainerRef.current) {
      const container = desktopScrollContainerRef.current;
      const canScrollUp = container.scrollTop > 0;
      const canScrollDown = container.scrollTop < (container.scrollHeight - container.clientHeight - 1);
      
      setDesktopCanScrollUp(canScrollUp);
      setDesktopCanScrollDown(canScrollDown);
    }
  };

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    const desktopContainer = desktopScrollContainerRef.current;
    
    if (container) {
      // Check initial state
      checkScrollIndicators();
      
      // Add scroll listener
      container.addEventListener('scroll', checkScrollIndicators);
    }
    
    if (desktopContainer) {
      // Check initial state
      checkDesktopScrollIndicators();
      
      // Add scroll listener
      desktopContainer.addEventListener('scroll', checkDesktopScrollIndicators);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollIndicators);
      }
      if (desktopContainer) {
        desktopContainer.removeEventListener('scroll', checkDesktopScrollIndicators);
      }
    };
  }, [initialized]);


  const handleNicknameSubmit = (finalNickname: string) => {
    handleGuestLogin(finalNickname);
  };

  const handleButtonClick = () => {
    handleGuestLogin(currentNickname);
  };

  const handleGuestLogin = async (finalNickname?: string) => {
    setLoading(true);
    try {
      // Get user info and token from auth endpoint
      const authResponse = await fetch("/api/auth", {
        method: "POST",
      });
      const { user: userWithoutNickname, token } = await authResponse.json();


      // Use the provided nickname or default
      const nickname = finalNickname || "";

      const user = { ...userWithoutNickname, nickname };

      const socket = getSocket(token);
      socket.connect();

      const typedSocket = new TypedSocket(socket);

      // Join room after connection is established
      socket.on("connect", () => {
        typedSocket.emit("join-room", { name: user.room });
        typedSocket.emit("update-user", { user: user });
      });

      // Set my user first with nickname
      setMyUser(user);
      myUserRef.current = user;
      setUsers(new Map([[user.id, user]]));

      // Set up socket event handlers
      typedSocket.on("user-joined", ({ user }: { user: UserInfo }) => {
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      typedSocket.on("user-updated", ({ user }: { user: UserInfo }) => {
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      typedSocket.on("all-users", ({ users }: { users: Map<userId, UserInfo> }) => {
        // Preserve local user's nickname when receiving all users
        if (myUserRef.current?.nickname) {
          const usersMap = new Map(users);
          const localUser = usersMap.get(myUserRef.current.id);
          if (localUser) {
            usersMap.set(myUserRef.current.id, { ...localUser, nickname: myUserRef.current.nickname });
          }
          setUsers(usersMap);
        } else {
          setUsers(users);
        }
      });

      // Handle batched room state to reduce frontend re-renders
      typedSocket.on("room-state", ({ terrainConfig, gameTimer, paths, npcGroups }: { 
        terrainConfig: TerrainConfig, 
        gameTimer: { gameStartTime: number; gameDuration: number } | null,
        paths: Map<npcGroupId, pathData> | null,
        npcGroups: NPCGroupsBiMap | null 
      }) => {
        // Batch all room state updates together using React 18 startTransition
        React.startTransition(() => {
          // Set terrain config
          if (terrainConfig) {
            setTerrainConfig(terrainConfig);
          }

          // Set game timer info
          if (gameTimer) {
            setGameStartTime(gameTimer.gameStartTime);
            setGameDuration(gameTimer.gameDuration);
          }

          // Set paths
          if (paths) {
            setPaths(paths);
            pathsRef.current = paths;
          }

          // Set NPC groups
          if (npcGroups) {
            const newNpcGroups = new NPCGroupsBiMap();

            if (npcGroups instanceof NPCGroupsBiMap) {
              const processedNPCGroups = new NPCGroupsBiMap(npcGroups);
              setNPCGroups(processedNPCGroups);
            } else {
              // Handle case where it's deserialized as a plain object
              const map2Data = (npcGroups as Record<string, unknown>).map2;

              if (map2Data && Array.isArray(map2Data)) {
                map2Data.forEach(([key, value]: [string, Record<string, unknown>]) => {
                  newNpcGroups.setByNpcGroupId(key, value as unknown as NPCGroup);
                });
              } else if (map2Data && typeof map2Data === "object") {
                Object.entries(map2Data).forEach(([key, value]) => {
                  newNpcGroups.setByNpcGroupId(key, value as unknown as NPCGroup);
                });
              }

              setNPCGroups(newNpcGroups);
            }
          }
        });
      });

      typedSocket.on("terrain-config", ({ terrainConfig }: { terrainConfig: TerrainConfig }) => {
        setTerrainConfig(terrainConfig);
      });

      typedSocket.on(
        "game-timer-info",
        ({ gameStartTime, gameDuration }: { gameStartTime: number; gameDuration: number }) => {
          // Batch game timer state updates together
          React.startTransition(() => {
            setGameStartTime(gameStartTime);
            setGameDuration(gameDuration);
          });
        }
      );

      typedSocket.on("all-npc-groups", ({ npcGroups }: { npcGroups: NPCGroupsBiMap }) => {
        // Received all-npc-groups data
        // Create a new NPCGroupsBiMap instance from the received data
        const newNpcGroups = new NPCGroupsBiMap();

        // If npcGroups has the expected structure, copy the data
        if (npcGroups && typeof npcGroups === "object") {
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
            } else if (map2Data && typeof map2Data === "object") {
              // Or as an object
              Object.entries(map2Data).forEach(([key, value]) => {
                newNpcGroups.setByNpcGroupId(key, value as unknown as NPCGroup);
              });
            }

            setNPCGroups(newNpcGroups);
          }
        } else {
          setNPCGroups(newNpcGroups);
        }
      });

      typedSocket.on(
        "user-left",
        ({ lastPosition, userId }: { lastPosition: Position; userId: string }) => {
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
        }
      );

      typedSocket.on("all-paths", ({ paths }) => {
        setPaths(paths);
        pathsRef.current = paths;
      });

      typedSocket.on("npc-group-update", ({ npcGroup }: { npcGroup: NPCGroup }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);


          // Interaction detection is now handled server-side

          if (npcGroup.fileNames.length == 0) {
            newNpcGroups.deleteByNpcGroupId(npcGroup.id);
          } else {
            newNpcGroups.setByNpcGroupId(npcGroup.id, npcGroup);
          }
          return newNpcGroups;
        });
      });

      typedSocket.on("npc-groups-bulk-update", ({ npcGroups }: { npcGroups: NPCGroup[] }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          npcGroups.forEach((npcGroup) => {
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
      typedSocket.on(
        "npc-group-deleted",
        ({
          npcGroupId,
          currentPosition,
          captorId,
          pathPhase,
          faceFileName,
        }: {
          npcGroupId: string;
          currentPosition: { x: number; y: number; z: number };
          captorId?: string;
          pathPhase: PathPhase;
          faceFileName?: string;
        }) => {
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
                position: currentPosition,
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
        }
      );

      // Handle NPC interactions with AI responses from server
      typedSocket.on(
        "npc-interaction-with-response",
        ({ interaction, aiResponse }: { interaction: NPCInteraction; aiResponse: AIResponse }) => {
          if (interactionSetter) {
            interactionSetter(interaction, aiResponse);
          }
        }
      );

      // Handle game over event - trigger cinematic sequence
      typedSocket.on("times-up", ({ finalScores }: { finalScores: FinalScores }) => {
        // Find the winner from final scores
        const winnerUserId = Object.entries(finalScores).sort(([, scoreA], [, scoreB]) => scoreB - scoreA)[0]?.[0];

        // Store final scores for the cinematic sequence to use
        (window as any).finalScores = finalScores;

        // Start cinematic sequence focused on winner
        const captureFunction = (window as any).captureGameScreenshot;
        if (captureFunction && winnerUserId) {
          captureFunction(winnerUserId);
        }
      });
    } catch {
      // Login failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative p-4">
      <GeneratedNPCBackground />

      {/* Desktop layout - absolute positioning for perfect centering */}
      <div className="hidden xl:block xl:fixed xl:inset-0 xl:w-full xl:h-screen">
        {/* Main login card - absolutely centered */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div
            className="
              w-[30rem]
              backdrop-blur-lg bg-white/20
              border border-white/30 rounded-3xl shadow-2xl
              p-8 relative overflow-hidden
            "
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

            {/* Content */}
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-4 text-center text-white drop-shadow-lg">Nature vs NPC</h1>

              {/* Tagline */}
              <p className="text-lg text-center text-white/90 drop-shadow-md mb-8 font-medium">
                Capture the most NPCs before time runs out!
              </p>

              <div className="mb-6">
                <label htmlFor="nickname-desktop" className="block text-sm font-semibold text-black mb-3">
                  Choose your nickname
                </label>
                <div className="relative">
                  <NicknameInput
                    onSubmit={handleNicknameSubmit}
                    loading={loading}
                    id="nickname-desktop"
                    onNicknameChange={setCurrentNickname}
                  />
                  <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-200 bg-gradient-to-r from-blue-400/20 to-purple-400/20 peer-focus:opacity-100"></div>
                </div>
              </div>

              <button
                onClick={handleButtonClick}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-8 rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
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
            <div
              className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl animate-pulse"
              style={{ animationDelay: "1s" }}
            ></div>
          </div>
        </div>

        {/* Controls card - fixed to right edge, full height */}
        <div className="fixed top-0 right-0 bottom-0 w-[30rem]">
          <div className="backdrop-blur-lg bg-black/30 shadow-2xl p-8 relative overflow-hidden h-full w-full">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10 h-full overflow-hidden">
              <div 
                ref={desktopScrollContainerRef}
                className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
              >
                <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-6 text-center">Game Guide</h2>
                
                <ControlsSection />
                <GameInstructions />
              </div>
              
              {/* Top fade indicator */}
              {desktopCanScrollUp && (
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
              )}
              
              {/* Bottom fade indicator */}
              {desktopCanScrollDown && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/20 to-transparent pointer-events-none"></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/tablet layout - stacked */}
      <div className="xl:hidden">
        {/* Main login card */}
        <div className="relative z-10 w-full max-w-md mx-4">
          <div ref={mainCardRef} className="backdrop-blur-lg bg-white/20 border border-white/30 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

            {/* Content */}
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-4 text-center text-white drop-shadow-lg">Nature vs NPC</h1>

              {/* Tagline */}
              <p className="text-lg text-center text-white/90 drop-shadow-md mb-8 font-medium">
                Capture the most NPCs before time runs out!
              </p>

              <div className="mb-6">
                <label htmlFor="nickname-mobile" className="block text-sm font-semibold text-black mb-3">
                  Choose your nickname
                </label>
                <div className="relative">
                  <NicknameInput
                    onSubmit={handleNicknameSubmit}
                    loading={loading}
                    id="nickname-mobile"
                    onNicknameChange={setCurrentNickname}
                  />
                  <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-200 bg-gradient-to-r from-blue-400/20 to-purple-400/20 peer-focus:opacity-100"></div>
                </div>
              </div>

              <button
                onClick={handleButtonClick}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-8 rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
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
            <div
              className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl animate-pulse"
              style={{ animationDelay: "1s" }}
            ></div>
          </div>
        </div>

        {/* Controls card below main card on mobile/tablet */}
        <div className="relative z-10 w-full max-w-md mx-4 mt-6">
          <div ref={guideCardRef} className="backdrop-blur-lg bg-black/30 border border-white/20 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

            <div className="relative z-10 h-full overflow-hidden">
              <div 
                ref={scrollContainerRef}
                className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
              >
                <h3 className="text-lg font-semibold text-white mb-4 text-center drop-shadow-lg">Game Guide</h3>
                
                <ControlsSection />
                <GameInstructions />
              </div>
              
              {/* Top fade indicator */}
              {canScrollUp && (
                <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
              )}
              
              {/* Bottom fade indicator */}
              {canScrollDown && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/20 to-transparent pointer-events-none"></div>
              )}
            </div>
          </div>
        </div>
        <div></div>
      </div>

    </div>
  );
}
