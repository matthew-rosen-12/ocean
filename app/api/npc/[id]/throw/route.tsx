import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { NPC, NPCPhase } from "../../../../utils/types";
import Pusher from "pusher";
import { addNPCToChannel, updateNPCInChannel } from "../../../npc/service";

const activeThrows = new Map();

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

    const updatedNPC = {
      ...npc,
      phase: NPCPhase.THROWN,
    };

    const throwData = {
      channelName,
      npcId,
      startPosition: npc.position,
      direction: direction,
      velocity,
      maxDistance: 15,
      distanceTraveled: 0,
    };

    activeThrows.set(npcId, throwData);

    await addNPCToChannel(channelName, updatedNPC);
    await pusher.trigger(channelName, "npc-thrown", {
      npcId,
      throwerId,
      npcData: updatedNPC,
    });

    updateThrownNPC(updatedNPC, pusher);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing NPC throw:", error);
    return NextResponse.json(
      { error: "Failed to process throw" },
      { status: 500 }
    );
  }
}

async function updateThrownNPC(npc: NPC, pusher: Pusher) {
  const throwData = activeThrows.get(npc.id);
  if (!throwData) return;

  const updateInterval = 0.05;
  const distanceToAdd = throwData.velocity * updateInterval;
  throwData.distanceTraveled += distanceToAdd;

  const newPosition = {
    x:
      throwData.startPosition.x +
      throwData.direction.x * throwData.distanceTraveled,
    y:
      throwData.startPosition.y +
      throwData.direction.y * throwData.distanceTraveled,
    z: throwData.startPosition.z || 0,
  };

  npc.position = newPosition;
  updateNPCInChannel(throwData.channelName, npc.id, npc);
  await pusher.trigger(throwData.channelName, "npc-update", {
    npc: npc,
  });

  if (throwData.distanceTraveled >= throwData.maxDistance) {
    npc.phase = NPCPhase.FREE;
    npc.position = newPosition;
    updateNPCInChannel(throwData.channelName, npc.id, npc);
    await pusher.trigger(throwData.channelName, "npc-update", {
      npc: npc,
    });

    activeThrows.delete(npc.id);
  } else {
    setTimeout(() => updateThrownNPC(npc, pusher), 50);
  }
}
