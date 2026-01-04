package handlers

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"sec-chat/server/config"
	"sec-chat/server/models"
	"sec-chat/server/store"

	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket client
type Client struct {
	conn     *websocket.Conn
	user     *models.User
	send     chan []byte
	hub      *Hub
	verified bool
}

// Hub manages all WebSocket clients
type Hub struct {
	clients    map[*Client]bool
	users      map[string]*Client // userID -> client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

var hub *Hub

// InitHub initializes the WebSocket hub
func InitHub() *Hub {
	hub = &Hub{
		clients:    make(map[*Client]bool),
		users:      make(map[string]*Client),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
	go hub.run()
	return hub
}

// GetHub returns the hub instance
func GetHub() *Hub {
	return hub
}

// run handles hub events
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if client.user != nil {
					delete(h.users, client.user.ID)
					// Notify others about user leaving
					msg := models.SystemMessage(client.user.Name + " left the chat")
					h.broadcastMessage(msg)
					// Broadcast updated users list
					usersMsg := map[string]interface{}{
						"type":  "users",
						"users": h.getOnlineUsersUnlocked(),
					}
					data, _ := json.Marshal(usersMsg)
					h.broadcast <- data
				}
				close(client.send)
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				if client.verified {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// broadcastMessage sends a message to all clients
func (h *Hub) broadcastMessage(msg *models.Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	h.broadcast <- data
}

// GetOnlineUsers returns list of online users
func (h *Hub) GetOnlineUsers() []*models.User {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return h.getOnlineUsersUnlocked()
}

// getOnlineUsersUnlocked returns list of online users without locking (caller must hold lock)
func (h *Hub) getOnlineUsersUnlocked() []*models.User {
	var users []*models.User
	// Use users map to avoid duplicates (same user with multiple connections)
	for _, client := range h.users {
		if client.verified && client.user != nil {
			client.user.Online = true
			users = append(users, client.user)
		}
	}
	return users
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	ID        string          `json:"id,omitempty"`
	From      string          `json:"from,omitempty"`
	FromName  string          `json:"fromName,omitempty"`
	Content   string          `json:"content,omitempty"`
	Timestamp int64           `json:"timestamp,omitempty"`
	ReplyTo   string          `json:"replyTo,omitempty"`
	Mentions  []string        `json:"mentions,omitempty"`
}

// AuthPayload for authentication
type AuthPayload struct {
	PasswordHash string `json:"passwordHash"`
	UserID       string `json:"userId"`
	UserName     string `json:"userName"`
}

// HandleWebSocket handles WebSocket connections
func HandleWebSocket(conn *websocket.Conn) {
	client := &Client{
		conn:     conn,
		send:     make(chan []byte, 256),
		hub:      hub,
		verified: false,
	}

	hub.register <- client

	go client.writePump()
	client.readPump()
}

// readPump reads messages from the WebSocket
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(10 * 1024 * 1024) // 10MB max message size
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

// writePump writes messages to the WebSocket
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming messages
func (c *Client) handleMessage(data []byte) {
	var msg WSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("Error parsing message: %v", err)
		return
	}

	switch msg.Type {
	case "auth":
		c.handleAuth(msg)
	case "text", "image":
		c.handleChatMessage(msg)
	case "typing":
		c.handleTyping(msg)
	case "recall":
		c.handleRecall(msg)
	case "read":
		c.handleRead(msg)
	}
}

// handleAuth handles authentication
func (c *Client) handleAuth(msg WSMessage) {
	var auth AuthPayload
	if err := json.Unmarshal(msg.Payload, &auth); err != nil {
		c.sendError("Invalid auth payload")
		return
	}

	cfg := config.Get()
	if auth.PasswordHash != cfg.PasswordHash {
		c.sendError("Invalid password")
		c.conn.Close()
		return
	}

	// Create user
	c.user = models.NewUser(auth.UserID, auth.UserName)
	c.verified = true

	// Register user
	c.hub.mutex.Lock()
	c.hub.users[c.user.ID] = c
	c.hub.mutex.Unlock()

	// Save user to database
	store.Get().SaveUser(c.user)

	// Send auth success
	c.sendJSON(map[string]interface{}{
		"type":    "auth_success",
		"userId":  c.user.ID,
		"message": "Authentication successful",
	})

	// Notify others
	sysMsg := models.SystemMessage(c.user.Name + " joined the chat")
	store.Get().SaveMessage(sysMsg)
	c.hub.broadcastMessage(sysMsg)

	// Broadcast online users to all clients
	usersMsg := map[string]interface{}{
		"type":  "users",
		"users": c.hub.GetOnlineUsers(),
	}
	data, _ := json.Marshal(usersMsg)
	c.hub.broadcast <- data
}

// handleChatMessage handles text and image messages
func (c *Client) handleChatMessage(msg WSMessage) {
	if !c.verified || c.user == nil {
		c.sendError("Not authenticated")
		return
	}

	chatMsg := &models.Message{
		ID:        msg.ID,
		Type:      models.MessageType(msg.Type),
		From:      c.user.ID,
		FromName:  c.user.Name,
		Content:   msg.Content,
		Timestamp: time.Now().UnixMilli(),
		ReplyTo:   msg.ReplyTo,
		Mentions:  msg.Mentions,
	}

	// Save to database
	if err := store.Get().SaveMessage(chatMsg); err != nil {
		log.Printf("Error saving message: %v", err)
	}

	// Broadcast to all clients
	c.hub.broadcastMessage(chatMsg)
}

// handleTyping handles typing indicators
func (c *Client) handleTyping(msg WSMessage) {
	if !c.verified || c.user == nil {
		return
	}

	typingMsg := map[string]interface{}{
		"type":     "typing",
		"userId":   c.user.ID,
		"userName": c.user.Name,
	}
	data, _ := json.Marshal(typingMsg)
	c.hub.broadcast <- data
}

// handleRecall handles message recall
func (c *Client) handleRecall(msg WSMessage) {
	if !c.verified || c.user == nil {
		return
	}

	// Update database
	store.Get().RecallMessage(msg.ID)

	// Broadcast recall
	recallMsg := map[string]interface{}{
		"type":      "recall",
		"id":        msg.ID,
		"userId":    c.user.ID,
		"userName":  c.user.Name,
		"timestamp": time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(recallMsg)
	c.hub.broadcast <- data
}

// handleRead handles read receipts
func (c *Client) handleRead(msg WSMessage) {
	if !c.verified || c.user == nil {
		return
	}

	readMsg := map[string]interface{}{
		"type":      "read",
		"messageId": msg.ID,
		"userId":    c.user.ID,
		"timestamp": time.Now().UnixMilli(),
	}
	data, _ := json.Marshal(readMsg)
	c.hub.broadcast <- data
}

// sendError sends an error message to client
func (c *Client) sendError(message string) {
	c.sendJSON(map[string]interface{}{
		"type":    "error",
		"message": message,
	})
}

// sendJSON sends a JSON message to client
func (c *Client) sendJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}
