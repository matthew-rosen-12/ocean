// components/GuestLogin.tsx
import { useState } from "react";
import { UserInfo } from "../utils/types/user";
import type { Members } from "pusher-js";
import { getPusherInstance } from "../utils/pusher-instance";

interface Props {
  setUser: React.Dispatch<React.SetStateAction<UserInfo | null>>;
  setUsers: React.Dispatch<React.SetStateAction<Map<string, UserInfo>>>;
}

type Member = {
  id: string;
  info: UserInfo;
};

function MemberToUser(member: Member) {
  return {
    id: member.id,
    animal: member.info.animal,
    position: member.info.position,
    createdAt: member.info.createdAt,
  };
}

export default function GuestLogin({ setUser, setUsers }: Props) {
  const [loading, setLoading] = useState(false);
  const pusher = getPusherInstance();

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/find-room");
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      const channel_name = data.channel_name;
      console.log("DEBUG1");
      console.log(channel_name);

      const channel = pusher.subscribe(channel_name);

      channel.bind("pusher:subscription_succeeded", (members: Members) => {
        const usersMap = new Map();

        members.each((member: Member) => {
          usersMap.set(member.id, MemberToUser(member));
        });
        const user = MemberToUser(members.me);
        setUsers(usersMap);
        setUser(user);
      });

      // Handle member additions
      channel.bind("pusher:member_added", (member: Member) => {
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.set(member.id, MemberToUser(member));
          return newUsers;
        });
      });

      // Handle member removals
      channel.bind("pusher:member_removed", (member: Member) => {
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.delete(member.id);
          return newUsers;
        });
      });
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Welcome to Chat</h1>
        <p className="mb-6 text-gray-600 text-center">
          Click below to join as a guest and get your animal avatar!
        </p>
        <button
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join as Guest"}
        </button>
      </div>
    </div>
  );
}
