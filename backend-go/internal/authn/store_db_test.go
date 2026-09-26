package authn

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// Authenticate là hàm quyết định "ai được vào" — rủi ro cao nhất của cả bản
// port. Mọi nhánh dưới đây có thật trong store.go và phải test riêng: hai
// đường tra token (Sanctum "id|plain" và tra thẳng theo hash đầy đủ), so hash
// bằng constant-time compare, token hết hạn, tài khoản bị khoá.

func newStoreMock(t *testing.T) (*Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("tạo sqlmock lỗi: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return NewStore(db), mock
}

// userRow dựng đúng 11 cột theo userColumns: id, name, full_name, email,
// password, role, project, pd_projects, seller_name, avatar_url, is_active.
func userRow(id int64, email, role string, active bool) []driver.Value {
	return []driver.Value{id, "Tên", nil, email, nil, role, nil, nil, nil, nil, active}
}

func hashOf(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

func TestAuthenticateDangSanctumIdPlainThanhCong(t *testing.T) {
	store, mock := newStoreMock(t)

	plain := "40kytu-ngau-nhien" + "deadbeef"
	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(7), hashOf(plain), nil}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("7", `App\Models\User`).
		WillReturnRows(rows)
	mock.ExpectExec("UPDATE personal_access_tokens SET last_used_at").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	u, tokenID, err := store.Authenticate(context.Background(), "7|"+plain)
	if err != nil {
		t.Fatalf("Authenticate lỗi: %v", err)
	}
	if tokenID != 7 || u.ID != 1 || u.Email != "a@test.com" {
		t.Errorf("user/token = %+v / %d", u, tokenID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("chưa gọi đủ query kỳ vọng: %v", err)
	}
}

// Đường tra thẳng theo hash đầy đủ — bearer không có dấu "|".
func TestAuthenticateTraThangTheoHashKhiKhongCoDauGach(t *testing.T) {
	store, mock := newStoreMock(t)
	plain := "chuoi-token-khong-co-dau-gach"

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(9), hashOf(plain), nil}, userRow(2, "b@test.com", "admin", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs(hashOf(plain), `App\Models\User`).
		WillReturnRows(rows)
	mock.ExpectExec("UPDATE personal_access_tokens").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	u, tokenID, err := store.Authenticate(context.Background(), plain)
	if err != nil {
		t.Fatalf("Authenticate lỗi: %v", err)
	}
	if tokenID != 9 || u.ID != 2 {
		t.Errorf("user/token = %+v / %d", u, tokenID)
	}
}

// id không phải số ("abc|xyz") phải bị từ chối NGAY, không đụng DB.
func TestAuthenticateIdKhongPhaiSoBiTuChoiNgay(t *testing.T) {
	store, mock := newStoreMock(t)

	_, _, err := store.Authenticate(context.Background(), "khong-phai-so|plain")
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("không được gọi DB khi id sai định dạng: %v", err)
	}
}

func TestAuthenticateChuoiRongBiTuChoiNgay(t *testing.T) {
	store, mock := newStoreMock(t)

	for _, bearer := range []string{"", "   "} {
		_, _, err := store.Authenticate(context.Background(), bearer)
		if !errors.Is(err, ErrUnauthenticated) {
			t.Errorf("bearer=%q: err = %v, muốn ErrUnauthenticated", bearer, err)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("không được gọi DB khi bearer rỗng: %v", err)
	}
}

// Không tìm thấy dòng nào (token sai hoặc đã bị xoá) -> ErrUnauthenticated,
// không phải lỗi hệ thống.
func TestAuthenticateKhongTimThayTokenTraErrUnauthenticated(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("1", `App\Models\User`).
		WillReturnError(sql.ErrNoRows)

	_, _, err := store.Authenticate(context.Background(), "1|khong-ton-tai")
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated", err)
	}
}

// Hash trong DB KHÔNG khớp plain client gửi (token bị đoán sai, hoặc id đúng
// nhưng token thuộc người khác) -> phải từ chối bằng constant-time compare,
// không phải so sánh chuỗi thường.
func TestAuthenticateHashKhongKhopBiTuChoi(t *testing.T) {
	store, mock := newStoreMock(t)

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(3), hashOf("hash-that-khac"), nil}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("3", `App\Models\User`).
		WillReturnRows(rows)

	_, _, err := store.Authenticate(context.Background(), "3|plain-gui-len")
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated", err)
	}
}

// Hash lưu trong DB là chuỗi rác (không phải hex hợp lệ) — dữ liệu hỏng không
// được làm hàm panic, phải từ chối như hash không khớp.
func TestAuthenticateHashLuuTrongDbRacKhongPanic(t *testing.T) {
	store, mock := newStoreMock(t)

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(3), "khong-phai-hex!!", nil}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("3", `App\Models\User`).
		WillReturnRows(rows)

	_, _, err := store.Authenticate(context.Background(), "3|plain")
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated (không panic)", err)
	}
}

// Token đã hết hạn phải bị từ chối dù hash khớp — expires_at là NGƯỠNG cứng.
func TestAuthenticateTokenHetHanBiTuChoi(t *testing.T) {
	store, mock := newStoreMock(t)
	plain := "token-da-het-han"
	expired := time.Now().UTC().Add(-time.Hour)

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(4), hashOf(plain), expired}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("4", `App\Models\User`).
		WillReturnRows(rows)

	_, _, err := store.Authenticate(context.Background(), "4|"+plain)
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated", err)
	}
}

// Token còn hạn (expires_at ở tương lai) vẫn phải qua được.
func TestAuthenticateTokenConHanDiQua(t *testing.T) {
	store, mock := newStoreMock(t)
	plain := "token-con-han"
	future := time.Now().UTC().Add(time.Hour)

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(5), hashOf(plain), future}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").WithArgs("5", `App\Models\User`).WillReturnRows(rows)
	mock.ExpectExec("UPDATE personal_access_tokens").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	if _, _, err := store.Authenticate(context.Background(), "5|"+plain); err != nil {
		t.Fatalf("token còn hạn phải qua được, lỗi: %v", err)
	}
}

// Tài khoản bị khoá (is_active=false) phải bị từ chối dù token đúng — token
// không tự hết hạn khi Admin khoá tài khoản, is_active là chỗ chặn.
func TestAuthenticateTaiKhoanBiKhoaBiTuChoi(t *testing.T) {
	store, mock := newStoreMock(t)
	plain := "token-cua-tai-khoan-bi-khoa"

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(6), hashOf(plain), nil}, userRow(1, "a@test.com", "seller", false)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").WithArgs("6", `App\Models\User`).WillReturnRows(rows)

	_, _, err := store.Authenticate(context.Background(), "6|"+plain)
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("err = %v, muốn ErrUnauthenticated", err)
	}
}

// CreateToken phải sinh đúng định dạng Sanctum "id|plain" và lưu SHA-256 của
// plain vào cột token — Laravel xác thực bằng cách so hash này.
func TestCreateTokenDungDinhDangSanctum(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectExec("INSERT INTO personal_access_tokens").
		WithArgs(`App\Models\User`, int64(1), "auth_token", sqlmock.AnyArg(), `["*"]`, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(42, 1))

	token, err := store.CreateToken(context.Background(), 1, "auth_token")
	if err != nil {
		t.Fatalf("CreateToken lỗi: %v", err)
	}

	id, plain, ok := cutOnce(token, "|")
	if !ok || id != "42" {
		t.Fatalf("token = %q, muốn tiền tố \"42|\"", token)
	}
	// plain = 40 ký tự entropy + 8 hex checksum = 48 ký tự.
	if len(plain) != 48 {
		t.Errorf("phần plain dài %d ký tự, muốn 48", len(plain))
	}
}

func cutOnce(s, sep string) (before, after string, found bool) {
	for i := 0; i+len(sep) <= len(s); i++ {
		if s[i:i+len(sep)] == sep {
			return s[:i], s[i+len(sep):], true
		}
	}
	return s, "", false
}

func TestActiveAccountsByEmailChuanHoaEmailTruocKhiQuery(t *testing.T) {
	store, mock := newStoreMock(t)

	rows := sqlmock.NewRows([]string{
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(userRow(1, "a@test.com", "seller", true)...).
		AddRow(userRow(2, "a@test.com", "vendor", true)...)

	// Email gõ hoa + khoảng trắng phải được hạ chữ thường + trim trước khi vào query.
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	accounts, err := store.ActiveAccountsByEmail(context.Background(), "  A@Test.com  ")
	if err != nil {
		t.Fatalf("lỗi: %v", err)
	}
	if len(accounts) != 2 {
		t.Fatalf("có %d tài khoản, muốn 2 (1 email nhiều role)", len(accounts))
	}
}

func TestActiveUserForSelectionTraLoiKhiKhongKhop(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectQuery("SELECT").WithArgs(int64(99), "a@test.com").WillReturnError(sql.ErrNoRows)

	_, err := store.ActiveUserForSelection(context.Background(), 99, "a@test.com")
	if err == nil {
		t.Fatal("muốn lỗi khi không khớp id + email")
	}
}

func TestProjectsForTraDanhSachPhanBiet(t *testing.T) {
	store, mock := newStoreMock(t)

	rows := sqlmock.NewRows([]string{"project"}).AddRow("Happy Project").AddRow("Global Project")
	mock.ExpectQuery("SELECT DISTINCT project").
		WithArgs("a@test.com", "pd").
		WillReturnRows(rows)

	projects, err := store.ProjectsFor(context.Background(), User{Email: "a@test.com", Role: "pd"})
	if err != nil {
		t.Fatalf("lỗi: %v", err)
	}
	if len(projects) != 2 || projects[0] != "Happy Project" {
		t.Errorf("projects = %v", projects)
	}
}

// Không có project nào phải ra mảng rỗng, không phải nil — JSON trả về [].
func TestProjectsForRongRaMangRong(t *testing.T) {
	store, mock := newStoreMock(t)

	rows := sqlmock.NewRows([]string{"project"})
	mock.ExpectQuery("SELECT DISTINCT project").WillReturnRows(rows)

	projects, err := store.ProjectsFor(context.Background(), User{Email: "a@test.com", Role: "pd"})
	if err != nil {
		t.Fatalf("lỗi: %v", err)
	}
	if projects == nil || len(projects) != 0 {
		t.Errorf("projects = %#v, muốn mảng rỗng", projects)
	}
}

func TestDeleteTokenDungThamSo(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectExec("DELETE FROM personal_access_tokens").
		WithArgs(int64(7), int64(1), `App\Models\User`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := store.DeleteToken(context.Background(), 7, 1); err != nil {
		t.Fatalf("DeleteToken lỗi: %v", err)
	}
}

// touchLastSeen có ngưỡng chặn 5 phút: gọi liên tiếp trong ngưỡng đó chỉ được
// ghi DB MỘT lần — tránh ghi users.last_seen_at ở mọi request của cùng 1 người.
func TestTouchLastSeenChanTrongNguong5Phut(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	now := time.Now().UTC()
	store.touchLastSeen(context.Background(), 1, now)
	// Lần gọi thứ hai trong vòng 5 phút: KHÔNG được có UPDATE thứ hai — nếu có,
	// ExpectationsWereMet() dưới sẽ báo "call to ExecQuery was not expected".
	store.touchLastSeen(context.Background(), 1, now.Add(time.Minute))

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("touchLastSeen ghi DB nhiều hơn 1 lần trong ngưỡng 5 phút: %v", err)
	}
}

// Sau khi ngưỡng 5 phút trôi qua, lần chạm kế tiếp phải ghi DB lần nữa.
func TestTouchLastSeenGhiLaiSauKhiQuaNguong(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	now := time.Now().UTC()
	store.touchLastSeen(context.Background(), 1, now)
	store.touchLastSeen(context.Background(), 1, now.Add(6*time.Minute))

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("thiếu lần ghi thứ hai sau khi qua ngưỡng: %v", err)
	}
}

// Hai user khác nhau không dùng chung ngưỡng throttle của nhau.
func TestTouchLastSeenRiengTheoTungUser(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	now := time.Now().UTC()
	store.touchLastSeen(context.Background(), 1, now)
	store.touchLastSeen(context.Background(), 2, now)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("user khác nhau phải ghi DB độc lập: %v", err)
	}
}
