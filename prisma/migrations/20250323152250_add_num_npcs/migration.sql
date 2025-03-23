-- CreateTable
CREATE TABLE "Stats" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "numNPCs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "numUsers" INTEGER NOT NULL DEFAULT 0,
    "channelName" TEXT NOT NULL DEFAULT 'presence-chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);
