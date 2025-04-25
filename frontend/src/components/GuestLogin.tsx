// nature_v_npc/app/components/GuestLogin.tsx
import { useState } from "react";
import {
  NPCGroup,
  throwData,
  UserInfo,
  NPC,
  npcId,
  userId,
} from "../utils/types";
import { DefaultMap } from "../utils/types";
import { getSocket } from "../socket";

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
      socket.connect();

      // Join room after connection is established
      socket.on("connect", () => {
        socket.emit("join-room", { name: user.room });
      });

      // Set up socket event handlers
      socket.on("user-joined", (newUser: UserInfo) => {
        setUsers((prev) => new Map(prev).set(newUser.id, newUser));
      });

      socket.on("request-current-user", (requestingSocketId: string) => {
        socket.emit("current-user-response", {
          user,
          requestingSocketId,
        });
      });

      socket.on("user-updated", (data: { updatedUser: UserInfo }) => {
        setUsers((prev) =>
          new Map(prev).set(data.updatedUser.id, data.updatedUser)
        );
      });

      socket.on("users-update", (data: { users: [string, UserInfo][] }) => {
        setUsers(new Map(data.users));
      });

      socket.on("npcs-update", (data: { npcs: [string, NPC][] }) => {
        setNPCs(new Map(data.npcs));
      });

      socket.on("user-left", (data: { userId: string }) => {
        console.log("user-left", data);
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(data.userId);
          return newUsers;
        });
      });

      socket.on("throws-update", (data: { throws: [string, throwData][] }) => {
        setThrows(new Map(data.throws));
      });

      socket.on(
        "npc-groups-update",
        (data: { groups: [string, NPCGroup][] }) => {
          const defaultMap = new DefaultMap<string, NPCGroup>((id: string) => ({
            npcIds: new Set<string>(),
            captorId: id,
          }));
          data.groups.forEach(([id, group]) =>
            defaultMap.set(id, {
              npcIds: new Set<string>(group.npcIds),
              captorId: group.captorId,
            })
          );
          setNPCGroups(defaultMap);
        }
      );

      socket.on("npc-update", (data: { npc: NPC }) => {
        setNPCs((prev) => new Map(prev).set(data.npc.id, data.npc));
      });

      socket.on("npc-thrown", (data: { throw: throwData }) => {
        setThrows((prev) => new Map(prev).set(data.throw.npc.id, data.throw));
        setNPCs((prev) => new Map(prev).set(data.throw.npc.id, data.throw.npc));
        setNPCGroups((prev) => {
          prev.get(data.throw.throwerId).npcIds.delete(data.throw.npc.id);
          return prev;
        });
      });

      socket.on("throw-complete", (data: { npc: NPC }) => {
        setThrows((prev) => {
          const newThrows = new Map(prev);
          newThrows.delete(data.npc.id);
          return newThrows;
        });
        setNPCs((prev) => new Map(prev).set(data.npc.id, data.npc));
      });

      // Set initial user state
      setMyUser(user);
      setUsers(new Map([[user.id, user]]));

      // Fetch initial game state
      // Request initial game state via socket
      const [npcs, throws, npcGroups] = await Promise.all([
        new Promise<[string, NPC][]>((resolve) => {
          console.log("getting npcs");
          socket.once("npcs-data", (data: { npcs: [string, NPC][] }) => {
            console.log("npcs-data", data);
            resolve(data.npcs);
          });
          socket.emit("get-npcs", { room: user.room });
        }),
        new Promise<[string, throwData][]>((resolve) => {
          socket.emit("get-throws", { room: user.room });
          socket.once(
            "throws-data",
            (data: { throws: [string, throwData][] }) => {
              resolve(data.throws);
            }
          );
        }),
        new Promise<[string, NPCGroup][]>((resolve) => {
          socket.emit("get-npc-groups", { room: user.room });
          socket.once(
            "npc-groups-data",
            (data: { groups: [string, NPCGroup][] }) => {
              resolve(data.groups);
            }
          );
        }),
      ]);

      setNPCs(new Map(npcs));
      setThrows(new Map(throws));
      const defaultMap = new DefaultMap<string, NPCGroup>((id: string) => ({
        npcIds: new Set<string>(),
        captorId: id,
      }));
      npcGroups.forEach(([id, group]) =>
        defaultMap.set(id, {
          npcIds: new Set<string>(group.npcIds),
          captorId: group.captorId,
        })
      );
      setNPCGroups(defaultMap);
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
