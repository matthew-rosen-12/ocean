import { useState, useEffect, useCallback } from "react";
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
import { throttle } from "lodash";

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
  const [latestInteraction, setLatestInteraction] = useState<{filename: string; message: string} | null>(null);
  
  // Create a stable interaction setter function (throttled to 30 seconds)
  const interactionSetter = useCallback(
    throttle((filename: string, message: string) => {
      setLatestInteraction({ filename, message });
    }, 30000, { 
      leading: true, 
      trailing: false 
    }),
    []
  );
  
  // Create a stable callback for passing to Leaderboard
  const handleInteractionUpdate = useCallback((setter: (filename: string, message: string) => void) => {
    // This callback is for future extensibility
  }, []);

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
    setLatestInteraction(null);
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
        interactionSetter={interactionSetter}
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
        interactionSetter={interactionSetter}
      />

      {/* Leaderboard */}
      <Leaderboard 
        users={users} 
        myUserId={myUser.id} 
        npcGroups={npcGroups}
        gameStartTime={gameStartTime}
        gameDuration={gameDuration}
        onInteractionUpdate={handleInteractionUpdate}
        latestInteraction={latestInteraction}
      />
    </div>
  );
}

export default App;
