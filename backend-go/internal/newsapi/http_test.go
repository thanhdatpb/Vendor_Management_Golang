package newsapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/authn"
)

var newsColumns = []string{"id", "title", "message", "target", "sent_at", "created_by", "created_at", "updated_at"}

func newsRequestAs(method, path string, userID int64, body string) *http.Request {
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	return r.WithContext(authn.ContextWithPrincipal(r.Context(), authn.Principal{User: authn.User{ID: userID}}))
}

func TestStoreThieuTitleTra422(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	r := newsRequestAs(http.MethodPost, "/api/news", 1, `{"title":"","message":""}`)
	w := httptest.NewRecorder()
	h.Store(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d, muốn 422, body=%s", w.Code, w.Body.String())
	}
}

func TestStoreTargetRongMacDinhBoth(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectExec("INSERT INTO news").
		WithArgs("Tiêu đề", "Nội dung", []byte(`"both"`), int64(1), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(5, 1))
	mock.ExpectQuery("SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news WHERE id=\\?$").
		WithArgs(int64(5)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(5, "Tiêu đề", "Nội dung", []byte(`"both"`), nil, 1, now, now))

	r := newsRequestAs(http.MethodPost, "/api/news", 1, `{"title":"Tiêu đề","message":"Nội dung"}`)
	w := httptest.NewRecorder()
	h.Store(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"target":"both"`) {
		t.Errorf("target mặc định phải là \"both\": %s", w.Body.String())
	}
}

// Đã gửi rồi thì sửa phải bị chặn — khoá sửa/xoá/gửi lại, đúng comment trong
// migration news (sent_at != NULL nghĩa là bên nhận đã cầm bản notification).
func TestUpdateDaGuiRoiBiChan409(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news WHERE id=\\? FOR UPDATE").
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(7, "Cũ", "Cũ", []byte(`"both"`), now, 1, now, now))
	mock.ExpectRollback()

	r := newsRequestAs(http.MethodPut, "/api/news/7", 1, `{"title":"Mới","message":"Mới"}`)
	r.SetPathValue("id", "7")
	w := httptest.NewRecorder()
	h.Update(w, r)

	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s, muốn 409", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "không thể sửa") {
		t.Errorf("message = %s", w.Body.String())
	}
}

func TestDestroyDaGuiRoiBiChan409(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(7, "T", "M", []byte(`"both"`), now, 1, now, now))
	mock.ExpectRollback()

	r := newsRequestAs(http.MethodDelete, "/api/news/7", 1, "")
	r.SetPathValue("id", "7")
	w := httptest.NewRecorder()
	h.Destroy(w, r)

	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d, muốn 409", w.Code)
	}
}

func TestDestroyChuaGuiXoaThanhCong(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(7, "T", "M", []byte(`"both"`), nil, 1, now, now))
	mock.ExpectExec("DELETE FROM news WHERE id=\\?").WithArgs(int64(7)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := newsRequestAs(http.MethodDelete, "/api/news/7", 1, "")
	r.SetPathValue("id", "7")
	w := httptest.NewRecorder()
	h.Destroy(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestDestroyIdKhongHopLeTra404(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	for _, id := range []string{"abc", "0", "-1", ""} {
		r := newsRequestAs(http.MethodDelete, "/api/news/"+id, 1, "")
		r.SetPathValue("id", id)
		w := httptest.NewRecorder()
		h.Destroy(w, r)
		if w.Code != http.StatusNotFound {
			t.Errorf("id=%q: status=%d, muốn 404", id, w.Code)
		}
	}
}

// Send: chốt sent_at TRONG transaction rồi mới fan-out notification — khớp
// comment "News::send chốt sent_at rồi mới fan-out" trong SendNotificationEmail.
func TestSendChotSentAtRoiFanOutTrongCungTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(3)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(3, "Tiêu đề", "Nội dung", []byte(`"both"`), nil, 1, now, now))
	mock.ExpectExec("UPDATE news SET sent_at=\\?,updated_at=\\? WHERE id=\\?").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), int64(3)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT id FROM users WHERE role IN").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10).AddRow(11))
	mock.ExpectExec("INSERT INTO notifications").WithArgs(int64(10), "news", "Tiêu đề", "Nội dung", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO notifications").WithArgs(int64(11), "news", "Tiêu đề", "Nội dung", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(2, 1))
	mock.ExpectCommit()

	r := newsRequestAs(http.MethodPost, "/api/news/3/send", 1, "")
	r.SetPathValue("id", "3")
	w := httptest.NewRecorder()
	h.Send(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("chưa đủ bước trong transaction: %v", err)
	}
}

func TestSendDaGuiRoiBiChan409KhongFanOutLaiLan2(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(3)).
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(3, "T", "M", []byte(`"both"`), now, 1, now, now))
	mock.ExpectRollback()

	r := newsRequestAs(http.MethodPost, "/api/news/3/send", 1, "")
	r.SetPathValue("id", "3")
	w := httptest.NewRecorder()
	h.Send(w, r)

	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d, muốn 409", w.Code)
	}
	if !strings.Contains(w.Body.String(), "gửi lại") {
		t.Errorf("message = %s", w.Body.String())
	}
}

func TestIndexTraDanhSach(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news ORDER BY created_at DESC").
		WillReturnRows(sqlmock.NewRows(newsColumns).AddRow(1, "A", "B", []byte(`"both"`), nil, 1, now, now))

	r := newsRequestAs(http.MethodGet, "/api/news", 1, "")
	w := httptest.NewRecorder()
	h.Index(w, r)

	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"title":"A"`) {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}
