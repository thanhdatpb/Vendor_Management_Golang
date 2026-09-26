package notificationapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/authn"
)

func requestAs(userID int64) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	return r.WithContext(authn.ContextWithPrincipal(r.Context(), authn.Principal{User: authn.User{ID: userID}}))
}

var notifColumns = []string{
	"id", "user_id", "type", "title", "body", "is_read", "data",
	"email_status", "email_sent_at", "email_error", "created_at", "updated_at",
}

func TestIndexTraDanhSachVaSoChuaDoc(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Date(2026, 9, 26, 10, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows(notifColumns).
		AddRow(int64(1), int64(7), "approved", "Tiêu đề", "Nội dung", false, `{"productId":5}`, nil, nil, nil, now, now)
	mock.ExpectQuery("SELECT id,user_id,type,title,body,is_read,data").WithArgs(int64(7)).WillReturnRows(rows)
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM notifications").WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	w := httptest.NewRecorder()
	h.Index(w, requestAs(7))

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"unread":3`) {
		t.Errorf("thiếu unread=3: %s", body)
	}
	if !strings.Contains(body, `"productId":5`) {
		t.Errorf("cột data JSON không được decode: %s", body)
	}
	// Datetime phải theo dạng Eloquent: 6 chữ số micro + chữ Z.
	if !strings.Contains(body, `"2026-09-26T10:00:00.000000Z"`) {
		t.Errorf("created_at sai định dạng: %s", body)
	}
}

// Không có thông báo nào phải ra mảng rỗng, không phải null.
func TestIndexRongTraMangRong(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	mock.ExpectQuery("SELECT id,user_id,type,title,body,is_read,data").
		WillReturnRows(sqlmock.NewRows(notifColumns))
	mock.ExpectQuery("SELECT COUNT").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	w := httptest.NewRecorder()
	h.Index(w, requestAs(1))

	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"data":[]`) {
		t.Fatalf("status=%d body=%s, muốn data:[]", w.Code, w.Body.String())
	}
}

// Cột data JSON hỏng không được làm vỡ cả response — về nil, các trường khác vẫn trả.
func TestIndexDataJsonHongVanTraCacTruongKhac(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	rows := sqlmock.NewRows(notifColumns).
		AddRow(int64(1), int64(1), "approved", "Tiêu đề", nil, true, "khong phai json", nil, nil, nil, now, now)
	mock.ExpectQuery("SELECT id,user_id,type,title,body,is_read,data").WillReturnRows(rows)
	mock.ExpectQuery("SELECT COUNT").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	w := httptest.NewRecorder()
	h.Index(w, requestAs(1))

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"data":null`) {
		t.Errorf("data JSON hỏng phải về null trong item, body=%s", w.Body.String())
	}
}

func TestReadAllChiDanhDauCuaDungUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	mock.ExpectExec("UPDATE notifications SET is_read=1").
		WithArgs(sqlmock.AnyArg(), int64(9)).
		WillReturnResult(sqlmock.NewResult(0, 3))

	w := httptest.NewRecorder()
	h.ReadAll(w, requestAs(9))

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestReadOneDungIdVaUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	mock.ExpectExec("UPDATE notifications SET is_read=1, updated_at=\\? WHERE id=\\? AND user_id=\\?").
		WithArgs(sqlmock.AnyArg(), "5", int64(9)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := requestAs(9)
	r.SetPathValue("id", "5")
	w := httptest.NewRecorder()
	h.ReadOne(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestIndexLoiDbTra500(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	mock.ExpectQuery("SELECT id,user_id,type,title,body,is_read,data").
		WillReturnError(sqlmock.ErrCancelled)

	w := httptest.NewRecorder()
	h.Index(w, requestAs(1))

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d, muốn 500", w.Code)
	}
}
