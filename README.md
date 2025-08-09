# Nature vs NPC

A real-time io-style game where players compete to control animals to capture groups of NPCs

## Play the Game

**[Play Now at nature-vs-npc.com](https://nature-vs-npc.com)**

## Game Overview

Nature vs NPC is a multiplayer game that combines real-time strategy with animal control mechanics. Players choose from 12 different animals and compete against other players and bots to capture groups of historical NPCs (Non-Player Characters) in a shared 2D game world.

### Key Features

- **Real-time Multiplayer**: Compete with other players in a shared 2D game world
- **Animal Selection**: Choose from 12 unique animals including dolphins, wolves, tigers, eagles, and more
- **Historical NPCs**: Encounter famous historical figures like Leonardo da Vinci, Cleopatra, Napoleon, and others
- **2D Graphics**: Immersive Three.js-powered 2D rendering with smooth animations
- **Live Chat**: NPCs send messages in chat

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
- **NPCs**: 16-bit pixel style portraits of 36+ historical figures
- **Backgrounds**: Procedurally generated patterns and terrains

## Deployment

The game is deployed on AWS infrastructure with:

- **EC2 Instance**: t3.small running Amazon Linux 2023

## How to Play

1. Visit [nature-vs-npc.com](https://nature-vs-npc.com)
2. Move around the world using WASD or arrow keys
4. Find and capture groups of NPCs by getting close to them
5. Throw NPCs with space bar to capture more NPCs
6. Compete with other players for the highest score!

## License

ISC License

## Contributing

This is a personal project. Feel free to fork and experiment!

---

*Built using React, Three.js, Node.js, and deployed on AWS*