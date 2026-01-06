# SecChat Makefile
# Build targets for multiple platforms

.PHONY: all build build-local build-linux-amd64 build-darwin-amd64 build-darwin-arm64 \
        build-frontend build-backend build-backend-local build-backend-linux-amd64 \
        build-backend-darwin-amd64 build-backend-darwin-arm64 docker deploy clean help dev

# ============================================================================
# Platform Detection
# ============================================================================

# Load deployment variables from .env file
-include .env

# Versioning
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || date +%Y%m%d%H%M%S)

# Default deployment values if not in .env
DEPLOY_HOST ?= your_server_ip
DEPLOY_USER ?= root
DEPLOY_PATH ?= /root/sec-chat
PASSWORD ?= 123456

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
	cd client && npm install --legacy-peer-deps && VITE_APP_VERSION=$(VERSION) npm run build:h5
	@echo "Frontend built to client/dist/build/h5"

# ============================================================================
# Backend Builds
# ============================================================================

# Build backend for current platform (auto-detect)
build-backend-local:
	@echo "Building backend for local platform ($(LOCAL_PLATFORM))..."
	cd server && go build -ldflags "-X 'sec-chat/server/config.AppVersion=$(VERSION)'" -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server ($(LOCAL_PLATFORM))"

# Build backend for Linux AMD64
build-backend-linux-amd64:
	@echo "Building backend for Linux AMD64..."
	cd server && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-X 'sec-chat/server/config.AppVersion=$(VERSION)'" -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (linux-amd64)"

# Build backend for Mac Intel
build-backend-darwin-amd64:
	@echo "Building backend for Mac Intel (darwin-amd64)..."
	cd server && CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "-X 'sec-chat/server/config.AppVersion=$(VERSION)'" -trimpath -o secchat-server .
	@echo "Backend built: server/secchat-server (darwin-amd64)"

# Build backend for Apple Silicon
build-backend-darwin-arm64:
	@echo "Building backend for Apple Silicon (darwin-arm64)..."
	cd server && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "-X 'sec-chat/server/config.AppVersion=$(VERSION)'" -trimpath -o secchat-server .
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

# Deploy to server
deploy: docker-save
	@echo "Uploading to server $(DEPLOY_HOST)..."
	scp secchat.tar.gz $(DEPLOY_USER)@$(DEPLOY_HOST):/tmp/
	@echo "Deploying on server..."
	ssh $(DEPLOY_USER)@$(DEPLOY_HOST) "docker load -i /tmp/secchat.tar.gz && cd $(DEPLOY_PATH) && docker-compose down && docker-compose up -d"
	@echo "Deployment complete!"

# Quick deploy (skip docker rebuild if image exists)
deploy-quick:
	@echo "Uploading to server $(DEPLOY_HOST)..."
	scp secchat.tar.gz $(DEPLOY_USER)@$(DEPLOY_HOST):/tmp/
	@echo "Deploying on server..."
	ssh $(DEPLOY_USER)@$(DEPLOY_HOST) "docker load -i /tmp/secchat.tar.gz && cd $(DEPLOY_PATH) && docker-compose down && docker-compose up -d"
	@echo "Deployment complete!"

# ============================================================================
# Development
# ============================================================================

# Run backend locally
run-backend:
	cd server && PASSWORD=$(PASSWORD) go run -ldflags "-X 'sec-chat/server/config.AppVersion=$(VERSION)'" .

# Run frontend dev server
run-frontend:
	cd client && npm run dev:h5

# Run both frontend and backend in tmux split panes
dev:
	@command -v tmux >/dev/null 2>&1 || { echo >&2 "tmux is required but not installed. Aborting."; exit 1; }
	@tmux has-session -t secchat 2>/dev/null && tmux kill-session -t secchat || true
	@# Start session with backend in main pane, holding open if it fails
	@tmux new-session -d -s secchat -n 'dev' 'sh -c "$(MAKE) run-backend; echo \"Backend exited. Press Enter...\"; read _"'
	@# Split horizontally for frontend
	@tmux split-window -h -t secchat:dev 'sh -c "$(MAKE) run-frontend; echo \"Frontend exited. Press Enter...\"; read _"'
	@echo "Tmux session 'secchat' started (split view). Attaching..."
	@tmux attach-session -t secchat

# ============================================================================
# E2E Testing
# ============================================================================

# Run all e2e tests
test-e2e:
	@echo "Running E2E tests..."
	cd e2e && npm test

# Run e2e tests in headless mode
test-e2e-headless:
	@echo "Running E2E tests (headless)..."
	cd e2e && npm run test:headless

# Run specific e2e test file
test-e2e-file:
	@echo "Running specific E2E test: $(FILE)"
	cd e2e && npx jest $(FILE)

# Run avatar tests specifically
test-avatar:
	@echo "Running avatar E2E tests..."
	cd e2e && npx jest 07_avatar.test.js --verbose

# Run long message tests specifically
test-long-message:
	@echo "Running long message E2E tests..."
	cd e2e && npx jest 08_long_message.test.js --verbose

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
	ssh $(DEPLOY_USER)@$(DEPLOY_HOST) "cd $(DEPLOY_PATH) && docker-compose logs -f"

# Check server status
status:
	ssh $(DEPLOY_USER)@$(DEPLOY_HOST) "docker ps | grep secchat"

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
	@echo "  dev               Run both in tmux windows"
	@echo ""
	@echo "E2E Testing:"
	@echo "  test-e2e          Run all E2E tests"
	@echo "  test-e2e-headless Run all E2E tests in headless mode"
	@echo "  test-avatar       Run avatar functionality tests"
	@echo "  test-long-message Run long message tests"
	@echo "  test-e2e-file FILE=<filename>  Run specific test file"
	@echo ""
	@echo "Utilities:"
	@echo "  clean             Remove build artifacts"
	@echo "  logs              View server logs"
	@echo "  status            Check server status"
	@echo "  help              Show this help"

