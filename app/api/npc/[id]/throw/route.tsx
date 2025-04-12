import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { throwData, NPC, NPCPhase } from "../../../../utils/types";
import {
  getChannelActiveThrows,
  removeNPCFromGroupInChannel,
  setChannelActiveThrows,
  updateNPCInChannel,
  setThrowCompleteInChannel,
} from "../../service";
// import { getGameTicker } from "../../../utils/game-ticker";
import { v4 as uuidv4 } from "uuid";

// getGameTicker();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const npcId = params.id;
    const { throwerId, direction, npc, velocity, channelName } =
      await request.json();

    if (
      !npcId ||
      !throwerId ||
      !direction ||
      !npc ||
      !velocity ||
      !channelName
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pusher = getPusherInstance();

    const updatedNPC: NPC = {
      ...npc,
      phase: NPCPhase.THROWN,
    };

    const throwData: throwData = {
      id: uuidv4(),
      channelName,
      npc: updatedNPC,
      startPosition: npc.position,
      direction: direction,
      velocity,
      throwDuration: 2000,
      timestamp: Date.now(),
      throwerId,
    };

    updateNPCInChannel(channelName, updatedNPC);
    const activeThrows = await getChannelActiveThrows(channelName);
    activeThrows.push(throwData);
    await setChannelActiveThrows(channelName, activeThrows);
    await removeNPCFromGroupInChannel(channelName, throwerId, npcId);

    await pusher.trigger(channelName, "npc-thrown", {
      throw: throwData,
    });

    setTimeout(async () => {
      await setThrowCompleteInChannel(channelName, throwData);
      const updatedActiveThrows = activeThrows.filter(
        (t) => t.id !== throwData.id
      );
      await setChannelActiveThrows(channelName, updatedActiveThrows);
    }, throwData.throwDuration);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing NPC throw:", error);
    return NextResponse.json(
      { error: "Failed to process throw" },
      { status: 500 }
    );
  }
}
