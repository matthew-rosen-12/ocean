import React from "react";
import { NPC, NPCPhase, throwData, UserInfo, npcId } from "../../utils/types";
import IdleNPCGraphic from "./IdleNPCGraphic";
import ThrownNPCGraphic from "./ThrownNPCGraphic";

interface NPCGraphicWrapperProps {
  npc: NPC;
  checkForCollision: (npc: NPC) => void;
  throwData: throwData | undefined;
  users: Map<string, UserInfo>;
}

const NPCGraphicWrapper = ({
  npc,
  checkForCollision,
  throwData,
  users,
}: NPCGraphicWrapperProps) => {
  if (npc.phase === NPCPhase.IDLE) {
    return (
      <IdleNPCGraphic
        key={npc.id}
        npc={npc}
        checkForCollision={checkForCollision}
      />
    );
  } else if (npc.phase === NPCPhase.THROWN) {
    if (!throwData) {
      return null;
    }

    const throwerUser = users.get(throwData.throwerId);
    if (!throwerUser) {
      return null;
    }

    return (
      <ThrownNPCGraphic
        key={npc.id}
        npc={npc}
        throwData={throwData}
        user={throwerUser}
      />
    );
  }

  return null;
};
export default React.memo(NPCGraphicWrapper);
