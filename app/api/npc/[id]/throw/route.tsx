import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { NPCPhase } from "../../../../utils/types";
import Pusher from "pusher";
import {
  addNPCToChannel,
  channelNPCs,
  updateNPCInChannel,
} from "../../../npc/service";

const activeThrows = new Map();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const npcId = params.id;
    const { throwerId, direction, velocity, filename, position, channelName } =
      await request.json();

    // Validate the request data
    if (
      !npcId ||
      !throwerId ||
      !direction ||
      !velocity ||
      !filename ||
      !position ||
      !channelName
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const pusher = getPusherInstance();

    // Create the updated NPC data
    const updatedNPC = {
      id: npcId,
      type: "npc",
      filename: filename,
      phase: NPCPhase.THROWN,
      direction: {
        x: direction.x,
        y: direction.y,
      },
      position: {
        x: position.x,
        y: position.y,
        z: position.z || 0,
      },
    };

    // Store only trajectory data, not the full NPC
    const throwData = {
      channelName,
      npcId, // Store just the ID reference
      startPosition: { ...position },
      direction: { ...direction },
      velocity,
      startTime: Date.now(),
      maxDistance: 15,
      distanceTraveled: 0,
    };

    activeThrows.set(npcId, throwData);

    // Broadcast and add to channel as before
    await addNPCToChannel(channelName, updatedNPC);
    await pusher.trigger(`presence-${channelName}`, "npc-thrown", {
      npcId,
      throwerId,
      npcData: updatedNPC,
    });

    // Set up position updates
    updateThrownNPC(npcId, pusher);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing NPC throw:", error);
    return NextResponse.json(
      { error: "Failed to process throw" },
      { status: 500 }
    );
  }
}

// Update the function to send complete NPCs
async function updateThrownNPC(npcId: string, pusher: Pusher) {
  const throwData = activeThrows.get(npcId);
  if (!throwData) return;

  // Calculate new position
  const updateInterval = 0.05;
  const distanceToAdd = throwData.velocity * updateInterval;
  throwData.distanceTraveled += distanceToAdd;

  // Get the updated position
  const newPosition = {
    x:
      throwData.startPosition.x +
      throwData.direction.x * throwData.distanceTraveled,
    y:
      throwData.startPosition.y +
      throwData.direction.y * throwData.distanceTraveled,
    z: throwData.startPosition.z || 0,
  };

  // Update NPC in service
  updateNPCInChannel(throwData.channelName, npcId, {
    phase: NPCPhase.THROWN,
    position: newPosition,
  });

  // Get the full updated NPC from the channel
  const channelNpcs = channelNPCs.get(throwData.channelName) || [];
  const updatedNPC = channelNpcs.find((npc) => npc.id === npcId);

  if (!updatedNPC) {
    console.error(`NPC ${npcId} not found in channel ${throwData.channelName}`);
    return;
  }

  // Broadcast complete NPC
  await pusher.trigger(throwData.channelName, "npc-update", {
    npc: updatedNPC,
  });

  // Handle completion
  if (throwData.distanceTraveled >= throwData.maxDistance) {
    // Update to FREE state
    updateNPCInChannel(throwData.channelName, npcId, {
      phase: NPCPhase.FREE,
      position: newPosition,
    });

    // Get the final NPC state
    const finalNPC = channelNpcs.find((npc) => npc.id === npcId);

    if (finalNPC) {
      // Broadcast final complete NPC
      await pusher.trigger(throwData.channelName, "npc-update", {
        npc: finalNPC,
      });
    }

    activeThrows.delete(npcId);
  } else {
    setTimeout(() => updateThrownNPC(npcId, pusher), 50);
  }
}
