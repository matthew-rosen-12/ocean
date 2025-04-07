import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { throwData, NPC, NPCPhase } from "../../../../utils/types";
import {
  getChannelActiveThrows,
  setChannelActiveThrows,
  updateNPCInChannel,
} from "../../service";
import { getGameTicker } from "../../../utils/game-ticker";

getGameTicker();

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
      channelName,
      npc: updatedNPC,
      startPosition: npc.position,
      direction: direction,
      velocity,
      throwDuration: 2000,
      timestamp: Date.now(),
    };

    updateNPCInChannel(channelName, updatedNPC);
    const activeThrows = await getChannelActiveThrows(channelName);
    activeThrows.push(throwData);
    await setChannelActiveThrows(channelName, activeThrows);
    await pusher.trigger(channelName, "npc-thrown", {
      throw: throwData,
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

export function calculateLandingPosition(throwData: throwData) {
  const { startPosition, direction, velocity, throwDuration } = throwData;
  const distance = velocity * (throwDuration / 1000);
  const landingPosition = {
    x: startPosition.x + direction.x * distance,
    y: startPosition.y + direction.y * distance,
    z: 0,
  };
  return landingPosition;
}
