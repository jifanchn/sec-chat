package store

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"

	"sec-chat/server/models"

	_ "github.com/glebarez/sqlite"
)

// Store handles data persistence
type Store struct {
	db    *sql.DB
	mutex sync.RWMutex
}

var instance *Store

// Init initializes the database
func Init(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	instance = &Store{db: db}

	// Create tables
	if err := instance.createTables(); err != nil {
		return nil, err
	}

	return instance, nil
}

// Get returns the store instance
func Get() *Store {
	return instance
}

// createTables creates necessary database tables
func (s *Store) createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		from_id TEXT NOT NULL,
		from_name TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		reply_to TEXT,
		mentions TEXT,
		recalled INTEGER DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		avatar TEXT,
		last_seen INTEGER
	);
	`
	_, err := s.db.Exec(schema)
	return err
}

// SaveMessage saves a message to database
func (s *Store) SaveMessage(msg *models.Message) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	mentions, _ := json.Marshal(msg.Mentions)

	_, err := s.db.Exec(`
		INSERT INTO messages (id, type, from_id, from_name, content, timestamp, reply_to, mentions, recalled)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, msg.ID, msg.Type, msg.From, msg.FromName, msg.Content, msg.Timestamp, msg.ReplyTo, string(mentions), msg.Recalled)

	return err
}

// GetMessages retrieves messages with pagination
func (s *Store) GetMessages(beforeTimestamp int64, limit int) ([]*models.Message, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	query := `
		SELECT id, type, from_id, from_name, content, timestamp, reply_to, mentions, recalled
		FROM messages
		WHERE timestamp < ?
		ORDER BY timestamp DESC
		LIMIT ?
	`

	rows, err := s.db.Query(query, beforeTimestamp, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]*models.Message, 0)
	for rows.Next() {
		msg := &models.Message{}
		var mentions string
		var replyTo sql.NullString

		err := rows.Scan(&msg.ID, &msg.Type, &msg.From, &msg.FromName, &msg.Content,
			&msg.Timestamp, &replyTo, &mentions, &msg.Recalled)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			continue
		}

		if replyTo.Valid {
			msg.ReplyTo = replyTo.String
		}
		json.Unmarshal([]byte(mentions), &msg.Mentions)
		messages = append(messages, msg)
	}

	// Reverse to get chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// RecallMessage marks a message as recalled
func (s *Store) RecallMessage(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, err := s.db.Exec("UPDATE messages SET recalled = 1 WHERE id = ?", id)
	return err
}

// SaveUser saves or updates a user
func (s *Store) SaveUser(user *models.User) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, err := s.db.Exec(`
		INSERT OR REPLACE INTO users (id, name, avatar, last_seen)
		VALUES (?, ?, ?, ?)
	`, user.ID, user.Name, user.Avatar, user.LastSeen)

	return err
}

// GetUsers retrieves all users
func (s *Store) GetUsers() ([]*models.User, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	rows, err := s.db.Query("SELECT id, name, avatar, last_seen FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]*models.User, 0)
	for rows.Next() {
		user := &models.User{}
		var avatar sql.NullString

		err := rows.Scan(&user.ID, &user.Name, &avatar, &user.LastSeen)
		if err != nil {
			continue
		}
		if avatar.Valid {
			user.Avatar = avatar.String
		}
		users = append(users, user)
	}

	return users, nil
}

// Close closes the database connection
func (s *Store) Close() error {
	return s.db.Close()
}
