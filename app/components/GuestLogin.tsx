// ocean/app/components/GuestLogin.tsx
import { useState } from "react";
import {
  Member,
  NPCGroup,
  npcId,
  throwData,
  userId,
  UserInfo,
} from "../utils/types";
import type { Channel, Members } from "pusher-js";
import { getChannel } from "../utils/pusher-instance";
import { NPC } from "../utils/types";
import { DefaultMap } from "../utils/types";

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

        let responsesToAwait = members.count - 1;
        let responseTimeout: NodeJS.Timeout | null = null;

        const fetchNPCs = () => {
          if (responseTimeout) {
            clearTimeout(responseTimeout);
            responseTimeout = null;
          }

          fetch(`/api/npc?channel=${channel_name}`)
            .then((res) => res.json())
            .then((data) => {
              // Convert the array back to a Map
              const npcMap = new Map<npcId, NPC>(data);
              setNPCs(npcMap);
              fetchActiveThrows();
            })
            .catch((err) => {
              console.error("Error fetching NPCs:", err);
              setLoading(false);
            });
        };

        const fetchActiveThrows = () => {
          fetch(`/api/npc/throws?channel=${channel_name}`)
            .then((res) => res.json())
            .then((data) => {
              // Process active throws
              const { activeThrows } = data;
              const throwsMap = new Map<string, throwData>();

              activeThrows.forEach((activeThrow: throwData) => {
                throwsMap.set(activeThrow.npc.id, activeThrow);
              });
              setThrows(throwsMap);

              // Add this call to fetch groups after fetching throws
              fetchNPCGroups();
            })
            .catch((err) => {
              console.error("Error fetching active throws:", err);
              setLoading(false);
            });
        };

        // Add this new function to fetch NPC groups
        const fetchNPCGroups = () => {
          fetch(`/api/npc/capture?channel=${channel_name}`)
            .then((res) => res.json())
            .then((data) => {
              // Process NPC groups
              const { npcGroups } = data;
              const groupsMap = new DefaultMap<userId, NPCGroup>((id) => ({
                npcIds: new Set<npcId>(),
                captorId: id,
              }));

              // Convert array data back to our DefaultMap with Sets
              npcGroups.forEach(
                (group: { id: userId; npcIds: npcId[]; captorId: userId }) => {
                  groupsMap.set(group.id, {
                    npcIds: new Set(group.npcIds),
                    captorId: group.captorId,
                  });
                }
              );

              console.log("Fetched NPC groups:", groupsMap);
              setNPCGroups(groupsMap);
              setLoading(false);
            })
            .catch((err) => {
              console.error("Error fetching NPC groups:", err);
              setLoading(false);
            });
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

      channel.bind("npc-update", (data: { npc: NPC }) => {
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(data.npc.id, data.npc);
          return newNPCs;
        });
        console.log("NPC updated:", data.npc);
      });

      channel.bind("npc-thrown", (data: { throw: throwData }) => {
        setThrows((prev) => {
          const newThrows = new Map(prev);
          newThrows.set(data.throw.npc.id, data.throw);
          return newThrows;
        });
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(data.throw.npc.id, data.throw.npc);
          return newNPCs;
        });
        setNPCGroups((prev) => {
          prev.get(data.throw.throwerId).npcIds.delete(data.throw.npc.id);
          return prev;
        });
      });

      channel.bind("npc-captured", (data: { id: userId; npc: NPC }) => {
        setNPCGroups((prev) => {
          // only push if not already in npcIds
          prev.get(data.id).npcIds.add(data.npc.id);
          return prev;
        });
      });

      channel.bind("throw-complete", (data: { throw: throwData }) => {
        setThrows((prev) => {
          const newThrows = new Map(prev);
          newThrows.delete(data.throw.npc.id);
          return newThrows;
        });
        setNPCs((prev) => {
          const newNPCs = new Map(prev);
          newNPCs.set(data.throw.npc.id, data.throw.npc);
          return newNPCs;
        });
      });
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      // Clean up all event listeners when component unmounts or channel changes
      return () => {
        if (!channel) return;
        channel.unbind_all();
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
