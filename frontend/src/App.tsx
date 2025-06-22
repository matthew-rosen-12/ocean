import { useState, useEffect } from "react";
import {
  pathData,
  UserInfo,
  NPCGroupsBiMap,
  npcGroupId,
  userId,
  FinalScores,
} from "shared/types";
import Scene from "./components/Scene";
import GuestLogin from "./components/GuestLogin";
import Leaderboard from "./components/Leaderboard";
import GameOverScreen from "./components/GameOverScreen";
import {
  createTerrain,
  createTerrainFromServer,
  ServerTerrainConfig,
} from "./utils/terrain";
import { preloadFonts } from "./utils/font-preloader";

function App() {
  const [myUser, setMyUser] = useState<UserInfo | null>(null);
  const [users, setUsers] = useState<Map<userId, UserInfo>>(new Map());
  const [paths, setPaths] = useState<Map<npcGroupId, pathData>>(new Map());
  const [npcGroups, setNPCGroups] = useState<NPCGroupsBiMap>(
    new NPCGroupsBiMap()
  );
  const [serverTerrainConfig, setServerTerrainConfig] =
    useState<ServerTerrainConfig | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | undefined>(undefined);
  const [gameDuration, setGameDuration] = useState<number | undefined>(undefined);
  const [gameOver, setGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState<FinalScores>({});
  const [winnerScreenshot, setWinnerScreenshot] = useState<string>("");
  const [deletingNPCs, setDeletingNPCs] = useState<Set<string>>(new Set());

  // Preload fonts on app initialization
  useEffect(() => {
    preloadFonts();
  }, []);

  // Generate terrain configuration
  const terrain = serverTerrainConfig
    ? createTerrainFromServer(serverTerrainConfig)
    : createTerrain();

  const handleReturnToLogin = () => {
    // Reset all game state
    setMyUser(null);
    setUsers(new Map());
    setPaths(new Map());
    setNPCGroups(new NPCGroupsBiMap());
    setServerTerrainConfig(null);
    setGameStartTime(undefined);
    setGameDuration(undefined);
    setGameOver(false);
    setFinalScores({});
    setWinnerScreenshot("");
    setDeletingNPCs(new Set());
  };

  // Show game over screen if game has ended
  if (gameOver && myUser) {
    return (
      <GameOverScreen
        finalScores={finalScores}
        users={users}
        onReturnToLogin={handleReturnToLogin}
        winnerScreenshot={winnerScreenshot}
        currentUserId={myUser.id}
      />
    );
  }

  if (!myUser) {
    return (
      <GuestLogin
        setMyUser={setMyUser}
        setUsers={setUsers}
        setPaths={setPaths}
        setNPCGroups={setNPCGroups}
        setTerrainConfig={setServerTerrainConfig}
        setGameStartTime={setGameStartTime}
        setGameDuration={setGameDuration}
        deletingNPCs={deletingNPCs}
        setDeletingNPCs={setDeletingNPCs}
      />
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Scene
        users={users}
        myUser={myUser}
        paths={paths}
        npcGroups={npcGroups}
        setPaths={setPaths}
        setNpcGroups={setNPCGroups}
        terrain={terrain}
        onScreenshotCapture={setWinnerScreenshot}
        onGameOver={(finalScores) => {
          setFinalScores(finalScores);
          setGameOver(true);
        }}
        deletingNPCs={deletingNPCs}
      />

      {/* Leaderboard */}
      <Leaderboard 
        users={users} 
        myUserId={myUser.id} 
        npcGroups={npcGroups}
        gameStartTime={gameStartTime}
        gameDuration={gameDuration}
      />
    </div>
  );
}

export default App;
