#!/bin/bash
# Deploy Ollama to EC2 Ubuntu instance

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Clone your repo (replace with your actual repo)
# git clone <your-repo-url>
# cd <your-repo-name>

# Start Ollama container
docker-compose up -d

# Wait for Ollama to start
echo "Waiting for Ollama to start..."
sleep 10

# Pull the model
docker exec ollama ollama pull llama3.2:1b

# Set environment for production
export LLM_PROVIDER=ollama
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.2:1b

echo "Ollama deployment complete!"
echo "Test with: curl http://localhost:11434/api/tags"