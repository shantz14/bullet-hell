// Package store persists game data (boss roster, run history) in SQLite.
package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Boss struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Title   string `json:"title"`
	MaxHP   int    `json:"maxHp"`
	Order   int    `json:"order"`
	Palette string `json:"palette"`
}

type Run struct {
	ID         int64     `json:"id"`
	BossID     int       `json:"bossId"`
	Won        bool      `json:"won"`
	DurationMs int64     `json:"durationMs"`
	HeartsLeft int       `json:"heartsLeft"`
	CreatedAt  time.Time `json:"createdAt"`
}

type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS bosses (
	id         INTEGER PRIMARY KEY,
	name       TEXT    NOT NULL UNIQUE,
	title      TEXT    NOT NULL,
	max_hp     INTEGER NOT NULL,
	sort_order INTEGER NOT NULL,
	palette    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	boss_id     INTEGER NOT NULL REFERENCES bosses(id),
	won         INTEGER NOT NULL,
	duration_ms INTEGER NOT NULL,
	hearts_left INTEGER NOT NULL,
	created_at  TEXT    NOT NULL
);
`

var seedBosses = []Boss{
	{ID: 1, Name: "Gloomcap", Title: "the Rotting Sovereign", MaxHP: 400, Order: 1, Palette: "slime"},
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	for _, b := range seedBosses {
		_, err := db.Exec(`INSERT OR IGNORE INTO bosses (id, name, title, max_hp, sort_order, palette)
			VALUES (?, ?, ?, ?, ?, ?)`, b.ID, b.Name, b.Title, b.MaxHP, b.Order, b.Palette)
		if err != nil {
			return nil, fmt.Errorf("seed boss %s: %w", b.Name, err)
		}
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Bosses() ([]Boss, error) {
	rows, err := s.db.Query(`SELECT id, name, title, max_hp, sort_order, palette FROM bosses ORDER BY sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Boss
	for rows.Next() {
		var b Boss
		if err := rows.Scan(&b.ID, &b.Name, &b.Title, &b.MaxHP, &b.Order, &b.Palette); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (s *Store) RecordRun(r Run) (int64, error) {
	res, err := s.db.Exec(`INSERT INTO runs (boss_id, won, duration_ms, hearts_left, created_at) VALUES (?, ?, ?, ?, ?)`,
		r.BossID, r.Won, r.DurationMs, r.HeartsLeft, time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) RecentRuns(limit int) ([]Run, error) {
	rows, err := s.db.Query(`SELECT id, boss_id, won, duration_ms, hearts_left, created_at FROM runs ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Run
	for rows.Next() {
		var r Run
		var created string
		if err := rows.Scan(&r.ID, &r.BossID, &r.Won, &r.DurationMs, &r.HeartsLeft, &created); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = time.Parse(time.RFC3339, created)
		out = append(out, r)
	}
	return out, rows.Err()
}
