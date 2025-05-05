import { NPC, NPCPhase, throwData, UserInfo, npcId } from "../../utils/types";
import CapturedNPCGraphic from "./CapturedNPCGraphic";
import IdleNPCGraphic from "./IdleNPCGraphic";
import ThrownNPCGraphic from "./ThrownNPCGraphic";

interface NPCGraphicWrapperProps {
  npc: NPC;
  checkForCollision: (npc: NPC) => void;
  myUser: UserInfo;
  throwData: throwData | undefined;
  followingUser: UserInfo | undefined;
}

const NPCGraphicWrapper = ({
  npc,
  checkForCollision,
  myUser,
  throwData,
  followingUser,
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
      console.warn(`Throw data with id ${npc.id} not found in throws map`);
      return null;
    }
    return <ThrownNPCGraphic key={npc.id} npc={npc} throwData={throwData} />;
  } else {
    // assert that followingUser isn't null
    if (!followingUser) {
      return null;
    }

    return (
      <CapturedNPCGraphic
        key={npc.id}
        npc={npc}
        isLocalUser={followingUser.id === myUser.id}
        followingUser={followingUser}
        offsetIndex={0}
      />
    );
  }
};

export default NPCGraphicWrapper;
