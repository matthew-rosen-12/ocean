// nature_v_npc/app/components/GuestLogin.tsx
import { useState } from "react";
import {
  NPCGroup,
  pathData,
  UserInfo,
  NPC,
  npcId,
  userId,
  NPCPhase,
} from "../utils/types";
import { DefaultMap } from "../utils/types";
import { getSocket } from "../socket";
import { deserialize, serialize } from "../utils/serializers";
import {
  addNPCToGroup,
  removeNPCFromGroup,
  updateNPCGroupsPreservingIdentity,
} from "../utils/npc-group-utils";
import { ServerTerrainConfig } from "../utils/terrain";

interface Props {
  setMyUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<userId, UserInfo>>>;
  setNPCs: React.Dispatch<React.SetStateAction<Map<npcId, NPC>>>;
  setPaths: React.Dispatch<React.SetStateAction<Map<npcId, pathData>>>;
  setNPCGroups: React.Dispatch<
    React.SetStateAction<DefaultMap<userId, NPCGroup>>
  >;
  setTerrainConfig: React.Dispatch<
    React.SetStateAction<ServerTerrainConfig | null>
  >;
}

export default function GuestLogin({
  setMyUser,
  setUsers,
  setNPCs,
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

      // Join room after connection is established
      socket.on("connect", () => {
        socket.emit("join-room", serialize({ name: user.room }));
      });

      socket.connect();

      // Set up socket event handlers
      socket.on("user-joined", (serializedData: string) => {
        const { user } = deserialize(serializedData);
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      socket.on("request-current-user", (serializedData: string) => {
        const { requestingSocketId } = deserialize(serializedData);
        socket.emit(
          "current-user-response",
          serialize({
            user,
            requestingSocketId,
          })
        );
      });

      socket.on("user-updated", (serializedData: string) => {
        const { user } = deserialize(serializedData);
        setUsers((prev) => new Map(prev).set(user.id, user));
      });

      socket.on("users-update", (serializedData: string) => {
        const { users } = deserialize(serializedData);
        setUsers(users);
      });

      socket.on("terrain-config", (serializedData: string) => {
        const { terrainConfig } = deserialize(serializedData);
        setTerrainConfig(terrainConfig);
      });

      socket.on("npcs-update", (serializedData: string) => {
        const { npcs } = deserialize(serializedData);
        setNPCs(npcs);
      });

      socket.on("user-left", (serializedData: string) => {
        const { lastPosition, userId } = deserialize(serializedData);
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(userId);
          return newUsers;
        });

        let npcsWithoutCaptor: npcId[] = [];

        setNPCGroups((prev) => {
          npcsWithoutCaptor = Array.from(prev.get(userId).npcIds);

          // Create a updates map to remove the user's group
          const updates = new Map();
          Array.from(prev.entries()).forEach(([id, group]) => {
            if (id !== userId) {
              updates.set(id, {
                captorId: group.captorId,
                npcIds: group.npcIds,
              });
            }
          });

          return updateNPCGroupsPreservingIdentity(prev, updates);
        });

        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          npcsWithoutCaptor.forEach((npcId) => {
            newNPCs.get(npcId)!.phase = NPCPhase.IDLE;
            newNPCs.get(npcId)!.position = lastPosition;
          });
          return newNPCs;
        });
      });

      socket.on("paths-update", (serializedData: string) => {
        const { paths } = deserialize(serializedData);
        setPaths(new Map(paths.map((t: pathData) => [t.npc.id, t])));
      });

      socket.on("npc-groups-update", (serializedData: string) => {
        const { groups } = deserialize(serializedData);

        setNPCGroups((prev) => {
          // Create updates map from the incoming groups
          const updates = new Map();
          for (const [id, group] of groups.entries()) {
            updates.set(id, { captorId: group.captorId, npcIds: group.npcIds });
          }

          // Use utility to preserve object identity where possible
          return updateNPCGroupsPreservingIdentity(prev, updates);
        });
      });

      socket.on("npc-update", (serializedData: string) => {
        const { npc } = deserialize(serializedData);
        setNPCs((prev) => new Map(prev).set(npc.id, npc));
      });

      socket.on("npc-captured", (serializedData: string) => {
        const { id, npc } = deserialize(serializedData);
        setNPCs((prev) => new Map(prev).set(npc.id, npc));
        setNPCGroups((prev) => {
          return addNPCToGroup(prev, id, npc.id);
        });
        setPaths((prev) => {
          const newPaths = new Map(prev);
          newPaths.delete(npc.id);
          return newPaths;
        });
      });

      socket.on("npc-path", (serializedData: string) => {
        const { pathData } = deserialize(serializedData);
        setPaths((prev) => new Map(prev).set(pathData.npc.id, pathData));
        setNPCs((prev) => new Map(prev).set(pathData.npc.id, pathData.npc));
        setNPCGroups((prev) => {
          return removeNPCFromGroup(prev, pathData.captorId, pathData.npc.id);
        });
      });

      socket.on("path-complete", (serializedData: string) => {
        const { npc } = deserialize(serializedData);
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(npc.id, npc);
          return newNPCs;
        });
        setPaths((prev) => {
          const newpaths = new Map(prev);
          newpaths.delete(npc.id);
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
