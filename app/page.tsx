// ocean/app/page.tsx
"use client";
import GuestLogin from "./components/GuestLogin";
import Scene from "./components/Scene";
import { NPCGroup, npcId, throwData, userId, UserInfo } from "./utils/types";
import { useState } from "react";
import { ANIMAL_FACTS } from "@/public/facts";
import { NPC } from "./utils/types";
import { DefaultMap } from "./utils/types";

export default function Home() {
  const [myUser, setMyUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<Map<userId, UserInfo>>(new Map());
  const [npcs, setNPCs] = useState<Map<npcId, NPC>>(new Map());
  const [throws, setThrows] = useState<Map<npcId, throwData>>(new Map());
  const [npcGroups, setNPCGroups] = useState<DefaultMap<userId, NPCGroup>>(
    new DefaultMap((id) => ({ npcIds: new Set(), captorId: id }))
  );

  if (!myUser) {
    return (
      <GuestLogin
        setMyUser={setMyUser}
        setUsers={setUsers}
        setNPCs={setNPCs}
        setThrows={setThrows}
        setNPCGroups={setNPCGroups}
      />
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Scene
        users={users}
        myUser={myUser}
        npcs={npcs}
        throws={throws}
        npcGroups={npcGroups}
      />

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
          {myUser.animal}
        </div>
        <div style={{ fontSize: "16px", maxWidth: "300px" }}>
          {ANIMAL_FACTS[myUser.animal]}
        </div>
      </div>
    </div>
  );
}
