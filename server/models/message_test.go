package models

import (
	"testing"
	"time"
)

func TestNewMessage(t *testing.T) {
	msg := NewMessage(TypeText, "user1", "TestUser", "Hello World")

	if msg.ID == "" {
		t.Error("NewMessage() should generate an ID")
	}
	if msg.Type != TypeText {
		t.Errorf("NewMessage() Type = %v, want %v", msg.Type, TypeText)
	}
	if msg.From != "user1" {
		t.Errorf("NewMessage() From = %v, want %v", msg.From, "user1")
	}
	if msg.FromName != "TestUser" {
		t.Errorf("NewMessage() FromName = %v, want %v", msg.FromName, "TestUser")
	}
	if msg.Content != "Hello World" {
		t.Errorf("NewMessage() Content = %v, want %v", msg.Content, "Hello World")
	}
	if msg.Timestamp == 0 {
		t.Error("NewMessage() should set Timestamp")
	}
}

func TestNewMessageTypes(t *testing.T) {
	types := []MessageType{TypeText, TypeImage, TypeSystem, TypeRecall, TypeRead, TypeTyping}

	for _, msgType := range types {
		msg := NewMessage(msgType, "user1", "Test", "content")
		if msg.Type != msgType {
			t.Errorf("NewMessage() Type = %v, want %v", msg.Type, msgType)
		}
	}
}

func TestSystemMessage(t *testing.T) {
	msg := SystemMessage("User joined")

	if msg.ID == "" {
		t.Error("SystemMessage() should generate an ID")
	}
	if msg.Type != TypeSystem {
		t.Errorf("SystemMessage() Type = %v, want %v", msg.Type, TypeSystem)
	}
	if msg.From != "system" {
		t.Errorf("SystemMessage() From = %v, want %v", msg.From, "system")
	}
	if msg.FromName != "System" {
		t.Errorf("SystemMessage() FromName = %v, want %v", msg.FromName, "System")
	}
	if msg.Content != "User joined" {
		t.Errorf("SystemMessage() Content = %v, want %v", msg.Content, "User joined")
	}
}

func TestGenerateID(t *testing.T) {
	id1 := generateID()
	time.Sleep(time.Microsecond)
	id2 := generateID()

	if id1 == "" {
		t.Error("generateID() should not return empty string")
	}
	if id1 == id2 {
		t.Error("generateID() should generate unique IDs")
	}
}
