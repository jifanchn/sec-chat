# SecChat Makefile
# Build targets for local development (mac) and deployment (amd64)

.PHONY: all build build-mac build-amd64 build-frontend build-backend \
        build-backend-mac build-backend-amd64 docker deploy clean help

# Default target
all: build-mac

# ============================================================================
# Frontend Builds
# ============================================================================

# Build frontend (H5)
build-frontend:
	@echo "Building frontend..."
	cd client && npm install --legacy-peer-deps && npm run build:h5
	@echo "Frontend built to client/dist/build/h5"

# ============================================================================
# Backend Builds
# ============================================================================

# Build backend for current platform (Mac ARM64)
build-backend-mac:
	@echo "Building backend for Mac (ARM64)..."
	cd server && go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (Mac ARM64)"

# Build backend for deployment (Linux AMD64)
build-backend-amd64:
	@echo "Building backend for Linux AMD64..."
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (Linux AMD64)"

# ============================================================================
# Combined Builds
# ============================================================================

# Build everything for Mac (local development)
build-mac: build-frontend build-backend-mac
	@echo "Mac build complete!"

# Build everything for AMD64 (deployment)
build-amd64: build-frontend build-backend-amd64
	@echo "AMD64 build complete!"

# Alias for build-mac
build: build-mac

# ============================================================================
# Docker & Deployment
# ============================================================================

# Build Docker image (requires AMD64 backend)
docker: build-amd64
	@echo "Building Docker image..."
	docker buildx build --platform linux/amd64 -t secchat:latest .
	@echo "Docker image built: secchat:latest"

# Package Docker image for transfer
docker-save: docker
	@echo "Saving Docker image..."
	docker save secchat:latest | gzip > secchat.tar.gz
	@echo "Docker image saved: secchat.tar.gz"

# Deploy to server (101.37.37.87)
deploy: docker-save
	@echo "Uploading to server..."
	scp secchat.tar.gz root@101.37.37.87:/tmp/
	@echo "Deploying on server..."
	ssh root@101.37.37.87 "docker load -i /tmp/secchat.tar.gz && cd /root/sec-chat && docker-compose down && docker-compose up -d"
	@echo "Deployment complete!"

# Quick deploy (skip docker rebuild if image exists)
deploy-quick:
	@echo "Uploading to server..."
	scp secchat.tar.gz root@101.37.37.87:/tmp/
	@echo "Deploying on server..."
	ssh root@101.37.37.87 "docker load -i /tmp/secchat.tar.gz && cd /root/sec-chat && docker-compose down && docker-compose up -d"
	@echo "Deployment complete!"

# ============================================================================
# Development
# ============================================================================

# Run backend locally
run-backend:
	cd server && go run .

# Run frontend dev server
run-frontend:
	cd client && npm run dev:h5

# ============================================================================
# Utilities
# ============================================================================

# Clean build artifacts
clean:
	rm -f server/secchat-server
	rm -f secchat.tar.gz
	rm -rf client/dist
	rm -rf client/unpackage
	@echo "Cleaned build artifacts"

# Show server logs
logs:
	ssh root@101.37.37.87 "cd /root/sec-chat && docker-compose logs -f"

# Check server status
status:
	ssh root@101.37.37.87 "docker ps | grep secchat"

# Help
help:
	@echo "SecChat Makefile Targets:"
	@echo ""
	@echo "Build:"
	@echo "  build-mac         Build for Mac (ARM64) - frontend + backend"
	@echo "  build-amd64       Build for Linux AMD64 - frontend + backend"
	@echo "  build-frontend    Build frontend only"
	@echo "  build-backend-mac Build backend for Mac"
	@echo "  build-backend-amd64 Build backend for Linux AMD64"
	@echo ""
	@echo "Docker & Deploy:"
	@echo "  docker            Build Docker image"
	@echo "  docker-save       Build and save Docker image to tar.gz"
	@echo "  deploy            Full deploy: build, package, upload, start"
	@echo "  deploy-quick      Quick deploy: upload existing tar.gz"
	@echo ""
	@echo "Development:"
	@echo "  run-backend       Run backend locally"
	@echo "  run-frontend      Run frontend dev server"
	@echo ""
	@echo "Utilities:"
	@echo "  clean             Remove build artifacts"
	@echo "  logs              View server logs"
	@echo "  status            Check server status"
	@echo "  help              Show this help"
