// Package notificationapi quản lý chuông thông báo và là điểm ghi dùng chung
// của các module nghiệp vụ Go.
package notificationapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"sync"
	"time"

	"vendorhub/internal/realtime"
)

var publisher struct {
	sync.RWMutex
	value realtime.Publisher
}

func ConfigurePublisher(value realtime.Publisher) {
	publisher.Lock()
	publisher.value = value
	publisher.Unlock()
}

type Execer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func Send(ctx context.Context, db Execer, userID int64, kind, title, body string, data any) (int64, error) {
	var encoded any
	if data != nil {
		raw, err := json.Marshal(data)
		if err != nil {
			return 0, err
		}
		encoded = raw
	}
	now := time.Now().UTC()
	result, err := db.ExecContext(ctx, `INSERT INTO notifications (user_id,type,title,body,is_read,data,created_at,updated_at) VALUES (?,?,?,?,0,?,?,?)`, userID, kind, title, nullable(body), encoded, now, now)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	publisher.RLock()
	stream := publisher.value
	publisher.RUnlock()
	if stream != nil {
		stream.Trigger("notifications", "NotificationCreated", map[string]any{"notificationId": id, "userId": userID})
	}
	return id, nil
}

func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}
