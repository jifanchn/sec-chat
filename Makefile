# SecChat Makefile

# Default password for development
PASSWORD ?= secret123
PORT ?= 8080

.PHONY: all server client dev build clean install

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

# Help
help:
	@echo "SecChat Makefile Commands:"
	@echo "  make install  - Install client dependencies"
	@echo "  make dev      - Start both server and client (default)"
	@echo "  make server   - Start server only"
	@echo "  make client   - Start client only"
	@echo "  make build    - Build server binary"
	@echo "  make test     - Run server tests"
	@echo "  make clean    - Clean build artifacts"
	@echo ""
	@echo "Environment variables:"
	@echo "  PASSWORD=xxx  - Server password (default: secret123)"
	@echo "  PORT=xxxx     - Server port (default: 8080)"
