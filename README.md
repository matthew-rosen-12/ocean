# Nature vs NPC

A real-time IO-style multiplayer game where players control animals and compete to capture NPCs in a 2D game world.

## Play the Game

**[Play Now at nature-vs-npc.com](https://nature-vs-npc.com)**

### Key Features

- **Real-time Multiplayer**: Compete with other players in a shared 2D game world
- **Animal Characters**: Control one of 12 unique animals including dolphins, wolves, tigers, eagles, and more
- **Historical NPCs**: Encounter famous historical figures like Leonardo da Vinci, Cleopatra, Napoleon, and others
- **2D Graphics**: Immersive Three.js-powered 2D rendering with smooth animations
- **NPC Chat**: NPCs send messages in chat

## How to Play

1. Visit [nature-vs-npc.com](https://nature-vs-npc.com)
2. Move your animal around using WASD or arrow keys
4. Find and capture groups of NPCs by moving over them
5. Throw NPCs with space bar to capture more NPCs
6. The player with the most captured NPCs when the 90-second timer runs out wins!

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **3D Graphics**: Three.js with React Three Fiber
- **Build Tool**: Vite
- **Real-time Communication**: Socket.io Client

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **WebSockets**: Socket.io
- **AI Integration**: GROQ for NPC messages

### Infrastructure
- **Deployment**: AWS EC2
- **Web Server**: Nginx (reverse proxy + static files)
- **Domain**: Custom domain with Cloudflare DNS

## Game Assets

The game features custom graphics for animals and NPCs:

- **Animals**: 12 unique animal sprites generated from SVGs
- **NPCs**: 16-bit pixel style portraits of 40 historical figures
- **Backgrounds**: Procedurally generated patterns and terrains

## Deployment

The game is deployed on AWS infrastructure with:

- **EC2 Instance**: t3.small running Amazon Linux 2023

## License

ISC License

## Contributing

This is a personal project. Feel free to fork and experiment!

---

*Built using React, Three.js, Node.js, and deployed on AWS*