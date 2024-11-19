import { prisma } from "@/prisma/prisma";

const MAX_USERS = 100;

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
    const room = await prisma.$transaction(async (prisma) => {
      const newRoom = prisma.room.create({
        data: {
          numUsers: 1,
        },
      });
      prisma.room.update({
        where: { id: (await newRoom).id },
        data: {
          channelName: `presence-chat-${(await newRoom).id}`,
        },
      });
      return newRoom;
    });

    return room.channelName;
  }
  await prisma.room.update({
    where: { id: smallestRoom.id },
    data: {
      numUsers: { increment: 1 }, // Note: use snake_case
      lastActive: new Date(),
    },
  });

  return smallestRoom.channelName;
}
