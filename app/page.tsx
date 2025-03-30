// ocean/app/page.tsx
"use client";
import GuestLogin from "./components/GuestLogin";
import Scene from "./components/Scene";
import { UserInfo } from "./utils/types";
import { useState } from "react";
import { ANIMAL_FACTS } from "@/public/facts";
import { NPC } from "./utils/types";

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());
  // Add state for NPCs
  const [npcs, setNPCs] = useState<Map<string, NPC>>(new Map());

  if (!user) {
    return (
      <GuestLogin setUser={setUser} setUsers={setUsers} setNPCs={setNPCs} />
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Scene users={users} myUser={user} npcs={npcs} />

      {/* Fixed overlay */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          color: "white",
          textShadow: "2px 2px black",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "10px" }}>
          {user.animal}
        </div>
        <div style={{ fontSize: "16px", maxWidth: "300px" }}>
          {ANIMAL_FACTS[user.animal]}
        </div>
      </div>
    </div>
  );
}
