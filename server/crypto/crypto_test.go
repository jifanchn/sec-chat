package crypto

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantLen  int
	}{
		{
			name:     "simple password",
			password: "test123",
			wantLen:  64, // SHA256 hex output is 64 characters
		},
		{
			name:     "empty password",
			password: "",
			wantLen:  64,
		},
		{
			name:     "unicode password",
			password: "密码测试123",
			wantLen:  64,
		},
		{
			name:     "long password",
			password: "this-is-a-very-long-password-that-should-still-work-correctly",
			wantLen:  64,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash := HashPassword(tt.password)
			if len(hash) != tt.wantLen {
				t.Errorf("HashPassword() hash length = %d, want %d", len(hash), tt.wantLen)
			}
		})
	}
}

func TestHashPasswordConsistency(t *testing.T) {
	password := "test123"
	hash1 := HashPassword(password)
	hash2 := HashPassword(password)

	if hash1 != hash2 {
		t.Errorf("HashPassword() should return consistent results, got %s and %s", hash1, hash2)
	}
}

func TestHashPasswordUniqueness(t *testing.T) {
	hash1 := HashPassword("password1")
	hash2 := HashPassword("password2")

	if hash1 == hash2 {
		t.Errorf("HashPassword() should return different hashes for different passwords")
	}
}

func TestVerifyPassword(t *testing.T) {
	password := "test123"
	hash := HashPassword(password)

	tests := []struct {
		name     string
		password string
		hash     string
		want     bool
	}{
		{
			name:     "correct password",
			password: password,
			hash:     hash,
			want:     true,
		},
		{
			name:     "wrong password",
			password: "wrong123",
			hash:     hash,
			want:     false,
		},
		{
			name:     "empty password",
			password: "",
			hash:     hash,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := VerifyPassword(tt.password, tt.hash); got != tt.want {
				t.Errorf("VerifyPassword() = %v, want %v", got, tt.want)
			}
		})
	}
}
