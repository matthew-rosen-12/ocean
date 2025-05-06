// nature_v_npc/app/components/GuestLogin.tsx
import { useState } from "react";
import {
  NPCGroup,
  throwData,
  UserInfo,
  NPC,
  npcId,
  userId,
  NPCPhase,
} from "../utils/types";
import { DefaultMap } from "../utils/types";
import { getSocket } from "../socket";
import { deserialize, serialize } from "../utils/serializers";

interface Props {
  setMyUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<userId, UserInfo>>>;
  setNPCs: React.Dispatch<React.SetStateAction<Map<npcId, NPC>>>;
  setThrows: React.Dispatch<React.SetStateAction<Map<npcId, throwData>>>;
  setNPCGroups: React.Dispatch<
    React.SetStateAction<DefaultMap<userId, NPCGroup>>
  >;
}

export default function GuestLogin({
  setMyUser,
  setUsers,
  setNPCs,
  setThrows,
  setNPCGroups,
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
          const newNPCGroups = new DefaultMap<userId, NPCGroup>(
            (id: userId) => ({
              npcIds: new Set<npcId>(),
              captorId: id,
            })
          );
          Array.from(prev.entries()).forEach(([id, group]) => {
            newNPCGroups.set(id, group);
          });
          npcsWithoutCaptor = Array.from(prev.get(userId).npcIds);
          newNPCGroups.delete(userId);
          return newNPCGroups;
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

      socket.on("throws-update", (serializedData: string) => {
        const { throws } = deserialize(serializedData);
        setThrows(new Map(throws.map((t: throwData) => [t.npc.id, t])));
      });

      socket.on("npc-groups-update", (serializedData: string) => {
        const { groups } = deserialize(serializedData);
        const defaultMap = new DefaultMap<userId, NPCGroup>((id: userId) => ({
          npcIds: new Set<string>(),
          captorId: id,
        }));

        //for each key value of groups, set the key and value in the defaultMap
        for (const [id, group] of groups.entries()) {
          defaultMap.set(id, group);
        }

        setNPCGroups(defaultMap);
      });

      socket.on("npc-update", (serializedData: string) => {
        const { npc } = deserialize(serializedData);
        setNPCs((prev) => new Map(prev).set(npc.id, npc));
      });

      socket.on("npc-captured", (serializedData: string) => {
        const { id, npc } = deserialize(serializedData);
        setNPCs((prev) => new Map(prev).set(npc.id, npc));
        setNPCGroups((prev) => {
          const newNPCGroups = new DefaultMap<userId, NPCGroup>(
            (id: userId) => ({
              npcIds: new Set<npcId>(),
              captorId: id,
            })
          );
          Array.from(prev.entries()).forEach(([id, group]) => {
            newNPCGroups.set(id, group);
          });
          newNPCGroups.get(id).npcIds.add(npc.id);
          return newNPCGroups;
        });
      });

      socket.on("npc-thrown", (serializedData: string) => {
        const { throwData } = deserialize(serializedData);
        setThrows((prev) => new Map(prev).set(throwData.npc.id, throwData));
        setNPCs((prev) => new Map(prev).set(throwData.npc.id, throwData.npc));
        setNPCGroups((prev) => {
          const newNPCGroups = new DefaultMap<userId, NPCGroup>(
            (id: userId) => ({
              npcIds: new Set<npcId>(),
              captorId: id,
            })
          );
          Array.from(prev.entries()).forEach(([id, group]) => {
            newNPCGroups.set(id, group);
          });
          newNPCGroups.get(throwData.throwerId).npcIds.delete(throwData.npc.id);
          return newNPCGroups;
        });
      });

      socket.on("throw-complete", (serializedData: string) => {
        const { npc } = deserialize(serializedData);
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(npc.id, npc);
          return newNPCs;
        });
        setThrows((prev) => {
          const newThrows = new Map(prev);
          newThrows.delete(npc.id);
          return newThrows;
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
