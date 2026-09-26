package notificationapi

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/realtime"
)

type recordingPublisher struct {
	channel, event string
	payload        any
	calls          int
}

func (p *recordingPublisher) Trigger(channel, event string, data any) {
	p.channel, p.event, p.payload = channel, event, data
	p.calls++
}

var _ realtime.Publisher = (*recordingPublisher)(nil)

func TestSendGhiDungCotVaPhatRealtime(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	pub := &recordingPublisher{}
	ConfigurePublisher(pub)
	t.Cleanup(func() { ConfigurePublisher(nil) })

	mock.ExpectExec("INSERT INTO notifications").
		WithArgs(int64(7), "approved", "Đã duyệt", "Sản phẩm đã được duyệt", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(42, 1))

	id, err := Send(context.Background(), db, 7, "approved", "Đã duyệt", "Sản phẩm đã được duyệt", map[string]any{"productId": 5})
	if err != nil {
		t.Fatalf("Send lỗi: %v", err)
	}
	if id != 42 {
		t.Errorf("id = %d, muốn 42", id)
	}
	if pub.calls != 1 || pub.channel != "notifications" || pub.event != "NotificationCreated" {
		t.Errorf("publisher = %+v", pub)
	}
	payload, ok := pub.payload.(map[string]any)
	if !ok || payload["notificationId"] != int64(42) || payload["userId"] != int64(7) {
		t.Errorf("payload = %v", pub.payload)
	}
}

// body rỗng phải ghi NULL, không phải chuỗi rỗng — khớp cách PHP xử lý.
func TestSendBodyRongGhiNull(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ConfigurePublisher(nil)

	mock.ExpectExec("INSERT INTO notifications").
		WithArgs(int64(1), "info", "Tiêu đề", nil, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if _, err := Send(context.Background(), db, 1, "info", "Tiêu đề", "", nil); err != nil {
		t.Fatalf("Send lỗi: %v", err)
	}
}

// Không có publisher cấu hình (server chưa bật Pusher) không được panic —
// Send phải im lặng bỏ qua bước phát realtime.
func TestSendKhongCoPublisherKhongPanic(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ConfigurePublisher(nil)

	mock.ExpectExec("INSERT INTO notifications").WillReturnResult(sqlmock.NewResult(1, 1))

	if _, err := Send(context.Background(), db, 1, "info", "T", "B", nil); err != nil {
		t.Fatalf("Send lỗi: %v", err)
	}
}

// Lỗi ghi DB phải được trả ra, không nuốt im lặng và không phát realtime cho
// một bản ghi chưa từng tồn tại.
func TestSendLoiDbKhongPhatRealtime(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	pub := &recordingPublisher{}
	ConfigurePublisher(pub)
	t.Cleanup(func() { ConfigurePublisher(nil) })

	mock.ExpectExec("INSERT INTO notifications").WillReturnError(sqlmock.ErrCancelled)

	if _, err := Send(context.Background(), db, 1, "info", "T", "B", nil); err == nil {
		t.Fatal("muốn lỗi khi INSERT thất bại")
	}
	if pub.calls != 0 {
		t.Error("không được phát realtime khi ghi DB thất bại")
	}
}
