// ocean/app/components/GuestLogin.tsx
import { useState } from "react";
import { Member, UserInfo } from "../utils/types";
import type { Channel, Members } from "pusher-js";
import { getChannel } from "../utils/pusher-instance";
import { NPC } from "../utils/types";

interface Props {
  setMyUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<string, UserInfo>>>;
  setNPCs: React.Dispatch<React.SetStateAction<Map<string, NPC>>>;
}

export default function GuestLogin({ setMyUser, setUsers, setNPCs }: Props) {
  let currentUser: UserInfo | null = null;
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/find-room");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const channel_name = data.channel_name;

      const channel = getChannel(channel_name);
      setChannel(channel);

      channel.bind("pusher:subscription_succeeded", (members: Members) => {
        const usersMap = new Map();
        const user = members.me.info as UserInfo;
        setMyUser(user);
        currentUser = user;
        usersMap.set(user.id, user);
        setUsers(usersMap);

        const capturedNpcIds = new Set<string>();
        let responsesToAwait = members.count - 1;
        let responseTimeout: NodeJS.Timeout | null = null;

        const fetchNPCs = () => {
          if (responseTimeout) {
            clearTimeout(responseTimeout);
            responseTimeout = null;
          }

          // Fetch NPCs after we've received all expected responses
          fetch(`/api/npc?channel=${channel_name}`)
            .then((res) => res.json())
            .then((data) => {
              const npcMap: Map<string, NPC> = new Map();

              // Only add NPCs that haven't been captured
              data.npcs.forEach((npc: NPC) => {
                if (!capturedNpcIds.has(npc.id)) {
                  npcMap.set(npc.id, npc);
                }
              });

              setNPCs(npcMap);
              setLoading(false);
            })
            .catch((err) => console.error("Error fetching NPCs:", err));
        };

        if (responsesToAwait === 0) {
          fetchNPCs();
          return;
        }

        const stateReceivedHandler = (data: { id: string; info: UserInfo }) => {
          // Add the user to our users map
          setUsers((prev) => {
            const newUsers = new Map(prev);
            newUsers.set(data.id, data.info);
            return newUsers;
          });

          // Track captured NPCs from this user
          if (data.info.npcGroup?.npcs) {
            data.info.npcGroup.npcs.forEach((npc) => {
              capturedNpcIds.add(npc.id);
            });
          }

          // Track responses
          responsesToAwait--;

          // If we've received responses from all members, proceed
          if (responsesToAwait === 0) {
            channel.unbind("client-send-state", stateReceivedHandler);
            fetchNPCs();
          }
        };

        // Bind the handler
        channel.bind("client-send-state", stateReceivedHandler);

        // Request state from all existing members
        channel.trigger("client-request-state", {
          id: members.me.id,
        });

        // Set a timeout in case some members don't respond
        responseTimeout = setTimeout(() => {
          console.log(
            `Timeout waiting for responses. Still waiting for ${responsesToAwait} responses`
          );
          channel.unbind("client-send-state", stateReceivedHandler);
          fetchNPCs();
        }, 3000); // 3 second timeout
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
          newUsers.set(member.id, member.info as UserInfo);
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
          newUsers.set(member.id, member.info as UserInfo);
          return newUsers;
        });
      });

      // Replace the separate handlers with a single npc-update handler
      channel.bind("npc-update", (data: { npc: NPC }) => {
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(data.npc.id, data.npc);
          return newNPCs;
        });
      });

      // Add handler for when NPCs are captured by users
      channel.bind(
        "npc-captured",
        (data: { npcId: string; captorId: string }) => {
          setNPCs((prev) => {
            const newNPCs = new Map(prev);
            newNPCs.delete(data.npcId);
            return newNPCs;
          });
        }
      );
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      // Clean up all event listeners when component unmounts or channel changes
      return () => {
        if (!channel) return;
        channel.unbind("npc-update");
        channel.unbind("npc-captured");
        channel.unbind("pusher:subscription_succeeded");
        channel.unbind("client-request-state");
        channel.unbind("client-send-state");
        channel.unbind("pusher:member_added");
        channel.unbind("pusher:member_removed");
        channel.unbind("client-user-modified");
      };
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
