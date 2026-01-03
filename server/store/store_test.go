package store

import (
	"os"
	"testing"
	"time"

	"sec-chat/server/models"
)

func setupTestDB(t *testing.T) (*Store, func()) {
	// Create temp database file
	tmpFile, err := os.CreateTemp("", "test_*.db")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	tmpFile.Close()

	// Initialize store with temp database
	store, err := Init(tmpFile.Name())
	if err != nil {
		os.Remove(tmpFile.Name())
		t.Fatalf("Failed to initialize store: %v", err)
	}

	// Return cleanup function
	cleanup := func() {
		store.Close()
		os.Remove(tmpFile.Name())
	}

	return store, cleanup
}

func TestInit(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	if store == nil {
		t.Error("Init() should return a store")
	}
	if store.db == nil {
		t.Error("Init() should initialize database connection")
	}
}

func TestSaveAndGetMessages(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	// Create test messages
	msg1 := &models.Message{
		ID:        "msg1",
		Type:      models.TypeText,
		From:      "user1",
		FromName:  "User One",
		Content:   "Hello World",
		Timestamp: time.Now().UnixMilli(),
	}

	msg2 := &models.Message{
		ID:        "msg2",
		Type:      models.TypeText,
		From:      "user2",
		FromName:  "User Two",
		Content:   "Hi there",
		Timestamp: time.Now().UnixMilli() + 1000,
	}

	// Save messages
	if err := store.SaveMessage(msg1); err != nil {
		t.Errorf("SaveMessage() error = %v", err)
	}
	if err := store.SaveMessage(msg2); err != nil {
		t.Errorf("SaveMessage() error = %v", err)
	}

	// Get messages
	messages, err := store.GetMessages(time.Now().UnixMilli()+10000, 10)
	if err != nil {
		t.Errorf("GetMessages() error = %v", err)
	}

	if len(messages) != 2 {
		t.Errorf("GetMessages() returned %d messages, want 2", len(messages))
	}

	// Verify order (should be chronological)
	if messages[0].ID != "msg1" {
		t.Errorf("GetMessages() first message ID = %v, want msg1", messages[0].ID)
	}
	if messages[1].ID != "msg2" {
		t.Errorf("GetMessages() second message ID = %v, want msg2", messages[1].ID)
	}
}

func TestGetMessagesWithPagination(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	baseTime := time.Now().UnixMilli()

	// Create 5 messages
	for i := 0; i < 5; i++ {
		msg := &models.Message{
			ID:        "msg" + string(rune('0'+i)),
			Type:      models.TypeText,
			From:      "user1",
			FromName:  "Test",
			Content:   "Message " + string(rune('0'+i)),
			Timestamp: baseTime + int64(i*1000),
		}
		store.SaveMessage(msg)
	}

	// Get only 2 messages before a certain timestamp
	messages, err := store.GetMessages(baseTime+2500, 2)
	if err != nil {
		t.Errorf("GetMessages() error = %v", err)
	}

	if len(messages) != 2 {
		t.Errorf("GetMessages() returned %d messages, want 2", len(messages))
	}
}

func TestRecallMessage(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	msg := &models.Message{
		ID:        "msg_recall",
		Type:      models.TypeText,
		From:      "user1",
		FromName:  "Test",
		Content:   "To be recalled",
		Timestamp: time.Now().UnixMilli(),
		Recalled:  false,
	}

	store.SaveMessage(msg)
	store.RecallMessage("msg_recall")

	// Verify recall status
	messages, _ := store.GetMessages(time.Now().UnixMilli()+10000, 10)
	if len(messages) == 0 {
		t.Fatal("No messages found")
	}

	if !messages[0].Recalled {
		t.Error("RecallMessage() should set Recalled to true")
	}
}

func TestSaveAndGetUsers(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	user := &models.User{
		ID:       "user123",
		Name:     "Test User",
		Avatar:   "avatar.png",
		LastSeen: time.Now().UnixMilli(),
	}

	if err := store.SaveUser(user); err != nil {
		t.Errorf("SaveUser() error = %v", err)
	}

	users, err := store.GetUsers()
	if err != nil {
		t.Errorf("GetUsers() error = %v", err)
	}

	if len(users) != 1 {
		t.Errorf("GetUsers() returned %d users, want 1", len(users))
	}

	if users[0].ID != "user123" {
		t.Errorf("GetUsers() user ID = %v, want user123", users[0].ID)
	}
	if users[0].Name != "Test User" {
		t.Errorf("GetUsers() user Name = %v, want 'Test User'", users[0].Name)
	}
}

func TestSaveUserUpdate(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	user := &models.User{
		ID:       "user1",
		Name:     "Original Name",
		LastSeen: time.Now().UnixMilli(),
	}
	store.SaveUser(user)

	// Update user
	user.Name = "Updated Name"
	store.SaveUser(user)

	users, _ := store.GetUsers()
	if len(users) != 1 {
		t.Errorf("SaveUser() should update existing user, got %d users", len(users))
	}
	if users[0].Name != "Updated Name" {
		t.Errorf("SaveUser() should update name, got %v", users[0].Name)
	}
}

func TestMessageWithMentions(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	msg := &models.Message{
		ID:        "msg_mentions",
		Type:      models.TypeText,
		From:      "user1",
		FromName:  "Test",
		Content:   "Hello @user2 @user3",
		Timestamp: time.Now().UnixMilli(),
		Mentions:  []string{"user2", "user3"},
	}

	store.SaveMessage(msg)

	messages, _ := store.GetMessages(time.Now().UnixMilli()+10000, 10)
	if len(messages) == 0 {
		t.Fatal("No messages found")
	}

	if len(messages[0].Mentions) != 2 {
		t.Errorf("SaveMessage() should preserve mentions, got %d", len(messages[0].Mentions))
	}
}

func TestMessageWithReply(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	// Original message
	original := &models.Message{
		ID:        "original",
		Type:      models.TypeText,
		From:      "user1",
		FromName:  "User1",
		Content:   "Original message",
		Timestamp: time.Now().UnixMilli(),
	}
	store.SaveMessage(original)

	// Reply message
	reply := &models.Message{
		ID:        "reply",
		Type:      models.TypeText,
		From:      "user2",
		FromName:  "User2",
		Content:   "Reply to original",
		Timestamp: time.Now().UnixMilli() + 1000,
		ReplyTo:   "original",
	}
	store.SaveMessage(reply)

	messages, _ := store.GetMessages(time.Now().UnixMilli()+10000, 10)
	
	var replyMsg *models.Message
	for _, m := range messages {
		if m.ID == "reply" {
			replyMsg = m
			break
		}
	}

	if replyMsg == nil {
		t.Fatal("Reply message not found")
	}
	if replyMsg.ReplyTo != "original" {
		t.Errorf("SaveMessage() should preserve ReplyTo, got %v", replyMsg.ReplyTo)
	}
}
