import { useState } from "react";
import {
  NPC,
  pathData,
  UserInfo,
  NPCGroup,
  DefaultMap,
  npcId,
  userId,
} from "./utils/types";
import Scene from "./components/Scene";
import GuestLogin from "./components/GuestLogin";
import { ANIMAL_FACTS } from "../public/facts";
import {
  createTerrain,
  createTerrainFromServer,
  ServerTerrainConfig,
} from "./utils/terrain";

function App() {
  const [myUser, setMyUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<Map<userId, UserInfo>>(new Map());
  const [npcs, setNPCs] = useState<Map<npcId, NPC>>(new Map());
  const [paths, setPaths] = useState<Map<npcId, pathData>>(new Map());
  const [npcGroups, setNPCGroups] = useState<DefaultMap<userId, NPCGroup>>(
    new DefaultMap((id) => ({ npcIds: new Set(), captorId: id }))
  );
  const [serverTerrainConfig, setServerTerrainConfig] =
    useState<ServerTerrainConfig | null>(null);

  // Generate terrain configuration
  const terrain = serverTerrainConfig
    ? createTerrainFromServer(serverTerrainConfig)
    : createTerrain();

  if (!myUser) {
    return (
      <GuestLogin
        setMyUser={setMyUser}
        setUsers={setUsers}
        setNPCs={setNPCs}
        setPaths={setPaths}
        setNPCGroups={setNPCGroups}
        setTerrainConfig={setServerTerrainConfig}
      />
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Scene
        users={users}
        myUser={myUser}
        npcs={npcs}
        paths={paths}
        npcGroups={npcGroups}
        setPaths={setPaths}
        setNpcGroups={setNPCGroups}
        setNpcs={setNPCs}
        terrain={terrain}
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

export default App;
