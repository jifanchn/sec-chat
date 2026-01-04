package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"sec-chat/server/config"
	"sec-chat/server/handlers"
	"sec-chat/server/store"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

func main() {
	// Initialize configuration
	cfg := config.Init()
	log.Printf("Starting SecChat server on port %d", cfg.Port)
	log.Printf("Password hash: %s", cfg.PasswordHash)

	// Initialize database
	_, err := store.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Get().Close()

	// Initialize WebSocket hub
	handlers.InitHub()

	// Setup routes
	http.HandleFunc("/ws", handleWS)
	http.Handle("/api/auth", corsMiddleware(http.HandlerFunc(handlers.HandleAuth)))
	http.Handle("/api/messages", corsMiddleware(http.HandlerFunc(handlers.HandleMessages)))
	http.Handle("/api/upload", corsMiddleware(http.HandlerFunc(handlers.HandleUpload)))
	http.Handle("/api/members", corsMiddleware(http.HandlerFunc(handlers.HandleMembers)))

	// Serve uploaded files with CORS support
	http.Handle("/uploads/", corsMiddleware(http.StripPrefix("/uploads/",
		http.FileServer(http.Dir(cfg.UploadDir)))))

	// Serve static files (frontend)
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "./static"
	}

	// Check if static directory exists
	if _, err := os.Stat(staticDir); err == nil {
		log.Printf("Serving static files from %s", staticDir)
		// Handle SPA routing - serve index.html for all non-API routes
		http.HandleFunc("/", spaHandler(staticDir))
	} else {
		log.Printf("Warning: Static directory %s not found, API only mode", staticDir)
	}

	// Start server
	addr := ":" + strconv.Itoa(cfg.Port)
	log.Printf("Server listening on %s", addr)

	// Add logging middleware
	handler := loggingMiddleware(http.DefaultServeMux)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

// handleWS upgrades HTTP to WebSocket
func handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	handlers.HandleWebSocket(conn)
}

// corsMiddleware adds CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware logs all requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[REQUEST] %s %s", r.Method, r.URL.RequestURI())
		next.ServeHTTP(w, r)
	})
}

// spaHandler serves static files and handles SPA routing
func spaHandler(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// If the request is for API, WebSocket, or uploads, skip static file serving
		if strings.HasPrefix(r.URL.Path, "/api/") ||
			strings.HasPrefix(r.URL.Path, "/ws") ||
			strings.HasPrefix(r.URL.Path, "/uploads/") {
			http.NotFound(w, r)
			return
		}

		// Try to serve the requested file
		path := filepath.Join(staticDir, r.URL.Path)
		if _, err := os.Stat(path); err == nil && !os.IsNotExist(err) {
			if strings.HasSuffix(path, ".js") {
				w.Header().Set("Content-Type", "application/javascript")
			} else if strings.HasSuffix(path, ".css") {
				w.Header().Set("Content-Type", "text/css")
			} else if strings.HasSuffix(path, ".html") {
				w.Header().Set("Content-Type", "text/html")
			}
			http.ServeFile(w, r, path)
			return
		}

		// If file not found, serve index.html for SPA routing
		indexPath := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			http.ServeFile(w, r, indexPath)
		} else {
			http.NotFound(w, r)
		}
	}
}
