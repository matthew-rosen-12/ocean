# AWS Deployment Todo - Nature vs NPC Game

## 🎯 DEPLOYMENT STATUS: LIVE AT http://54.84.59.218
**Current Issue**: NPCs load correctly but not visible in 3D scene (Three.js rendering issue)

## Project Analysis Summary
- **Frontend**: React + TypeScript app with Vite build system
- **Backend**: Node.js/Express server with Socket.io WebSocket support
- **Shared**: TypeScript library with shared types
- **Traffic**: Low expected user count
- **Special Requirements**: WebSocket support for real-time multiplayer gameplay

## Phase 1: Infrastructure Setup and Planning ✅ COMPLETED

### 1.1 AWS Account and Prerequisites ✅
- [x] ~~Create AWS account or ensure access to existing account~~
- [x] ~~Set up AWS CLI and configure credentials~~
- [x] ~~Create IAM user with appropriate permissions for deployment~~
- [x] ~~Choose AWS region (us-east-1 recommended for lower costs)~~
  - **Implemented**: us-east-1, AWS CLI configured

### 1.2 Domain and SSL Setup 🔄 PARTIAL
- [ ] Purchase domain through Route 53 or configure external domain
- [ ] Request SSL certificate through AWS Certificate Manager (ACM)
- [ ] Set up Route 53 hosted zone for DNS management
  - **Status**: Using IP address for now, SSL optional

## Phase 2: Backend Deployment (EC2 Instance) ✅ COMPLETED

### 2.1 EC2 Instance Setup ✅
- [x] ~~Launch EC2 instance (t3.small for build performance)~~
- [x] ~~Choose Amazon Linux 2023 AMI (for Node.js 18+ compatibility)~~
- [x] ~~Configure security group~~:
  - [x] ~~Allow SSH (port 22) from your IP~~
  - [x] ~~Allow HTTP (port 80) and HTTPS (port 443) from anywhere~~
  - [x] ~~Internal port 3001 for backend (proxied through Nginx)~~
- [x] ~~Create SSH key pair for access~~
- [x] ~~Assign Elastic IP address~~
  - **Implemented**: 54.84.59.218, security groups configured

### 2.2 Server Configuration ✅
- [x] ~~SSH into EC2 instance~~
- [x] ~~Install Node.js 18 and npm~~
- [x] ~~Install PM2 for process management~~
- [x] ~~Install git for code deployment~~
- [x] ~~Set up application directory structure~~
  - **Implemented**: Node.js 18.18.2, PM2 installed, `/home/ec2-user/nature-npc/`

### 2.3 Application Deployment ✅
- [x] ~~Clone repository to EC2 instance~~
- [x] ~~Install dependencies and resolve module compatibility issues~~
- [x] ~~Build application with CommonJS shared package~~
- [x] ~~Configure environment variables (.env with Google AI API key)~~
- [x] ~~Start application with PM2 and special module path~~
  ```bash
  NODE_PATH=/home/ec2-user/nature-npc/shared/dist pm2 start dist/backend/src/server.js --name nature-npc-backend
  ```
  - **Implemented**: Backend running on port 3001, WebSocket functional, NPCs creating/deleting properly

### 2.4 Reverse Proxy Setup (Nginx) ✅
- [x] ~~Install Nginx~~
- [x] ~~Configure Nginx for WebSocket support and static file serving~~
- [x] ~~Configure Nginx to serve React build files and proxy API/WebSocket requests to port 3001~~
- [x] ~~Test Nginx configuration and restart service~~
  - **Implemented**: Nginx serving frontend from `/home/ec2-user/nature-npc/frontend/dist/`, proxying `/api` and `/socket.io` to backend

### 2.5 Domain and DNS Configuration 🔄 SKIPPED FOR NOW
- [ ] Configure Route 53 A record pointing to Elastic IP
- [ ] Test domain resolution
- [ ] Verify SSL certificate installation

## Phase 3: Frontend Deployment ✅ COMPLETED (Simplified Nginx Approach)

### 3.1 Build Preparation ✅
- [x] ~~Update frontend build configuration for production~~
- [x] ~~Configure Socket.IO endpoints to use relative URLs instead of localhost~~
- [x] ~~Fix frontend build issues with module compatibility~~
- [x] ~~Deploy built frontend to EC2 via SCP~~
  - **Implemented**: Frontend served directly by Nginx, Socket.IO connection fixed for production

### 3.2 Static File Serving ✅
- [x] ~~Configure Nginx to serve React build files from `/home/ec2-user/nature-npc/frontend/dist/`~~
- [x] ~~Set up proper file permissions for Nginx access~~
- [x] ~~Configure SPA routing fallback to index.html~~
- [x] ~~Serve NPC images from `/npcs/` directory~~
  - **Implemented**: All static assets served correctly, images accessible

### 3.3 Production Updates ✅
- [x] ~~Fix cache busting by updating JS filenames~~
- [x] ~~Update frontend to use empty string for BACKEND_URL in production~~
- [x] ~~Deploy updated build files to server~~
  - **Implemented**: Frontend fully functional except NPC rendering issue

## 🚨 CURRENT ISSUE: Three.js NPC Rendering Debug

### Issue Description
- **Status**: Backend creates NPCs correctly (visible in logs)
- **Status**: Frontend loads NPC images successfully (visible in Network tab)
- **Issue**: NPC 3D meshes not visible in Three.js scene
- **Next Steps**: Debug Three.js scene, check mesh materials, positioning, visibility

### Evidence Gathered
- ✅ Backend logs show NPCs being created/deleted with correct image filenames
- ✅ Network tab shows successful requests to `/npcs/*.png` files
- ✅ NPC images render correctly in browser preview
- ❌ NPCs not visible in 3D game scene

### Debug Commands for Browser Console
```javascript
// Check scene objects
window.scene?.children?.forEach((child, i) => {
  console.log(`Child ${i}:`, child.type, child.name, child.visible, child.position);
});

// Look for textured meshes
window.scene?.traverse((obj) => {
  if (obj.isMesh && obj.material?.map) {
    console.log('Found textured mesh:', obj.name, obj.position, obj.scale, obj.visible);
  }
});
```

## 📋 DEPLOYMENT PROCEDURES (For Future Updates)

### Backend Code Changes
```bash
# Local: Build and deploy backend
cd /path/to/backend
npm run build
scp -i ~/.ssh/nature-npc-key.pem -r dist/ ec2-user@54.84.59.218:/home/ec2-user/nature-npc/backend/

# Remote: Restart backend
ssh -i ~/.ssh/nature-npc-key.pem ec2-user@54.84.59.218 "pm2 restart nature-npc-backend"
```

### Frontend Code Changes
```bash
# Local: Build for production and deploy
cd /path/to/frontend
NODE_ENV=production npm run build  # Ensures correct Socket.IO URLs
scp -i ~/.ssh/nature-npc-key.pem -r dist/ ec2-user@54.84.59.218:/home/ec2-user/nature-npc/frontend/

# Note: May need cache busting if major changes
# ssh -i ~/.ssh/nature-npc-key.pem ec2-user@54.84.59.218 "cd /home/ec2-user/nature-npc/frontend/dist && cp assets/index-*.js assets/index-$(date +%s).js"
```

### Shared Package Changes
```bash
# Local: Build shared package
cd /path/to/shared
npm run build

# Deploy to both backend and frontend
scp -i ~/.ssh/nature-npc-key.pem -r dist/ ec2-user@54.84.59.218:/home/ec2-user/nature-npc/shared/
scp -i ~/.ssh/nature-npc-key.pem package.json ec2-user@54.84.59.218:/home/ec2-user/nature-npc/shared/

# Restart backend to pick up changes
ssh -i ~/.ssh/nature-npc-key.pem ec2-user@54.84.59.218 "pm2 restart nature-npc-backend"
```

### Environment Variable Updates
```bash
# Deploy .env file changes
scp -i ~/.ssh/nature-npc-key.pem .env ec2-user@54.84.59.218:/home/ec2-user/nature-npc/backend/
ssh -i ~/.ssh/nature-npc-key.pem ec2-user@54.84.59.218 "pm2 restart nature-npc-backend"
```

## Phase 4: Environment Configuration and Secrets ✅ COMPLETED

### 4.1 Environment Variables and Secrets ✅
- [x] ~~Configure backend environment variables (Google AI API key)~~
- [x] ~~Deploy .env file securely to production server~~
- [x] ~~Test environment variable injection~~
  - **Implemented**: `.env` file deployed, Google AI API working
- [ ] Set up AWS Systems Manager Parameter Store or AWS Secrets Manager
- [ ] Configure backend environment variables:
  - Database connection strings (if applicable)
  - API keys (Google Generative AI)
  - CORS origins for production domains
- [ ] Update ECS task definition with environment variables
- [ ] Test environment variable injection

### 4.2 CORS and Security Configuration
- [ ] Update backend CORS settings for production domains
- [ ] Configure security headers
- [ ] Set up AWS WAF (optional but recommended)
- [ ] Review and harden security groups

## Phase 5: Database and Persistence (If Needed)

### 5.1 Data Storage Assessment
- [ ] Evaluate if the application needs persistent data storage
- [ ] If needed, choose between:
  - Amazon RDS (relational database)
  - Amazon DynamoDB (NoSQL)
  - Amazon ElastiCache (Redis for sessions/caching)

### 5.2 Database Setup (If Required)
- [ ] Create database instance in private subnet
- [ ] Configure security groups for database access
- [ ] Set up database connection pooling
- [ ] Configure backup and maintenance windows
- [ ] Update backend code for production database connection

## Phase 6: Monitoring and Logging

### 6.1 CloudWatch Setup
- [ ] Configure CloudWatch logs for ECS tasks
- [ ] Set up CloudWatch metrics and alarms:
  - CPU utilization
  - Memory utilization
  - HTTP error rates
  - WebSocket connection metrics
- [ ] Create CloudWatch dashboard for monitoring

### 6.2 Application Performance Monitoring
- [ ] Consider AWS X-Ray for distributed tracing
- [ ] Set up custom metrics for game-specific events
- [ ] Configure log retention policies

## Phase 7: CI/CD Pipeline

### 7.1 Source Control and Build
- [ ] Set up GitHub Actions or AWS CodePipeline
- [ ] Create build workflows:
  - Backend: Build Docker image, push to ECR, update ECS service
  - Frontend: Build React app, upload to S3, invalidate CloudFront
- [ ] Configure separate staging and production environments
- [ ] Set up automated testing in pipeline

### 7.2 Deployment Automation
- [ ] Create deployment scripts
- [ ] Set up database migration pipeline (if applicable)
- [ ] Configure rollback procedures
- [ ] Test deployment pipeline end-to-end

## Phase 8: Cost Optimization

### 8.1 Resource Right-Sizing
- [ ] Monitor initial resource usage
- [ ] Adjust ECS task CPU/memory based on actual needs
- [ ] Consider using AWS Compute Savings Plans for long-term cost reduction
- [ ] Set up billing alerts and cost monitoring

### 8.2 Cost Optimization Strategies
- [ ] Use CloudFront caching effectively to reduce origin requests
- [ ] Configure S3 lifecycle policies if storing large amounts of data
- [ ] Consider using AWS Lambda for lightweight backend functions (alternative approach)
- [ ] Review and optimize data transfer costs

## Phase 9: Testing and Validation

### 9.1 Functional Testing
- [ ] Test all game functionality in production environment
- [ ] Verify WebSocket connections work correctly
- [ ] Test user authentication and session management
- [ ] Validate real-time multiplayer features

### 9.2 Performance Testing
- [ ] Load test WebSocket connections
- [ ] Test concurrent user scenarios
- [ ] Verify CDN performance from different geographical locations
- [ ] Monitor resource utilization under load

### 9.3 Security Testing
- [ ] Perform security audit of deployed infrastructure
- [ ] Test SSL certificate configuration
- [ ] Verify access controls and security groups
- [ ] Test for common web vulnerabilities

## Phase 10: Go-Live and Maintenance

### 10.1 Pre-Launch Checklist
- [ ] Final end-to-end testing
- [ ] DNS propagation verification
- [ ] SSL certificate validation
- [ ] Monitoring and alerting verification
- [ ] Backup and disaster recovery procedures

### 10.2 Launch
- [ ] Switch DNS to production environment
- [ ] Monitor system performance and errors
- [ ] Have rollback plan ready
- [ ] Document any issues and resolutions

### 10.3 Post-Launch Maintenance
- [ ] Set up regular security patching schedule
- [ ] Monitor costs and optimize as needed
- [ ] Plan for scaling if user base grows
- [ ] Regular backup and disaster recovery testing

## Estimated Costs (Monthly, Low Traffic)

### AWS Services Estimated Costs:
- **EC2 t3.micro**: ~$8-12/month (24/7, varies by region)
- **Elastic IP**: ~$3.65/month (if not attached to running instance)
- **CloudFront**: ~$1-5/month (low traffic)
- **S3**: ~$1-3/month (static assets)
- **Route 53**: ~$0.50/month (hosted zone)
- **Let's Encrypt SSL**: Free
- **CloudWatch**: ~$2-5/month (basic monitoring)

**Total estimated cost: $15-25/month** for low traffic deployment

## Alternative Low-Cost Approaches

### Option A: AWS Lambda + API Gateway (Serverless)
- Convert backend to Lambda functions
- Use API Gateway WebSocket API
- Potentially lower cost for very low traffic
- More complex WebSocket handling

### Option B: ECS Fargate (Original Plan)
- Use containerized deployment with ECS Fargate
- Application Load Balancer for WebSocket support
- Higher cost (~$45-70/month) but more scalable
- Automatic SSL certificate management with ACM

### Option C: AWS Amplify
- Use Amplify for frontend hosting
- Keep backend on ECS Fargate
- Simpler deployment for frontend
- Integrated with AWS services

## Key Considerations for WebSocket Applications

1. **Sticky Sessions**: May be required depending on your Socket.io configuration
2. **Connection Timeouts**: Configure appropriate timeout values for idle connections
3. **Health Checks**: Ensure health check endpoints don't interfere with WebSocket connections
4. **Scaling**: WebSocket connections are stateful, consider this when auto-scaling
5. **Error Handling**: Implement proper reconnection logic in frontend
6. **CORS**: Ensure WebSocket CORS is properly configured for production domains

## Security Best Practices

1. **Least Privilege**: Use IAM roles with minimal required permissions
2. **Network Security**: Use private subnets for backend services
3. **Encryption**: Enable encryption in transit and at rest where applicable
4. **Regular Updates**: Keep containers and dependencies updated
5. **Monitoring**: Set up security monitoring and alerting
6. **Backup**: Implement regular backup procedures for any persistent data

## Notes

- Start with minimal resources and scale up based on actual usage
- Consider using Infrastructure as Code (CDK/CloudFormation) for production deployments  
- Test WebSocket functionality thoroughly as ALB WebSocket support can have edge cases
- Monitor costs closely in the first month and adjust resources as needed
- Keep staging environment minimal to reduce costs