import { prisma } from "@/prisma/prisma";

const MAX_USERS = 1;

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
    const room = await prisma.$transaction(async (tx) => {
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
    });

    return room.channelName;
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
