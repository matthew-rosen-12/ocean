// nature_v_npc/app/components/GuestLogin.tsx
import { useState, useEffect, useRef } from "react";
import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';
import {
  NPCGroup,
  pathData,
  UserInfo,
  npcGroupId,
  userId,
  NPCPhase,
  NPCGroupsBiMap,
  Position,
  TerrainConfig,
} from "shared/types";
import { getSocket } from "../socket";
import { ServerTerrainConfig } from "../utils/terrain";
import { TypedSocket } from "../utils/typed-socket";

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
}

export default function GuestLogin({
  setMyUser,
  setUsers,
  setPaths,
  setNPCGroups,
  setTerrainConfig,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [suggestedNickname, setSuggestedNickname] = useState("");
  const [userHasTyped, setUserHasTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate random nickname suggestion
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
    setNickname(suggestion);
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
      setNickname(suggestedNickname);
      setUserHasTyped(false);
      // Cursor positioning will be handled by the useEffect
    } else if (userHasTyped || value !== suggestedNickname) {
      // User is typing or has typed something
      setNickname(value);
      if (!userHasTyped) {
        setUserHasTyped(true);
      }
    }
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

      typedSocket.on("all-npc-groups", ({ npcGroups }: { npcGroups: NPCGroupsBiMap }) => {
        // Received all-npc-groups data
        
        // Create a new NPCGroupsBiMap instance from the received data
        const newNpcGroups = new NPCGroupsBiMap();
        
        // If npcGroups has the expected structure, copy the data
        if (npcGroups && typeof npcGroups === 'object') {
          // Check if it's already a proper NPCGroupsBiMap
          if (npcGroups instanceof NPCGroupsBiMap) {
            setNPCGroups(new NPCGroupsBiMap(npcGroups));
          } else {
            // Handle case where it's deserialized as a plain object
            // Access the internal maps directly if they exist
            const _map1Data = (npcGroups as Record<string, unknown>).map1;
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
            setNPCGroups(newNpcGroups);
          }
        } else {
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
      });

      typedSocket.on("npc-group-update", ({ npcGroup }: { npcGroup: NPCGroup }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          if (npcGroup.fileNames.length == 0) {
            newNpcGroups.deleteByNpcGroupId(npcGroup.id);
          }
          else {
            newNpcGroups.setByNpcGroupId(npcGroup.id, npcGroup);
          }
          return newNpcGroups;
        });
      });


      typedSocket.on("npc-group-captured", ({ capturedNPCGroupId, updatedNpcGroup }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          newNpcGroups.deleteByNpcGroupId(capturedNPCGroupId);
          newNpcGroups.setByNpcGroupId(updatedNpcGroup.id, updatedNpcGroup);
          return newNpcGroups;
        });
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(capturedNPCGroupId);
          return newPaths;
        });
      });

      typedSocket.on("npc-group-pop", ({ npcGroupId }: { npcGroupId: npcGroupId }) => {
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          const npcGroup = newNpcGroups.getByNpcGroupId(npcGroupId);
          if (npcGroup && npcGroup.fileNames.length > 1) {
            const updatedGroup = {
              ...npcGroup,
              fileNames: npcGroup.fileNames.slice(0, -1),  // Remove last element (pop)
              faceFileName: npcGroup.fileNames[npcGroup.fileNames.length - 2] // New face is second-to-last
            };
            newNpcGroups.setByNpcGroupId(npcGroupId, updatedGroup);
          } else if (npcGroup?.captorId) {
            // Remove the group entirely if it would be empty
            newNpcGroups.deleteByUserId(npcGroup.captorId);
          }
          return newNpcGroups;
        });
      });

      typedSocket.on("path-update", ({ pathData }: { pathData: pathData }) => {
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.set(pathData.npcGroup.id, pathData);
          return newPaths;
        });
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          newNpcGroups.setByNpcGroupId(pathData.npcGroup.id, new NPCGroup({
            ...pathData.npcGroup,
          }));
          return newNpcGroups;
        });
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
          return newpaths;
        });
      });

      typedSocket.on("path-absorbed", ({ pathData }: { pathData: pathData }) => {
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(pathData.npcGroup.id);
          return newPaths;
        });
        setNPCGroups((prev) => {
          const newNpcGroups = new NPCGroupsBiMap(prev);
          newNpcGroups.deleteByNpcGroupId(pathData.npcGroup.id);
          return newNpcGroups;
        });
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
      setMyUser(userWithNickname);
      setUsers(new Map([[user.id, userWithNickname]]));
    } catch {
      // Login failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center text-black">
          Welcome to Dolphin and Wolf
        </h1>
        <div className="mb-4">
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
            Nickname
          </label>
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
            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder-gray-500 ${
              !userHasTyped ? 'text-gray-400' : 'text-gray-900'
            }`}
            maxLength={20}
          />
        </div>
        <button
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-4 px-8 rounded-lg hover:bg-blue-600 disabled:opacity-50 text-xl h-16"
        >
          {loading ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}
