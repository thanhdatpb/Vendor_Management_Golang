package libraryapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

type Row struct {
	ID        int64
	Data      []byte
	UpdatedAt time.Time
}
type Meta struct {
	ID        int64
	UpdatedAt time.Time
}

type Store struct{ db *sql.DB }

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) Meta(ctx context.Context) (Meta, error) {
	var m Meta
	err := s.db.QueryRowContext(ctx, `SELECT id, updated_at FROM vendor_library ORDER BY id LIMIT 1`).Scan(&m.ID, &m.UpdatedAt)
	return m, err
}

func (s *Store) First(ctx context.Context) (Row, error) {
	var r Row
	err := s.db.QueryRowContext(ctx, `SELECT id, data, updated_at FROM vendor_library ORDER BY id LIMIT 1`).Scan(&r.ID, &r.Data, &r.UpdatedAt)
	return r, err
}

func (s *Store) Save(ctx context.Context, raw []byte) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	err = tx.QueryRowContext(ctx, `SELECT id FROM vendor_library ORDER BY id LIMIT 1 FOR UPDATE`).Scan(&id)
	now := time.Now().UTC()
	switch {
	case errors.Is(err, sql.ErrNoRows):
		_, err = tx.ExecContext(ctx, `INSERT INTO vendor_library (data, created_at, updated_at) VALUES (?, ?, ?)`, raw, now, now)
	case err == nil:
		_, err = tx.ExecContext(ctx, `UPDATE vendor_library SET data = ?, updated_at = ? WHERE id = ?`, raw, now, id)
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) UpdateGeneralField(ctx context.Context, rowID, field string, value any) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	var raw []byte
	if err := tx.QueryRowContext(ctx, `SELECT id, data FROM vendor_library ORDER BY id LIMIT 1 FOR UPDATE`).Scan(&id, &raw); err != nil {
		return err
	}
	files, err := decodeFiles(raw)
	if err != nil {
		return ErrInvalidData
	}
	found := false
	for _, item := range files {
		file, ok := item.(map[string]any)
		if !ok {
			continue
		}
		rows, ok := file["generalInfo"].([]any)
		if !ok {
			continue
		}
		for _, item := range rows {
			row, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if anyString(row["id"]) == rowID {
				row[field] = value
				found = true
			}
		}
	}
	if !found {
		return ErrRowNotFound
	}
	encoded, err := marshalNoEscape(files)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE vendor_library SET data = ?, updated_at = ? WHERE id = ?`, encoded, time.Now().UTC(), id); err != nil {
		return err
	}
	return tx.Commit()
}

var (
	ErrInvalidData = errors.New("invalid library data")
	ErrRowNotFound = errors.New("library row not found")
)

func decodeFiles(raw []byte) ([]any, error) {
	var files []any
	dec := json.NewDecoder(bytesReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&files); err != nil {
		return nil, err
	}
	return files, nil
}
