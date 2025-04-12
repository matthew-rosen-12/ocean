import { NextRequest, NextResponse } from "next/server";
import { getChannelActiveThrows } from "../../npc/service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    if (!channel) {
      return NextResponse.json(
        { error: "Missing channel parameter" },
        { status: 400 }
      );
    }

    // Get active throws for this channel
    const activeThrows = await getChannelActiveThrows(channel);

    // Return active throws data
    return NextResponse.json({
      activeThrows: activeThrows,
    });
  } catch (error) {
    console.error("Error fetching active throws:", error);
    return NextResponse.json(
      { error: "Failed to fetch active throws" },
      { status: 500 }
    );
  }
}
