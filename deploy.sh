#!/bin/bash

# Nature vs NPC Deployment Script
# Usage: ./deploy.sh [frontend|backend|shared|full]

set -e  # Exit on any error

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration - Load from environment variables
SERVER="${DEPLOY_SERVER:-ec2-user@your-server-ip}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/your-key.pem}"
SERVER_PATH="${DEPLOY_SERVER_PATH:-/home/ec2-user/nature-npc}"

# Check required environment variables
if [ "$SERVER" = "ec2-user@your-server-ip" ] || [ "$SSH_KEY" = "~/.ssh/your-key.pem" ]; then
    echo "⚠️  Please set deployment environment variables:"
    echo "   export DEPLOY_SERVER='ec2-user@your-server-ip'"
    echo "   export DEPLOY_SSH_KEY='~/.ssh/your-key.pem'"
    echo "   export DEPLOY_SERVER_PATH='/home/ec2-user/nature-npc'"
    echo ""
    echo "Or create a .env file in the project root with these variables."
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if SSH key exists
check_ssh_key() {
    if [ ! -f ~/.ssh/nature-npc-key.pem ]; then
        error "SSH key not found at ~/.ssh/nature-npc-key.pem"
    fi
}

# Deploy shared package
deploy_shared() {
    log "Deploying shared package..."
    
    cd shared
    log "Building shared package..."
    npm run build || error "Failed to build shared package"
    
    log "Deploying shared files to server..."
    scp -i $SSH_KEY -r dist/ ${SERVER}:${SERVER_PATH}/shared/ || error "Failed to deploy shared dist"
    scp -i $SSH_KEY package.json ${SERVER}:${SERVER_PATH}/shared/ || error "Failed to deploy shared package.json"
    
    success "Shared package deployed"
    cd ..
}

# Deploy backend
deploy_backend() {
    log "Deploying backend..."
    
    cd backend
    log "Building backend..."
    npm run build || error "Failed to build backend"
    
    log "Deploying backend files to server..."
    scp -i $SSH_KEY -r dist/ ${SERVER}:${SERVER_PATH}/backend/ || error "Failed to deploy backend dist"
    
    log "Restarting backend service..."
    ssh -i $SSH_KEY $SERVER "pm2 restart nature-npc-backend" || error "Failed to restart backend"
    
    success "Backend deployed and restarted"
    cd ..
}

# Deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    
    cd frontend
    log "Building frontend..."
    NODE_ENV=production npm run build || error "Failed to build frontend"
    
    log "Deploying frontend files to server..."
    scp -i $SSH_KEY -r dist/ ${SERVER}:${SERVER_PATH}/frontend/ || error "Failed to deploy frontend dist"
    
    success "Frontend deployed"
    cd ..
}

# Deploy environment variables
deploy_env() {
    log "Deploying environment variables..."
    
    if [ -f "backend/.env" ]; then
        scp -i $SSH_KEY backend/.env ${SERVER}:${SERVER_PATH}/backend/ || error "Failed to deploy .env file"
        ssh -i $SSH_KEY $SERVER "pm2 restart nature-npc-backend" || error "Failed to restart backend after env update"
        success "Environment variables deployed"
    else
        warning "No .env file found in backend/"
    fi
}

# Deploy Nginx configuration
deploy_nginx() {
    log "Deploying Nginx configuration..."
    
    if [ -f "nginx.conf" ]; then
        scp -i $SSH_KEY nginx.conf ${SERVER}:/tmp/nature-npc.conf || error "Failed to upload Nginx config"
        ssh -i $SSH_KEY $SERVER "sudo cp /tmp/nature-npc.conf /etc/nginx/conf.d/nature-npc.conf" || error "Failed to install Nginx config"
        ssh -i $SSH_KEY $SERVER "sudo nginx -t" || error "Nginx config syntax error"
        ssh -i $SSH_KEY $SERVER "sudo systemctl reload nginx" || error "Failed to reload Nginx"
        success "Nginx configuration deployed"
    else
        warning "No nginx.conf file found"
    fi
}

# Show server status
show_status() {
    log "Checking server status..."
    
    echo ""
    echo "=== PM2 Status ==="
    ssh -i $SSH_KEY $SERVER "pm2 status" || warning "Could not get PM2 status"
    
    echo ""
    echo "=== Nginx Status ==="
    ssh -i $SSH_KEY $SERVER "sudo systemctl status nginx --no-pager -l" || warning "Could not get Nginx status"
    
    echo ""
    echo "=== SSL Certificate Status ==="
    ssh -i $SSH_KEY $SERVER "sudo certbot certificates" || warning "Could not get SSL certificate status"
}

# Main deployment logic
main() {
    check_ssh_key
    
    case "${1:-full}" in
        "frontend")
            deploy_frontend
            ;;
        "backend")
            deploy_shared  # Backend depends on shared
            deploy_backend
            ;;
        "shared")
            deploy_shared
            deploy_backend  # Restart backend to pick up shared changes
            ;;
        "env")
            deploy_env
            ;;
        "nginx")
            deploy_nginx
            ;;
        "status")
            show_status
            ;;
        "full")
            log "Starting full deployment..."
            deploy_shared
            deploy_backend
            deploy_frontend
            deploy_nginx
            success "Full deployment completed!"
            ;;
        *)
            echo "Usage: $0 [frontend|backend|shared|env|nginx|status|full]"
            echo ""
            echo "Commands:"
            echo "  frontend  - Deploy only frontend changes"
            echo "  backend   - Deploy backend (includes shared)"
            echo "  shared    - Deploy shared package (restarts backend)"
            echo "  env       - Deploy environment variables"
            echo "  nginx     - Deploy Nginx configuration"
            echo "  status    - Show server status"
            echo "  full      - Deploy everything (default)"
            exit 1
            ;;
    esac
    
    echo ""
    success "Deployment completed! Visit https://nature-vs-npc.com"
}

# Run main function with all arguments
main "$@"