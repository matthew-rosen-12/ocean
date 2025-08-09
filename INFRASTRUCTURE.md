# Nature vs NPC - Infrastructure Documentation

## 🎯 Live Production Environment
- **URL**: https://nature-vs-npc.com ✅ SECURE
- **Status**: Fully functional with SSL/HTTPS, Three.js rendering, NPCs visible in 3D scene
- **Last Updated**: July 2025

## Project Architecture

### Technology Stack
- **Frontend**: React + TypeScript with Vite build system
- **Backend**: Node.js/Express server with Socket.io WebSocket support
- **Shared**: TypeScript library with shared types and utilities
- **Traffic**: Low expected user count
- **Special Features**: Real-time multiplayer gameplay via WebSockets

## AWS Infrastructure

### EC2 Instance
- **Instance Type**: t3.small (for build performance)
- **AMI**: Amazon Linux 2023 (Node.js 18+ compatibility)
- **Region**: us-east-1
- **Public IP**: [Configured via environment variables]
- **SSH Key**: [Configured via environment variables]

### Security Groups
- **SSH (port 22)**: Restricted to specific IPs
- **HTTP (port 80)**: Open (redirects to HTTPS)
- **HTTPS (port 443)**: Open
- **Backend (port 3001)**: Internal only (proxied through Nginx)

## Server Configuration

### Software Installed
- **Node.js**: 18.18.2
- **PM2**: Process manager for Node.js applications
- **Nginx**: Reverse proxy and static file server
- **Certbot**: SSL certificate management
- **Git**: Code deployment

### Directory Structure
```
/home/ec2-user/nature-npc/
├── backend/
│   ├── dist/           # Built backend code
│   └── .env           # Environment variables (Google AI API)
├── frontend/
│   └── dist/          # Built React app (served by Nginx)
└── shared/
    ├── dist/          # Built shared TypeScript package
    └── package.json   # Package metadata
```

### Running Services
- **Backend Process**: `nature-npc-backend` (managed by PM2)
  - Command: `NODE_PATH=/home/ec2-user/nature-npc/shared/dist pm2 start dist/backend/src/server.js --name nature-npc-backend`
  - Port: 3001 (internal)
- **Nginx**: Reverse proxy and static file server
- **Certbot Timer**: Automatic SSL certificate renewal

## Domain and SSL

### Domain Configuration
- **Domain**: nature-vs-npc.com (purchased through Cloudflare)
- **DNS**: Cloudflare A record pointing to server IP
- **SSL Certificate**: Let's Encrypt (auto-renewing)
- **Certificate Expiry**: 2025-10-26
- **Cloudflare SSL Mode**: Full (strict)

### SSL Certificate Management
```bash
# Certificate installation
sudo certbot --nginx -d nature-vs-npc.com --email [your-email]

# Auto-renewal (enabled)
sudo systemctl enable certbot-renew.timer
```

## Nginx Configuration

### Core Setup
- **Config File**: `/etc/nginx/conf.d/nature-npc.conf`
- **Frontend Serving**: Static files from `/home/ec2-user/nature-npc/frontend/dist/`
- **API Proxying**: `/api` requests → `http://localhost:3001`
- **WebSocket Proxying**: `/socket.io` requests → `http://localhost:3001`
- **HTTPS Redirect**: Automatic HTTP → HTTPS redirect

### Security Headers
- **XSS Protection**: `X-XSS-Protection: 1; mode=block`
- **Frame Options**: `X-Frame-Options: SAMEORIGIN`
- **Content Security Policy**: Optimized for Three.js workers and blob URLs
  - `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`
  - `worker-src 'self' blob:`
  - `img-src 'self' data: blob: https:`
  - `style-src 'self' 'unsafe-inline' https:`

## Application Deployment

### Automated Deployment
Use the deployment scripts in the project root:
```bash
npm run deploy              # Deploy everything
npm run deploy:frontend     # Frontend only
npm run deploy:backend      # Backend + shared
npm run status             # Check server status
```

See `DEPLOYMENT.md` for detailed deployment instructions.

### Manual Deployment Process
1. **Build locally**: `npm run build` in respective directories
2. **Deploy files**: SCP built files to server
3. **Restart services**: PM2 restart for backend changes

## Environment Variables

### Backend Environment (.env)
- **Google AI API Key**: For NPC conversation generation
- **Node Environment**: Set to production
- **Port Configuration**: Backend runs on port 3001

### Deployment
Environment variables are deployed via:
```bash
npm run deploy:env
```

## Security Implementation

### HTTPS/SSL
- **Certificate**: Let's Encrypt with automatic renewal
- **Encryption**: TLS 1.2+ enforced
- **HSTS**: HTTP Strict Transport Security enabled
- **Redirect**: All HTTP traffic redirected to HTTPS

### Content Security Policy
- Configured to allow Three.js functionality
- Blocks unauthorized script execution
- Allows blob URLs for WebGL workers
- Permits external stylesheets

### Network Security
- SSH access restricted to specific IPs
- Backend port (3001) not exposed externally
- Nginx acts as reverse proxy barrier

## Monitoring and Maintenance

### Service Status
Check system health with:
```bash
npm run status
```

### Key Monitoring Points
- **PM2 Process**: Backend application health
- **Nginx Service**: Web server status
- **SSL Certificate**: Expiration monitoring (89 days remaining)
- **Disk Space**: Server storage utilization

### Log Locations
- **PM2 Logs**: `pm2 logs nature-npc-backend`
- **Nginx Logs**: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`
- **Certbot Logs**: `/var/log/letsencrypt/letsencrypt.log`

### Common Deployment Issues
- **502 Bad Gateway**: Backend not running or dependencies missing
  - Solution: Check PM2 status, reinstall backend dependencies
- **Permission Denied**: Nginx cannot access application files  
  - Solution: Run `chmod +x $(dirname path) && chmod -R +r path`
- **Module Not Found**: Shared package imports not resolving
  - Solution: Ensure symlink exists in shared/dist directory
- **PM2 Restart Failed**: Process doesn't exist on fresh server
  - Solution: Deploy script will auto-start if restart fails

## Cost Estimate

### Monthly AWS Costs (Low Traffic)
- **EC2 t3.small**: ~$15/month (24/7)
- **Elastic IP**: ~$3.65/month
- **Data Transfer**: ~$1-2/month (low traffic)
- **Total**: ~$20-25/month

### Additional Costs
- **Domain (Cloudflare)**: Varies by plan
- **SSL Certificate**: Free (Let's Encrypt)

## Backup and Recovery

### Current Backup Strategy
- **Code**: Git repository serves as source backup
- **Configuration**: Infrastructure documented in this file
- **SSL Certificates**: Auto-renewed, no backup needed
- **Application Data**: Stateless application, no persistent data

### Recovery Procedure
1. Launch new EC2 instance with security groups configured
2. Install required software: `Node.js 18+, PM2, Nginx, Certbot, Git`
3. Initialize server: `./deploy.sh init`
4. Deploy application: `./deploy.sh full`
5. Configure SSL certificate with Certbot
6. Update DNS A record if IP address changes

### Deployment Dependencies
- **Node.js**: Version 18+ required for backend execution
- **PM2**: Process manager for Node.js applications
- **Nginx**: Web server and reverse proxy
- **Certbot**: SSL certificate management
- **Git**: Version control (used by deployment scripts)
- **File Permissions**: Nginx must have read access to application files
- **Shared Module Resolution**: Symlink required for TypeScript module imports

## Future Improvements

### Potential Enhancements
- **Database**: Add persistent storage if needed (RDS/DynamoDB)
- **CDN**: CloudFront for better global performance
- **Monitoring**: CloudWatch for detailed metrics
- **CI/CD**: GitHub Actions for automated deployments
- **Staging Environment**: Separate environment for testing

### Scaling Considerations
- **Load Balancer**: For multiple backend instances
- **Auto Scaling**: Based on CPU/memory utilization
- **Database**: Separate database tier for persistence
- **Session Management**: Redis for WebSocket session persistence