# Deployment Guide

## Setup

First, configure your deployment environment variables:

```bash
# Option 1: Set environment variables
export DEPLOY_SERVER='ec2-user@your-server-ip'
export DEPLOY_SSH_KEY='~/.ssh/your-key.pem'  
export DEPLOY_SERVER_PATH='/home/ec2-user/nature-npc'

# Option 2: Create .env file from template
cp .env.example .env
# Edit .env with your actual values
```

## Quick Start

### For fresh servers (run once):
```bash
./deploy.sh init
```

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
| `./deploy.sh init` | Initialize fresh server (run once for new instances) |

## Fresh Server Setup

When setting up a new EC2 instance, follow these steps:

### 1. Install Required Software
```bash
# SSH into your new server
ssh -i ~/.ssh/your-key.pem ec2-user@your-server-ip

# Update system and install Node.js, nginx, git, PM2, and certbot
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs nginx git
npm install -g pm2
sudo yum install -y python3-pip
sudo pip3 install certbot certbot-nginx
```

### 2. Initialize Server Structure
```bash
# From your local machine
./deploy.sh init
```

### 3. Deploy Application
```bash
./deploy.sh full
```

### 4. Set up SSL Certificate
```bash
# SSH into server and run certbot
ssh -i ~/.ssh/your-key.pem ec2-user@your-server-ip
sudo certbot --nginx -d your-domain.com --email your-email@example.com --agree-tos
```

## What Each Deployment Does

### Fresh Server Initialization
1. Creates directory structure: `{shared,backend,frontend}`
2. Sets up file permissions for nginx to access files
3. Prepares server for first deployment

### Frontend Deployment
1. Runs `NODE_ENV=production npm run build` in frontend/
2. Uploads `dist/` folder to server
3. Files are served by Nginx immediately

### Backend Deployment  
1. Builds shared package first
2. Runs `npm run build` in backend/
3. Uploads `dist/` and `package.json` to server
4. Installs/updates production dependencies with `npm install --omit=dev`
5. Sets up shared module resolution symlink
6. Restarts PM2 process `nature-npc-backend` (or starts if fresh server)
   - **Important**: PM2 must start from backend directory to load .env file

### Shared Package Deployment
1. Runs `npm run build` in shared/
2. Uploads `dist/` and `package.json` to server
3. Installs/updates shared dependencies with `npm install --omit=dev`
4. Restarts backend to pick up changes

### Environment Variables
1. Uploads `backend/.env` to server
2. Restarts backend to pick up new variables

## Troubleshooting

### If deployment fails:
1. Check your SSH key exists: `ls $DEPLOY_SSH_KEY`
2. Test SSH connection: `ssh -i $DEPLOY_SSH_KEY $DEPLOY_SERVER`
3. Check server status: `./deploy.sh status`

### Common issues:
- **Build fails**: Check for TypeScript errors or missing dependencies
- **PM2 restart fails**: SSH into server and check `pm2 logs`
- **Files not updating**: Hard refresh browser (Ctrl+Shift+R) due to caching
- **Backend 502 errors**: Usually environment variables not loading
  - Solution: Ensure PM2 starts from backend directory to load .env file

## Server Details

- **Server**: Configured via `DEPLOY_SERVER` environment variable
- **SSH Key**: Configured via `DEPLOY_SSH_KEY` environment variable
- **Server Path**: Configured via `DEPLOY_SERVER_PATH` environment variable
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