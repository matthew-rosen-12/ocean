"use client";
import GuestLogin from "./components/GuestLogin";
import Box from "./components/Scene";
import { GuestUser } from "./types/user";
import { useState } from "react";

export default function Home() {
  const [user, setUser] = useState<GuestUser | null>(null);

  const handleLogin = (loggedInUser: GuestUser) => {
    setUser(loggedInUser);
  };

  if (!user) {
    return <GuestLogin onLogin={handleLogin} />;
  }

  return (
    <div className="p-4">
      <h1>Welcome, {user.animal}!</h1>
      <Box />
    </div>
  );
}
