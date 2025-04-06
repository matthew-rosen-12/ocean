import { NextResponse } from "next/server";
import { channelNPCs, getNPCsForChannel } from "./service";
import { channel } from "diagnostics_channel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelName = searchParams.get("channel");

  if (!channelName) {
    return NextResponse.json(
      { error: "Channel name is required" },
      { status: 400 }
    );
  }

  const npcs = getNPCsForChannel(channelName);
  console.log("channelNPCs in initial GET: ", channelNPCs);
  return NextResponse.json(Array.from(npcs.entries()));
}
