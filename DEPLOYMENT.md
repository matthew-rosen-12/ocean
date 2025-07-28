# Deployment Guide

## Quick Start

### Deploy everything:
```bash
npm run deploy
# or
./deploy.sh full
```

### Deploy specific components:
```bash
npm run deploy:frontend    # Frontend only
npm run deploy:backend     # Backend + shared
npm run deploy:shared      # Shared package (restarts backend)
npm run deploy:env         # Environment variables only
```

### Check server status:
```bash
npm run status
# or
./deploy.sh status
```

## Manual Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh full` | Deploy everything (shared + backend + frontend) |
| `./deploy.sh frontend` | Deploy only frontend changes |
| `./deploy.sh backend` | Deploy backend (includes shared) |
| `./deploy.sh shared` | Deploy shared package and restart backend |
| `./deploy.sh env` | Deploy environment variables |
| `./deploy.sh status` | Show server status (PM2, Nginx, SSL) |

## What Each Deployment Does

### Frontend Deployment
1. Runs `NODE_ENV=production npm run build` in frontend/
2. Uploads `dist/` folder to server
3. Files are served by Nginx immediately

### Backend Deployment  
1. Builds shared package first
2. Runs `npm run build` in backend/
3. Uploads `dist/` folder to server
4. Restarts PM2 process `nature-npc-backend`

### Shared Package Deployment
1. Runs `npm run build` in shared/
2. Uploads `dist/` and `package.json` to server
3. Restarts backend to pick up changes

### Environment Variables
1. Uploads `backend/.env` to server
2. Restarts backend to pick up new variables

## Troubleshooting

### If deployment fails:
1. Check your SSH key exists: `ls ~/.ssh/nature-npc-key.pem`
2. Test SSH connection: `ssh -i ~/.ssh/nature-npc-key.pem ec2-user@54.84.59.218`
3. Check server status: `./deploy.sh status`

### Common issues:
- **Build fails**: Check for TypeScript errors or missing dependencies
- **PM2 restart fails**: SSH into server and check `pm2 logs`
- **Files not updating**: Hard refresh browser (Ctrl+Shift+R) due to caching

## Server Details

- **Server**: `ec2-user@54.84.59.218`
- **SSH Key**: `~/.ssh/nature-npc-key.pem`
- **Server Path**: `/home/ec2-user/nature-npc/`
- **Domain**: https://nature-vs-npc.com
- **Backend Process**: `nature-npc-backend` (PM2)

## File Structure on Server

```
/home/ec2-user/nature-npc/
├── backend/
│   ├── dist/           # Built backend code
│   └── .env           # Environment variables
├── frontend/
│   └── dist/          # Built frontend (served by Nginx)
└── shared/
    ├── dist/          # Built shared package
    └── package.json   # Shared package info
```