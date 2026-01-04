# SecChat Makefile

# Default password for development
PASSWORD ?= secret123
PORT ?= 8080

.PHONY: all server client dev build clean install test e2e e2e-install

# Start both server and client
all: dev

# Install dependencies
install:
	cd client && npm install --legacy-peer-deps

# Build server binary
build:
	cd server && go build -o secchat-server .

# Start server only
server: build
	cd server && ./secchat-server -password $(PASSWORD) -port $(PORT)

# Start client only (H5 dev mode)
client:
	cd client && npm run dev:h5

# Start both in background with logs
dev:
	@echo "Starting SecChat..."
	@echo "Server: http://localhost:$(PORT)"
	@echo "Client: http://localhost:5173"
	@echo "Password: $(PASSWORD)"
	@echo ""
	@make -j2 _server _client

_server: build
	cd server && ./secchat-server -password $(PASSWORD) -port $(PORT) 2>&1 | tee server.log

_client:
	cd client && npm run dev:h5

# Clean build artifacts
clean:
	rm -f server/secchat-server
	rm -f server/server.log
	rm -rf server/data/
	rm -rf client/dist/
	rm -rf client/unpackage/

# Run server tests
test:
	cd server && go test ./... -v

# Install E2E test dependencies
e2e-install:
	cd e2e && npm install

# Run E2E tests (starts server & client automatically on test ports)
e2e: build e2e-install
	@echo "Starting E2E tests..."
	@rm -rf server/data_test/
	@cd server && ./secchat-server -password test123 -port 8081 -db data_test/chat.db > test_server.log 2>&1 & echo $$! > /tmp/secchat-server-test.pid
	@sleep 5
	@cd client && npm run dev:h5 -- --port 5174 & echo $$! > /tmp/secchat-client-test.pid
	@sleep 10
	@cd e2e && BASE_URL=http://localhost:5174 WS_URL=ws://localhost:8081/ws npm test || true
	@kill `cat /tmp/secchat-server-test.pid` 2>/dev/null || true
	@kill `cat /tmp/secchat-client-test.pid` 2>/dev/null || true
	@pkill -f "secchat-server" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@rm -rf server/data_test/
	@echo "E2E tests completed"

# Help
help:
	@echo "SecChat Makefile Commands:"
	@echo "  make install     - Install client dependencies"
	@echo "  make dev         - Start both server and client (default)"
	@echo "  make server      - Start server only"
	@echo "  make client      - Start client only"
	@echo "  make build       - Build server binary"
	@echo "  make test        - Run server tests"
	@echo "  make e2e         - Run E2E tests"
	@echo "  make e2e-install - Install E2E dependencies"
	@echo "  make clean       - Clean build artifacts"
	@echo ""
	@echo "Environment variables:"
	@echo "  PASSWORD=xxx  - Server password (default: secret123)"
	@echo "  PORT=xxxx     - Server port (default: 8080)"


# Docker commands
docker-build:
	@echo "Building Docker image..."
	@docker build -t secchat:latest .

docker-run: docker-build
	@echo "Running Docker container..."
	@docker run -d \
		--name secchat \
		-p 8080:8080 \
		-e PASSWORD=$(PASSWORD) \
		-v secchat_data:/app/data \
		--restart unless-stopped \
		secchat:latest

docker-stop:
	@echo "Stopping Docker container..."
	@docker stop secchat || true
	@docker rm secchat || true

docker-logs:
	@docker logs -f secchat

docker-compose-up:
	@echo "Starting with docker-compose..."
	@docker-compose up -d

docker-compose-down:
	@echo "Stopping with docker-compose..."
	@docker-compose down

docker-compose-logs:
	@docker-compose logs -f

# Docker commands
docker-build:
	echo "Building Docker image..."
	docker build -t secchat:latest .

docker-run: docker-build
	echo "Running Docker container..."
	docker run -d \\
		--name secchat \\
		-p 8080:8080 \\
		-e PASSWORD=$(PASSWORD) \\
		-v secchat_data:/app/data \\
		--restart unless-stopped \\
		secchat:latest

docker-stop:
	docker stop secchat || true
	docker rm secchat || true

docker-logs:
	docker logs -f secchat

docker-compose-up:
	echo "Starting with docker-compose..."
	docker-compose up -d

docker-compose-down:
	echo "Stopping with docker-compose..."
	docker-compose down

docker-compose-logs:
	docker-compose logs -f
