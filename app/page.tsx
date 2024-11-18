"use client";
import GuestLogin from "./components/GuestLogin";
import Scene from "./components/Scene";
import { UserInfo } from "./utils/types/user";
import { useState } from "react";

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());

  if (!user) {
    return <GuestLogin setUser={setUser} setUsers={setUsers} />;
  }

  return (
    <div className="p-4">
      <h1>Welcome, {user.animal}!</h1>
      <Scene users={users} />
    </div>
  );
}
