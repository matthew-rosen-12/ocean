import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { NPC, NPCPhase } from "../../../../utils/types";
import {
  channelNPCGroups,
  channelNPCs,
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

    const npc = channelNPCs.get(channelName)!.get(npcId)!;
    const updatedNPC: NPC = {
      ...npc,
      phase: NPCPhase.THROWN,
    };

    updateNPCInChannel(channelName, updatedNPC);
    channelNPCGroups.get(channelName).get(captorId).npcs.push(updatedNPC);
    await pusher.trigger(channelName, "npc-captured", {
      id: captorId,
      npc: updatedNPC,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing NPC throw:", error);
    return NextResponse.json(
      { error: "Failed to process throw" },
      { status: 500 }
    );
  }
}
