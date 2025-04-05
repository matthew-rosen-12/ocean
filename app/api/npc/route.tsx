import { NextResponse } from "next/server";
import { getFreeNPCsForChannel } from "./service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelName = searchParams.get("channel");

  if (!channelName) {
    return NextResponse.json(
      { error: "Channel name is required" },
      { status: 400 }
    );
  }

  const npcs = await getFreeNPCsForChannel(channelName);
  return NextResponse.json({
    npcs,
  });
}
