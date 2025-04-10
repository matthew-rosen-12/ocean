import { prisma } from "@/prisma/prisma";
import { populateChannel } from "../../npc/service";

const MAX_USERS = 2;

export default async function getChannel(): Promise<string> {
  const smallestRoom = await prisma.room.findFirst({
    select: {
      id: true,
      channelName: true,
      numUsers: true,
    },
    where: {
      isActive: true,
    },
    orderBy: {
      numUsers: "asc",
    },
  });

  if (smallestRoom == null || smallestRoom.numUsers >= MAX_USERS) {
    const room = await prisma.$transaction(
      async (tx: {
        room: {
          create: (arg0: {
            data: { numUsers: number };
          }) => Promise<{ id: string }>;
          update: (arg0: {
            where: { id: string };
            data: { channelName: string };
          }) => Promise<{ id: string; channelName: string }>;
        };
      }) => {
        const newRoom = await tx.room.create({
          data: {
            numUsers: 1,
          },
        });

        return await tx.room.update({
          where: { id: newRoom.id },
          data: {
            channelName: `presence-chat-${newRoom.id}`,
          },
        });
      }
    );

    // Directly populate the new room with NPCs
    const channelName = room.channelName;
    try {
      await populateChannel(channelName);
    } catch (error) {
      console.error(
        `Failed to populate channel ${channelName} with NPCs:`,
        error
      );
      // Continue even if NPC population fails
    }

    return channelName;
  }
  await prisma.room.update({
    where: { id: smallestRoom.id },
    data: {
      numUsers: { increment: 1 },
      lastActive: new Date(),
    },
  });

  return smallestRoom.channelName;
}
