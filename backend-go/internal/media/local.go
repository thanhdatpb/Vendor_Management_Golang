// Package media provides the local-disk half of Laravel's HandlesMediaStorage
// contract. Object-storage support is configured separately and is a cutover gate.
package media

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Object struct {
	Body        io.ReadCloser
	ContentType string
	Size        int64
	Modified    time.Time
}

type Storage interface {
	Save(context.Context, *multipart.FileHeader, string, int64, bool) (string, string, error)
	SavePath(context.Context, string, string, int64, bool) (string, string, error)
	DeleteURL(context.Context, string) error
	Read(context.Context, string, string) (Object, error)
}

type Local struct{ Root string }

var imageExtensions = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
var videoExtensions = map[string]bool{".mp4": true, ".webm": true}

func (s Local) Save(_ context.Context, file *multipart.FileHeader, folder string, maxBytes int64, videos bool) (string, string, error) {
	if file == nil || file.Size <= 0 || file.Size > maxBytes {
		return "", "", errors.New("kích thước media không hợp lệ")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !imageExtensions[ext] && !(videos && videoExtensions[ext]) {
		return "", "", errors.New("định dạng media không được hỗ trợ")
	}
	dir := filepath.Join(s.Root, folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", err
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", "", err
	}
	name := hex.EncodeToString(random[:]) + ext
	source, err := file.Open()
	if err != nil {
		return "", "", err
	}
	defer source.Close()
	destination, err := os.OpenFile(filepath.Join(dir, name), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", "", err
	}
	written, copyErr := io.Copy(destination, io.LimitReader(source, maxBytes+1))
	closeErr := destination.Close()
	if copyErr != nil || closeErr != nil || written > maxBytes {
		_ = os.Remove(filepath.Join(dir, name))
		return "", "", errors.New("không thể lưu media")
	}
	key := folder + "/" + name
	return key, "/storage/" + key, nil
}

func (s Local) SavePath(_ context.Context, sourcePath, folder string, maxBytes int64, videos bool) (string, string, error) {
	info, err := os.Stat(sourcePath)
	if err != nil || info.Size() <= 0 || info.Size() > maxBytes {
		return "", "", errors.New("kích thước media không hợp lệ")
	}
	ext := strings.ToLower(filepath.Ext(sourcePath))
	if !imageExtensions[ext] && !(videos && videoExtensions[ext]) {
		return "", "", errors.New("định dạng media không được hỗ trợ")
	}
	dir := filepath.Join(s.Root, folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", err
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", "", err
	}
	name := hex.EncodeToString(random[:]) + ext
	source, err := os.Open(sourcePath)
	if err != nil {
		return "", "", err
	}
	defer source.Close()
	destinationPath := filepath.Join(dir, name)
	destination, err := os.OpenFile(destinationPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", "", err
	}
	written, copyErr := io.Copy(destination, io.LimitReader(source, maxBytes+1))
	closeErr := destination.Close()
	if copyErr != nil || closeErr != nil || written > maxBytes {
		_ = os.Remove(destinationPath)
		return "", "", errors.New("không thể lưu media")
	}
	key := folder + "/" + name
	return key, "/storage/" + key, nil
}

func (s Local) DeleteURL(_ context.Context, raw string) error {
	key := Key(raw)
	if key == "" {
		return nil
	}
	target, err := s.resolve(key)
	if err != nil {
		return err
	}
	err = os.Remove(target)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (s Local) Read(_ context.Context, folder, filename string) (Object, error) {
	if filepath.Base(filename) != filename || filename == "." || filename == "" {
		return Object{}, os.ErrNotExist
	}
	file, err := os.Open(filepath.Join(s.Root, folder, filename))
	if err != nil {
		return Object{}, err
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return Object{}, err
	}
	return Object{Body: file, ContentType: mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))), Size: info.Size(), Modified: info.ModTime()}, nil
}

func Key(raw string) string {
	if parsed, err := url.Parse(raw); err == nil && parsed.Path != "" {
		raw = parsed.Path
	}
	raw = strings.TrimPrefix(raw, "/")
	raw = strings.TrimPrefix(raw, "storage/")
	for _, folder := range []string{"products/", "vendors/", "vendor-library/"} {
		if index := strings.Index(raw, folder); index >= 0 {
			return raw[index:]
		}
	}
	return ""
}

func (s Local) resolve(key string) (string, error) {
	root, err := filepath.Abs(s.Root)
	if err != nil {
		return "", err
	}
	target, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(key)))
	if err != nil {
		return "", err
	}
	if target != root && !strings.HasPrefix(target, root+string(os.PathSeparator)) {
		return "", errors.New("media path vượt ngoài thư mục cho phép")
	}
	return target, nil
}
