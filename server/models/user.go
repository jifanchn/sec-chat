package models

import "time"

// User represents a chat user
type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Avatar    string `json:"avatar"`
	Online    bool   `json:"online"`
	LastSeen  int64  `json:"lastSeen"`
}

// NewUser creates a new user
func NewUser(id, name string) *User {
	return &User{
		ID:       id,
		Name:     name,
		Avatar:   "",
		Online:   true,
		LastSeen: time.Now().UnixMilli(),
	}
}

// SetOnline updates user online status
func (u *User) SetOnline(online bool) {
	u.Online = online
	u.LastSeen = time.Now().UnixMilli()
}
