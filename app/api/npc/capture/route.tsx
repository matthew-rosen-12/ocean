import { NextRequest, NextResponse } from "next/server";
import { captureNPC } from "../service";

export async function POST(request: NextRequest) {
  try {
    const { npcId, captorId, channelName } = await request.json();

    if (!npcId || !captorId || !channelName) {
      return NextResponse.json(
        { error: "NPC ID, captor ID, and channel name are required" },
        { status: 400 }
      );
    }

    // Mark the NPC as captured
    const success = captureNPC(npcId, captorId, channelName);

    if (!success) {
      return NextResponse.json(
        { error: "NPC not found or already captured" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "NPC captured successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error capturing NPC:", error);
    return NextResponse.json(
      { error: "Failed to capture NPC" },
      { status: 500 }
    );
  }
}
