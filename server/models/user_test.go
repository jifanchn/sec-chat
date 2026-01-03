package models

import (
	"testing"
	"time"
)

func TestNewUser(t *testing.T) {
	user := NewUser("user123", "TestUser")

	if user.ID != "user123" {
		t.Errorf("NewUser() ID = %v, want %v", user.ID, "user123")
	}
	if user.Name != "TestUser" {
		t.Errorf("NewUser() Name = %v, want %v", user.Name, "TestUser")
	}
	if user.Avatar != "" {
		t.Errorf("NewUser() Avatar should be empty, got %v", user.Avatar)
	}
	if !user.Online {
		t.Error("NewUser() Online should be true")
	}
	if user.LastSeen == 0 {
		t.Error("NewUser() should set LastSeen")
	}
}

func TestUserSetOnline(t *testing.T) {
	user := NewUser("user1", "Test")
	initialLastSeen := user.LastSeen

	time.Sleep(time.Millisecond)
	user.SetOnline(false)

	if user.Online {
		t.Error("SetOnline(false) should set Online to false")
	}
	if user.LastSeen <= initialLastSeen {
		t.Error("SetOnline() should update LastSeen")
	}

	time.Sleep(time.Millisecond)
	prevLastSeen := user.LastSeen
	user.SetOnline(true)

	if !user.Online {
		t.Error("SetOnline(true) should set Online to true")
	}
	if user.LastSeen <= prevLastSeen {
		t.Error("SetOnline() should update LastSeen")
	}
}
