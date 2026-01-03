package config

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"log"
	"os"
	"path/filepath"
)

// Config holds the server configuration
type Config struct {
	Port         int
	Password     string
	PasswordHash string
	DBPath       string
	UploadDir    string
}

var cfg *Config

// Init initializes configuration from command line arguments
func Init() *Config {
	cfg = &Config{}

	flag.IntVar(&cfg.Port, "port", 8080, "Server port")
	flag.StringVar(&cfg.Password, "password", "", "Chat room password (required)")
	flag.StringVar(&cfg.DBPath, "db", "./data/chat.db", "Database file path")
	flag.StringVar(&cfg.UploadDir, "uploads", "./data/uploads", "Upload directory")
	flag.Parse()

	if cfg.Password == "" {
		log.Fatal("Password is required. Use -password flag")
	}

	// Generate password hash for verification
	hash := sha256.Sum256([]byte(cfg.Password))
	cfg.PasswordHash = hex.EncodeToString(hash[:])

	// Ensure directories exist
	ensureDir(filepath.Dir(cfg.DBPath))
	ensureDir(cfg.UploadDir)

	return cfg
}

// Get returns the current configuration
func Get() *Config {
	return cfg
}

// ensureDir creates directory if it doesn't exist
func ensureDir(path string) {
	if err := os.MkdirAll(path, 0755); err != nil {
		log.Fatalf("Failed to create directory %s: %v", path, err)
	}
}
