package config

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"log"
	"os"
	"path/filepath"
	"strconv"
)

// Config holds the server configuration
type Config struct {
	Port         int
	Password     string
	PasswordHash string
	DBPath       string
	UploadDir    string
	Version      string
}

var cfg *Config
var AppVersion string

// Init initializes configuration from command line arguments and environment variables
func Init() *Config {
	cfg = &Config{}

	// Set defaults
	cfg.Port = 8080
	cfg.DBPath = "./data/chat.db"
	cfg.UploadDir = "./data/uploads"

	// Read from environment variables first
	if portStr := os.Getenv("PORT"); portStr != "" {
		if port, err := strconv.Atoi(portStr); err == nil {
			cfg.Port = port
		}
	}
	if password := os.Getenv("PASSWORD"); password != "" {
		cfg.Password = password
	}
	if dbPath := os.Getenv("DB_PATH"); dbPath != "" {
		cfg.DBPath = dbPath
	}
	if uploadDir := os.Getenv("UPLOAD_DIR"); uploadDir != "" {
		cfg.UploadDir = uploadDir
	}

	// Command line arguments override environment variables
	flag.IntVar(&cfg.Port, "port", cfg.Port, "Server port")
	flag.StringVar(&cfg.Password, "password", cfg.Password, "Chat room password (required)")
	flag.StringVar(&cfg.DBPath, "db", cfg.DBPath, "Database file path")
	flag.StringVar(&cfg.UploadDir, "uploads", cfg.UploadDir, "Upload directory")
	flag.Parse()

	if cfg.Password == "" {
		log.Fatal("Password is required. Use -password flag or PASSWORD environment variable")
	}

	// Generate password hash for verification
	hash := sha256.Sum256([]byte(cfg.Password))
	cfg.PasswordHash = hex.EncodeToString(hash[:])

	// Ensure directories exist
	ensureDir(filepath.Dir(cfg.DBPath))
	ensureDir(cfg.UploadDir)

	cfg.Version = AppVersion
	if cfg.Version == "" {
		cfg.Version = "dev"
	}

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
