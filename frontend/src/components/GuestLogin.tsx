// nature_v_npc/app/components/GuestLogin.tsx
import { useState } from "react";
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
import { deserialize, serialize } from "../utils/serializers";
import {
  updateNPCGroupsPreservingIdentity,
} from "../utils/npc-group-utils";
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

      typedSocket.on("request-current-user", ({ requestingSocketId }: { requestingSocketId: string }) => {
        typedSocket.emit("current-user-response", {
            user,
            requestingSocketId,
          })
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
        setNPCGroups(npcGroups);
      });

      typedSocket.on("user-left", ({ lastPosition, userId }: { lastPosition: Position; userId: string }) => {
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(userId);
          return newUsers;
        });


        setNPCGroups((prev) => {
          const captorGroup = prev.getByUserId(userId);
          if (captorGroup) {
            const newCaptorGroup = {
              ...captorGroup,
              captorId: undefined,
              position: lastPosition,
              phase: NPCPhase.IDLE,
            };
            prev.setByNpcGroupId(captorGroup.id, newCaptorGroup);
          }


          return prev
        });

      });

      typedSocket.on("all-paths", ({ paths }) => {
        setPaths(paths);
      });

      typedSocket.on("npc-group-update", ({ npcGroup }: { npcGroup: NPCGroup }) => {
        setNPCGroups((prev) => {
          prev.setByNpcGroupId(npcGroup.id, npcGroup);
          return prev
        });
      });


      typedSocket.on("npc-group-captured", ({ id, npcGroup }) => {
        setNPCGroups((prev) => {
          prev.setByNpcGroupId(npcGroup.id, npcGroup);
          return prev;
        });
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(npcGroup.id);
          return newPaths;
        });
      });

      typedSocket.on("path-update", ({ pathData }: { pathData: pathData }) => {
        setPaths((prev) => {
          prev.set(pathData.npcGroup.id, pathData);
          return prev;
        });
        setNPCGroups((prev) => {
          prev.setByNpcGroupId(pathData.npcGroup.id, {
            ...pathData.npcGroup,
          });
         return prev;
        });
      });

      typedSocket.on("path-complete", ({ npcGroup }) => {
        setNPCGroups((prev) => {
          prev.setByNpcGroupId(npcGroup.id, npcGroup);
          return prev;
        });
        setPaths((prev) => {
          const newpaths = new Map(prev);
          newpaths.delete(npcGroup.id);
          return newpaths;
        });
      });

      // Set initial user state
      setMyUser(user);
      setUsers(new Map([[user.id, user]]));
    } catch (error) {
      console.error("Login error:", error);
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
