package crypto

import (
	"crypto/sha256"
	"encoding/hex"
)

// HashPassword generates SHA256 hash of the password
func HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// VerifyPassword checks if the provided hash matches the password
func VerifyPassword(password, hash string) bool {
	return HashPassword(password) == hash
}
