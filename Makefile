# SecChat Makefile
# Build targets for multiple platforms

.PHONY: all build build-local build-linux-amd64 build-darwin-amd64 build-darwin-arm64 \
        build-frontend build-backend build-backend-local build-backend-linux-amd64 \
        build-backend-darwin-amd64 build-backend-darwin-arm64 docker deploy clean help

# ============================================================================
# Platform Detection
# ============================================================================

# Detect current OS and architecture
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

# Map to Go GOOS/GOARCH
ifeq ($(UNAME_S),Darwin)
    LOCAL_GOOS := darwin
else ifeq ($(UNAME_S),Linux)
    LOCAL_GOOS := linux
else
    LOCAL_GOOS := $(shell echo $(UNAME_S) | tr '[:upper:]' '[:lower:]')
endif

ifeq ($(UNAME_M),x86_64)
    LOCAL_GOARCH := amd64
else ifeq ($(UNAME_M),arm64)
    LOCAL_GOARCH := arm64
else ifeq ($(UNAME_M),aarch64)
    LOCAL_GOARCH := arm64
else
    LOCAL_GOARCH := $(UNAME_M)
endif

LOCAL_PLATFORM := $(LOCAL_GOOS)-$(LOCAL_GOARCH)

# Default target
all: build-local

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

# Build backend for current platform (auto-detect)
build-backend-local:
	@echo "Building backend for local platform ($(LOCAL_PLATFORM))..."
	cd server && go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server ($(LOCAL_PLATFORM))"

# Build backend for Linux AMD64
build-backend-linux-amd64:
	@echo "Building backend for Linux AMD64..."
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (linux-amd64)"

# Build backend for Mac Intel
build-backend-darwin-amd64:
	@echo "Building backend for Mac Intel (darwin-amd64)..."
	cd server && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (darwin-amd64)"

# Build backend for Apple Silicon
build-backend-darwin-arm64:
	@echo "Building backend for Apple Silicon (darwin-arm64)..."
	cd server && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (darwin-arm64)"

# Alias for common targets
build-backend: build-backend-local

# ============================================================================
# Combined Builds
# ============================================================================

# Build everything for local platform (auto-detect)
build-local: build-frontend build-backend-local
	@echo "Local build complete ($(LOCAL_PLATFORM))!"

# Build everything for Linux AMD64 (deployment)
build-linux-amd64: build-frontend build-backend-linux-amd64
	@echo "Linux AMD64 build complete!"

# Build everything for Mac Intel
build-darwin-amd64: build-frontend build-backend-darwin-amd64
	@echo "Mac Intel build complete!"

# Build everything for Apple Silicon
build-darwin-arm64: build-frontend build-backend-darwin-arm64
	@echo "Apple Silicon build complete!"

# Alias for build-local
build: build-local

# ============================================================================
# Docker & Deployment
# ============================================================================

# Build Docker image (requires Linux AMD64 backend)
docker: build-linux-amd64
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
	@echo "Build (auto-detected platform: $(LOCAL_PLATFORM)):"
	@echo "  build-local             Build for local platform - frontend + backend"
	@echo "  build-linux-amd64       Build for Linux AMD64 - frontend + backend"
	@echo "  build-darwin-amd64      Build for Mac Intel - frontend + backend"
	@echo "  build-darwin-arm64      Build for Apple Silicon - frontend + backend"
	@echo "  build-frontend          Build frontend only"
	@echo "  build-backend-local     Build backend for local platform"
	@echo "  build-backend-linux-amd64   Build backend for Linux AMD64"
	@echo "  build-backend-darwin-amd64  Build backend for Mac Intel"
	@echo "  build-backend-darwin-arm64  Build backend for Apple Silicon"
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

