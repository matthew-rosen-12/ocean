import { NextRequest, NextResponse } from "next/server";
import { getNPCGroupsFromRedis } from "../service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelName = searchParams.get("channel");

    if (!channelName) {
      return NextResponse.json(
        { error: "Missing channel parameter" },
        { status: 400 }
      );
    }

    // Get NPC groups for this channel
    const npcGroups = await getNPCGroupsFromRedis(channelName);

    // Transform to a serializable format
    const serializedGroups = Array.from(npcGroups.entries()).map(
      ([id, group]) => {
        return {
          id,
          npcIds: Array.from(group.npcIds),
          captorId: group.captorId,
        };
      }
    );

    // Return NPC groups data
    return NextResponse.json({
      npcGroups: serializedGroups,
    });
  } catch (error) {
    console.error("Error fetching NPC groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch NPC groups" },
      { status: 500 }
    );
  }
}
