package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
	"sec-chat/server/config"
	"sec-chat/server/handlers"
	"sec-chat/server/store"
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
	http.HandleFunc("/api/auth", corsMiddleware(handlers.HandleAuth))
	http.HandleFunc("/api/messages", corsMiddleware(handlers.HandleMessages))
	http.HandleFunc("/api/upload", corsMiddleware(handlers.HandleUpload))
	http.HandleFunc("/api/members", corsMiddleware(handlers.HandleMembers))

	// Serve uploaded files
	http.Handle("/uploads/", http.StripPrefix("/uploads/", 
		http.FileServer(http.Dir(cfg.UploadDir))))

	// Start server
	addr := ":" + strconv.Itoa(cfg.Port)
	log.Printf("Server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
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
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}
