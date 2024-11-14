// components/GuestLogin.tsx
import { useState } from "react";
import { GuestUser } from "../types/user";
import { getPusherInstance } from "../utils/pusher-client";
import type { Members } from "pusher-js";

interface Props {
  onLogin: (user: GuestUser) => void;
}

export default function GuestLogin({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      // Initialize Pusher
      const pusher = getPusherInstance();

      // Connect to presence channel
      const channel = pusher.subscribe("presence-chat");

      channel.bind("pusher:subscription_succeeded", (members: Members) => {
        const response = members.me;
        const user: GuestUser = {
          id: response.id,
          animal: response.info.animal,
          createdAt: new Date(),
        };
        onLogin(user);
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
