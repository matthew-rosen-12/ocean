export default function getChannel(): string {
  return "presence-chat";
}

async function createRoom(roomName, creatorId) {
    // 1. Create room in database
    const room = await prisma.room.create({
      data: {
        name: roomName,
        channelName: `presence-room-${generateUniqueId()}`,
        creatorId
      }
    });
  
    // 2. Subscribe to Pusher channel
    const channel = pusher.subscribe(room.channelName);
  }
  
  // Joining a room
  async function joinRoom(roomId, userId) {
    // 1. Get room from database
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });