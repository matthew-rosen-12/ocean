import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../../../utils/pusher/pusher-instance";
import { NPCPhase } from "../../../../utils/types";
import Pusher from "pusher";
import { addNPCToChannel, updateNPCInChannel } from "../../../npc/service";

// Track thrown NPCs with their trajectory data
const thrownNPCs = new Map();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const npcId = params.id;
    const { throwerId, direction, filename, velocity, position, channelName } =
      await request.json();

    // Validate the request data
    if (
      !npcId ||
      !throwerId ||
      !direction ||
      !filename ||
      !velocity ||
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
      filename: filename, // Use default filename or add filename to the destructured parameters
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

    // Store thrown NPC data for position updates
    const throwData = {
      npc: updatedNPC,
      channelName,
      startPosition: { ...position },
      direction: { ...direction },
      velocity,
      startTime: Date.now(),
      maxDistance: 15, // Maximum throw distance
      distanceTraveled: 0,
    };

    thrownNPCs.set(npcId, throwData);

    // Add the thrown NPC back to the channel directly in the service
    await addNPCToChannel(channelName, updatedNPC);

    // Broadcast the initial throw event to clients
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

// Function to update thrown NPC position
async function updateThrownNPC(npcId: string, pusher: Pusher) {
  const throwData = thrownNPCs.get(npcId);
  if (!throwData) return;

  // Calculate new position based on elapsed time
  const updateInterval = 0.05; // 50ms in seconds
  const distanceToAdd = throwData.velocity * updateInterval;
  throwData.distanceTraveled += distanceToAdd;

  // Update NPC position
  throwData.npc.position.x += throwData.direction.x * distanceToAdd;
  throwData.npc.position.y += throwData.direction.y * distanceToAdd;

  // Update the NPC in the service directly
  updateNPCInChannel(throwData.channelName, throwData.npc);

  // Broadcast position update to clients
  await pusher.trigger(`presence-${throwData.channelName}`, "npc-position", {
    npcId,
    position: throwData.npc.position,
    phase: NPCPhase.THROWN,
  });

  // Check if throw is complete
  if (throwData.distanceTraveled >= throwData.maxDistance) {
    // Throw complete, change to FREE state
    throwData.npc.phase = NPCPhase.FREE;

    // Update the NPC in the service directly
    updateNPCInChannel(throwData.channelName, throwData.npc);

    // Broadcast final state to clients
    await pusher.trigger(`presence-${throwData.channelName}`, "npc-free", {
      npcId,
      npcData: throwData.npc,
    });

    // Remove from tracked throws
    thrownNPCs.delete(npcId);
  } else {
    // Continue updating if not complete
    setTimeout(() => updateThrownNPC(npcId, pusher), 50); // Update every 50ms
  }
}
