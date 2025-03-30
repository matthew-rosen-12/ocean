// ocean/app/components/GuestLogin.tsx
import { useState } from "react";
import { Member, UserInfo } from "../utils/types";
import type { Members } from "pusher-js";
import { getChannel } from "../utils/pusher-instance";
import { NPC } from "../utils/types";

interface Props {
  setUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<string, UserInfo>>>;
  setNPCs: React.Dispatch<React.SetStateAction<Map<string, NPC>>>;
}

function MemberToUser(member: Member) {
  return {
    id: member.id,
    animal: member.info.animal,
    channel_name: member.info.channel_name,
    position: member.info.position,
    direction: member.info.direction,
    npcGroup: member.info.npcGroup,
  };
}

export default function GuestLogin({ setUser, setUsers, setNPCs }: Props) {
  let currentUser: UserInfo | null = null;
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/find-room");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const channel_name = data.channel_name;

      const channel = getChannel(channel_name);

      channel.bind("pusher:subscription_succeeded", (members: Members) => {
        const usersMap = new Map();
        const user = MemberToUser(members.me);
        setUser(user);
        currentUser = user;
        usersMap.set(members.me.id, MemberToUser(members.me));
        setUsers(usersMap);

        // First fetch all NPCs
        fetch(`/api/npc?channel=${channel_name}`)
          .then((res) => res.json())
          .then((data) => {
            const npcMap: Map<string, NPC> = new Map();
            data.npcs.forEach((npc: NPC) => {
              npcMap.set(npc.id, npc);
            });

            setNPCs(npcMap);

            // After getting NPCs, request state from existing players
            channel.trigger("client-request-state", {
              id: members.me.id,
            });
            setLoading(false);
          })
          .catch((err) => console.error("Error fetching NPCs:", err));
      });

      // Handle state requests from new players
      channel.bind("client-request-state", () => {
        if (currentUser) {
          channel.trigger("client-send-state", {
            id: currentUser.id,
            info: currentUser,
          });
        }
      });

      // Handle received states
      channel.bind(
        "client-send-state",
        (data: { id: string; info: UserInfo }) => {
          // Add the user to our users map
          setUsers((prev) => {
            const newUsers = new Map(prev);
            newUsers.set(data.id, data.info);
            return newUsers;
          });

          // Remove any NPCs this user has captured from our global NPC list
          if (data.info.npcGroup?.npcs && data.info.npcGroup.npcs.length > 0) {
            setNPCs((prev) => {
              const newNPCs = new Map(prev);
              data.info?.npcGroup?.npcs.forEach((npc: NPC) => {
                newNPCs.delete(npc.id);
              });
              return newNPCs;
            });
          }
        }
      );

      channel.bind("pusher:member_added", (member: Member) => {
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.set(member.id, MemberToUser(member));
          return newUsers;
        });
      });

      channel.bind("pusher:member_removed", (member: Member) => {
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.delete(member.id);
          return newUsers;
        });
      });

      channel.bind("client-user-modified", (member: Member) => {
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.set(member.id, MemberToUser(member));
          return newUsers;
        });
      });

      // Add this with the other channel.bind statements
      channel.bind(
        "client-npc-captured",
        (data: { npcId: string; captorId: string; npcData: NPC }) => {
          // Remove the NPC from the general pool
          setNPCs((prevNPCs) => {
            const newNPCs = new Map(prevNPCs);
            newNPCs.delete(data.npcId);
            return newNPCs;
          });
        }
      );
    } catch (error) {
      console.error("Login error:", error);
    } finally {
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
