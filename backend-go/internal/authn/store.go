package authn

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/crc32"
	"strconv"
	"strings"
	"sync"
	"time"
)

var ErrUnauthenticated = errors.New("unauthenticated")

type Store struct {
	db *sql.DB

	seenMu sync.Mutex
	seenAt map[int64]time.Time
}

func NewStore(db *sql.DB) *Store { return &Store{db: db, seenAt: make(map[int64]time.Time)} }

const userColumns = `u.id, u.name, u.full_name, u.email, u.password, u.role, u.project,
 u.pd_projects, u.seller_name, u.avatar_url, u.is_active`

type scanner interface{ Scan(...any) error }

func scanUser(row scanner) (User, error) {
	var u User
	var fullName, password, project, pdProjects, sellerName, avatarURL sql.NullString
	if err := row.Scan(&u.ID, &u.Name, &fullName, &u.Email, &password, &u.Role, &project,
		&pdProjects, &sellerName, &avatarURL, &u.IsActive); err != nil {
		return User{}, err
	}
	u.FullName = nullString(fullName)
	u.Password = nullString(password)
	u.Project = nullString(project)
	if pdProjects.Valid {
		u.PDProjects = []byte(pdProjects.String)
	}
	u.SellerName = nullString(sellerName)
	u.AvatarURL = nullString(avatarURL)
	return u, nil
}

func nullString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	v := value.String
	return &v
}

func (s *Store) ActiveAccountsByEmail(ctx context.Context, email string) ([]User, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+userColumns+` FROM users u
 WHERE LOWER(u.email) = ? AND u.is_active = 1 ORDER BY u.id`, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *Store) ActiveUserForSelection(ctx context.Context, id int64, email string) (User, error) {
	return scanUser(s.db.QueryRowContext(ctx, `SELECT `+userColumns+` FROM users u
 WHERE u.id = ? AND LOWER(u.email) = ? AND u.is_active = 1 LIMIT 1`, id, strings.ToLower(email)))
}

func (s *Store) ProjectsFor(ctx context.Context, user User) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT DISTINCT project FROM users
 WHERE LOWER(email) = ? AND role = ? AND is_active = 1 AND project IS NOT NULL
 ORDER BY project`, strings.ToLower(user.Email), user.Role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := []string{}
	for rows.Next() {
		var project string
		if err := rows.Scan(&project); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

// CreateToken ghi đúng định dạng Laravel Sanctum: id|plain, còn DB chỉ giữ SHA-256.
func (s *Store) CreateToken(ctx context.Context, userID int64, name string) (string, error) {
	entropy, err := randomAlphaNumeric(40)
	if err != nil {
		return "", err
	}
	plain := entropy + fmt.Sprintf("%08x", crc32.ChecksumIEEE([]byte(entropy)))
	hash := sha256.Sum256([]byte(plain))
	now := time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `INSERT INTO personal_access_tokens
 (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
 VALUES (?, ?, ?, ?, ?, ?, ?)`, `App\Models\User`, userID, name, hex.EncodeToString(hash[:]), `["*"]`, now, now)
	if err != nil {
		return "", err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(id, 10) + "|" + plain, nil
}

func randomAlphaNumeric(n int) (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	out := make([]byte, n)
	buf := make([]byte, n*2)
	for i := 0; i < n; {
		if _, err := rand.Read(buf); err != nil {
			return "", err
		}
		for _, b := range buf {
			// 248 là bội lớn nhất của 62 dưới 256; bỏ phần dư để tránh modulo bias.
			if b >= 248 {
				continue
			}
			out[i] = alphabet[int(b)%len(alphabet)]
			i++
			if i == n {
				break
			}
		}
	}
	return string(out), nil
}

func (s *Store) Authenticate(ctx context.Context, bearer string) (User, int64, error) {
	bearer = strings.TrimSpace(bearer)
	if bearer == "" {
		return User{}, 0, ErrUnauthenticated
	}

	var row *sql.Row
	plain := bearer
	if id, token, found := strings.Cut(bearer, "|"); found {
		if _, err := strconv.ParseInt(id, 10, 64); err != nil {
			return User{}, 0, ErrUnauthenticated
		}
		plain = token
		row = s.db.QueryRowContext(ctx, `SELECT pat.id, pat.token, pat.expires_at, `+userColumns+`
 FROM personal_access_tokens pat JOIN users u ON u.id = pat.tokenable_id
 WHERE pat.id = ? AND pat.tokenable_type = ? LIMIT 1`, id, `App\Models\User`)
	} else {
		hash := sha256.Sum256([]byte(plain))
		row = s.db.QueryRowContext(ctx, `SELECT pat.id, pat.token, pat.expires_at, `+userColumns+`
 FROM personal_access_tokens pat JOIN users u ON u.id = pat.tokenable_id
 WHERE pat.token = ? AND pat.tokenable_type = ? LIMIT 1`, hex.EncodeToString(hash[:]), `App\Models\User`)
	}

	var tokenID int64
	var storedHash string
	var expires sql.NullTime
	var u User
	var fullName, password, project, pdProjects, sellerName, avatarURL sql.NullString
	err := row.Scan(&tokenID, &storedHash, &expires, &u.ID, &u.Name, &fullName, &u.Email,
		&password, &u.Role, &project, &pdProjects, &sellerName, &avatarURL, &u.IsActive)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, 0, ErrUnauthenticated
	}
	if err != nil {
		return User{}, 0, err
	}
	hash := sha256.Sum256([]byte(plain))
	want, err := hex.DecodeString(storedHash)
	if err != nil || len(want) != len(hash) || subtle.ConstantTimeCompare(hash[:], want) != 1 {
		return User{}, 0, ErrUnauthenticated
	}
	if !u.IsActive || (expires.Valid && time.Now().UTC().After(expires.Time)) {
		return User{}, 0, ErrUnauthenticated
	}
	u.FullName, u.Password, u.Project = nullString(fullName), nullString(password), nullString(project)
	if pdProjects.Valid {
		u.PDProjects = []byte(pdProjects.String)
	}
	u.SellerName, u.AvatarURL = nullString(sellerName), nullString(avatarURL)

	now := time.Now().UTC()
	_, _ = s.db.ExecContext(ctx, `UPDATE personal_access_tokens SET last_used_at = ? WHERE id = ?`, now, tokenID)
	s.touchLastSeen(ctx, u.ID, now)
	return u, tokenID, nil
}

func (s *Store) touchLastSeen(ctx context.Context, userID int64, now time.Time) {
	s.seenMu.Lock()
	last, seen := s.seenAt[userID]
	if seen && now.Sub(last) < 5*time.Minute {
		s.seenMu.Unlock()
		return
	}
	s.seenAt[userID] = now
	s.seenMu.Unlock()
	// Dữ liệu phụ trợ: giống Laravel, lỗi hoặc thiếu cột không được làm hỏng request.
	_, _ = s.db.ExecContext(ctx, `UPDATE users SET last_seen_at = ? WHERE id = ?`, now, userID)
}

func (s *Store) DeleteToken(ctx context.Context, tokenID, userID int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM personal_access_tokens
 WHERE id = ? AND tokenable_id = ? AND tokenable_type = ?`, tokenID, userID, `App\Models\User`)
	return err
}
