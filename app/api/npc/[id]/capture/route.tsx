import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { NPC, NPCPhase } from "../../../../utils/types";
import {
  channelNPCGroups,
  channelNPCs,
  getNPCsForChannel,
  updateNPCGroupInChannel,
  updateNPCInChannel,
} from "../../service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const npcId = params.id;
    const { captorId, channelName } = await request.json();

    if (!npcId || !channelName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    const pusher = getPusherInstance();

    console.log("channelNPCs in capture", channelNPCs);

    const npc = getNPCsForChannel(channelName).get(npcId)!;

    const updatedNPC: NPC = {
      ...npc,
      phase: NPCPhase.CAPTURED,
    };

    updateNPCInChannel(channelName, updatedNPC, true);
    updateNPCGroupInChannel(channelName, captorId, npcId);
    await pusher.trigger(channelName, "npc-captured", {
      id: captorId,
      npc: updatedNPC,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing NPC capture:", error);
    return NextResponse.json(
      { error: "Failed to process throw" },
      { status: 500 }
    );
  }
}
