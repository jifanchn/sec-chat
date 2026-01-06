package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"sec-chat/server/config"
	"sec-chat/server/crypto"
	"sec-chat/server/models"
	"sec-chat/server/store"
)

// AuthRequest represents authentication request body
type AuthRequest struct {
	PasswordHash string `json:"passwordHash"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// HandleAuth handles password verification
func HandleAuth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, AuthResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	cfg := config.Get()
	if !crypto.VerifyPassword(cfg.Password, req.PasswordHash) {
		sendJSON(w, http.StatusUnauthorized, AuthResponse{
			Success: false,
			Message: "Invalid password",
		})
		return
	}

	sendJSON(w, http.StatusOK, AuthResponse{
		Success: true,
		Message: "Authentication successful",
	})
}

// HandleMessages handles message history retrieval
func HandleMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	beforeStr := r.URL.Query().Get("before")
	limitStr := r.URL.Query().Get("limit")

	before := time.Now().UnixMilli()
	if beforeStr != "" {
		if b, err := strconv.ParseInt(beforeStr, 10, 64); err == nil {
			before = b
		}
	}

	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	messages, err := store.Get().GetMessages(before, limit)
	if err != nil {
		log.Printf("Error getting messages: %v", err)
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to retrieve messages",
		})
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
		"hasMore":  len(messages) == limit,
	})
}

// HandleUpload handles file uploads
func HandleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit upload size to 10MB
	r.ParseMultipartForm(10 << 20)

	file, header, err := r.FormFile("file")
	if err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Failed to read file",
		})
		return
	}
	defer file.Close()

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := time.Now().Format("20060102150405") + "_" + randomString(8) + ext

	cfg := config.Get()
	filepath := filepath.Join(cfg.UploadDir, filename)

	// Create file
	dst, err := os.Create(filepath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to save file",
		})
		return
	}
	defer dst.Close()

	// Copy content
	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("Error saving file: %v", err)
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to save file",
		})
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"url":      "/uploads/" + filename,
		"filename": filename,
	})
}

// HandleMembers returns list of members
func HandleMembers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get all users from database
	users, err := store.Get().GetUsers()
	if err != nil {
		log.Printf("Error getting users: %v", err)
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to retrieve members",
		})
		return
	}

	// Mark online users
	onlineUsers := GetHub().GetOnlineUsers()
	onlineMap := make(map[string]bool)
	for _, u := range onlineUsers {
		onlineMap[u.ID] = true
	}

	for _, u := range users {
		u.Online = onlineMap[u.ID]
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"members": users,
	})
}

// sendJSON sends a JSON response
func sendJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// randomString generates a random string
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

// HandleAvatarUpdate handles avatar updates
func HandleAvatarUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID string `json:"userId"`
		Avatar string `json:"avatar"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
		return
	}

	if req.UserID == "" || req.Avatar == "" {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Missing userId or avatar",
		})
		return
	}

	// Update user in database
	// We need to fetch the existing user first to preserve other fields
	// But Store.SaveUser uses REPLACE INTO, so we need all fields.
	// Actually, Store.SaveUser takes a *models.User.
	// Let's get the user first.
	users, err := store.Get().GetUsers()
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to get users",
		})
		return
	}

	var targetUser *models.User
	for _, u := range users {
		if u.ID == req.UserID {
			targetUser = u
			break
		}
	}

	if targetUser == nil {
		sendJSON(w, http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
		return
	}

	targetUser.Avatar = req.Avatar
	if err := store.Get().SaveUser(targetUser); err != nil {
		sendJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to update user",
		})
		return
	}

	// Broadcast user update via WebSocket
	// We can reuse the "users" list broadcast since it contains all info
	GetHub().UpdateUserAvatar(req.UserID, req.Avatar)
	GetHub().BroadcastUsers()

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"avatar":  req.Avatar,
	})
}
