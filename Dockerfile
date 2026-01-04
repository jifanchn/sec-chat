# Multi-stage build for SecChat application
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Install dependencies with Chinese mirror
RUN npm config set registry https://registry.npmmirror.com

# Copy package files
COPY client/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source code
COPY client/ ./

# Build frontend for H5
RUN npm run build:h5

# Stage 2: Build backend
FROM golang:1.21-alpine AS backend-builder

WORKDIR /app/server

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Copy go mod files
COPY server/go.mod server/go.sum ./

# Download Go dependencies with proxy
RUN go mod download

# Copy backend source code
COPY server/ ./

# Build backend binary for AMD64
ENV CGO_ENABLED=1 GOOS=linux GOARCH=amd64
RUN go build -a -installsuffix cgo -o secchat-server .

# Stage 3: Final runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite

# Create app directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/data/uploads && \
    chown -R nobody:nogroup /app

# Copy backend binary from builder
COPY --from=backend-builder /app/server/secchat-server /app/

# Copy frontend build from builder
COPY --from=frontend-builder /app/client/dist/build/h5 /app/static

# Copy any other necessary files
COPY server/migrations /app/migrations

# Switch to non-root user
USER nobody

# Expose port
EXPOSE 8080

# Set environment variables
ENV PASSWORD=secret123
ENV PORT=8080
ENV DB_PATH=/app/data/chat.db
ENV UPLOAD_DIR=/app/data/uploads
ENV STATIC_DIR=/app/static

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run the application
CMD ["/app/secchat-server"]
