package models

import (
	"fmt"
	"time"
)

// MessageType defines the type of message
type MessageType string

const (
	TypeText    MessageType = "text"
	TypeImage   MessageType = "image"
	TypeSystem  MessageType = "system"
	TypeRecall  MessageType = "recall"
	TypeRead    MessageType = "read"
	TypeTyping  MessageType = "typing"
)

// Message represents a chat message
type Message struct {
	ID        string      `json:"id"`
	Type      MessageType `json:"type"`
	From      string      `json:"from"`
	FromName  string      `json:"fromName"`
	Content   string      `json:"content"`   // Encrypted content
	Timestamp int64       `json:"timestamp"`
	ReplyTo   string      `json:"replyTo,omitempty"`
	Mentions  []string    `json:"mentions,omitempty"`
	Recalled  bool        `json:"recalled,omitempty"`
}

// NewMessage creates a new message with current timestamp
func NewMessage(msgType MessageType, from, fromName, content string) *Message {
	return &Message{
		ID:        generateID(),
		Type:      msgType,
		From:      from,
		FromName:  fromName,
		Content:   content,
		Timestamp: time.Now().UnixMilli(),
	}
}

// SystemMessage creates a system notification message
func SystemMessage(content string) *Message {
	return &Message{
		ID:        generateID(),
		Type:      TypeSystem,
		From:      "system",
		FromName:  "System",
		Content:   content,
		Timestamp: time.Now().UnixMilli(),
	}
}

// generateID creates a unique message ID
func generateID() string {
	return fmt.Sprintf("%s-%d", time.Now().Format("20060102150405.000000"), time.Now().UnixNano()%1000000)
}
