import React, { useState, useEffect, useCallback } from "react";
import {
  pathData,
  UserInfo,
  NPCGroupsBiMap,
  NPCGroup,
  DefaultMap,
  npcGroupId,
  userId,
  FinalScores,
} from "shared/types";
import { NPCInteraction, AIResponse } from "shared/interaction-types";
import superjson from "superjson";

// Register classes with superjson using explicit identifiers for cross-module compatibility
superjson.registerClass(NPCGroupsBiMap, 'NPCGroupsBiMap');
superjson.registerClass(NPCGroup, 'NPCGroup');
superjson.registerClass(DefaultMap, 'DefaultMap');
import Scene from "./components/Scene";
import GuestLogin from "./components/GuestLogin";
import Leaderboard from "./components/Leaderboard";
import Messages from "./components/Messages";
import GameOverScreen from "./components/GameOverScreen";
import InactivityKick from "./components/InactivityKick";
import {
  createTerrain,
  createTerrainFromServer,
  ServerTerrainConfig,
} from "./utils/terrain";
import { preloadFonts } from "./utils/font-preloader";
import { throttle } from "lodash";
import { typedSocket, getSocket } from "./socket";

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
  const [latestInteraction, setLatestInteraction] = useState<NPCInteraction | null>(null);
  const [latestAiResponse, setLatestAiResponse] = useState<AIResponse | null>(null);
  const [kickedForInactivity, setKickedForInactivity] = useState(false);
  
  // Create a stable interaction setter function (throttled to 30 seconds)
  const interactionSetter = useCallback(
    throttle((interaction: NPCInteraction, aiResponse: AIResponse) => {
      setLatestInteraction(interaction);
      setLatestAiResponse(aiResponse);
    }, 10000, { 
      leading: true, 
      trailing: false 
    }),
    []
  );
  
  // Create a stable callback for passing to Leaderboard
  const handleInteractionUpdate = useCallback((setter: (interaction: NPCInteraction) => void) => {
    // This callback is for future extensibility
  }, []);

  // Handle inactivity kick
  const handleInactivityKick = useCallback(() => {
    
    
    // Disconnect from server to notify other clients that user has left
    const currentTypedSocket = typedSocket();
    if (currentTypedSocket) {
      currentTypedSocket.disconnect();
    }
    
    setKickedForInactivity(true);
    setMyUser(null); // Clear user state
  }, []);

  // Handle return to login from inactivity kick
  const handleReturnToLoginFromInactivity = useCallback(() => {
    // Batch all state resets together using React 18 automatic batching
    React.startTransition(() => {
      setKickedForInactivity(false);
      setMyUser(null);
      setUsers(new Map());
      setPaths(new Map());
      setNPCGroups(new NPCGroupsBiMap());
      setGameOver(false);
      setFinalScores({});
      setWinnerScreenshot("");
      setDeletingNPCs(new Set());
      setLatestInteraction(null);
      setLatestAiResponse(null);
    });
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
    // Disconnect the socket to clean up event listeners and server state
    const socket = getSocket();
    if (socket) {
      socket.disconnect();
    }
    
    // Batch all state resets together using React 18 automatic batching
    React.startTransition(() => {
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
      setLatestAiResponse(null);
    });
  };

  // Show inactivity kick screen if player was kicked
  if (kickedForInactivity) {
    return (
      <InactivityKick
        onReturnToLogin={handleReturnToLoginFromInactivity}
      />
    );
  }

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
        onInactivityKick={handleInactivityKick}
      />

      {/* Messages */}
      <Messages
        myUserId={myUser.id}
        users={users}
        npcGroups={npcGroups}
        latestInteraction={latestInteraction}
        latestAiResponse={latestAiResponse}
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
        latestAiResponse={latestAiResponse}
      />
    </div>
  );
}

export default App;
