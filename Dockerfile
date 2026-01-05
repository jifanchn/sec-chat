# SecChat Docker Image
# Uses pre-built frontend and backend binaries for fast builds
# Build with: make docker

# Use scratch as base for copying pre-built artifacts
FROM scratch AS pre-built

# Copy pre-built backend binary (Linux AMD64)
# Build with: CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o secchat-server .
COPY server/secchat-server /app/server/secchat-server

# Copy pre-built frontend
# Build with: cd client && npm run build:h5
COPY client/dist/build/h5 /app/static

# Final runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite

# Create app directory
WORKDIR /app

# Create necessary directories
RUN mkdir -p /app/data/uploads && \
    chown -R nobody:nogroup /app

# Copy backend binary
COPY --from=pre-built /app/server/secchat-server /app/

# Copy frontend static files
COPY --from=pre-built /app/static /app/static

# Switch to non-root user
USER nobody

# Expose port
EXPOSE 7023

# Set environment variables
ENV PASSWORD=secret123
ENV PORT=7023
ENV DB_PATH=/app/data/chat.db
ENV UPLOAD_DIR=/app/data/uploads
ENV STATIC_DIR=/app/static

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7023/ || exit 1

# Run the application
CMD ["/app/secchat-server"]
