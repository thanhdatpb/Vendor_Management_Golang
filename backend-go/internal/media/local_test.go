package media

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Ràng buộc quan trọng nhất của package này: URL ghi vào DB phải đúng dạng
// tương đối "/storage/<folder>/<tên>" như HandlesMediaStorage của Laravel vẫn
// ghi. Đổi dạng là làm lệch toàn bộ dữ liệu cũ đang có trong DB.

func upload(t *testing.T, filename string, body []byte) *multipart.FileHeader {
	t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="file"; filename="`+filename+`"`)
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("tạo part lỗi: %v", err)
	}
	if _, err := part.Write(body); err != nil {
		t.Fatalf("ghi part lỗi: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("đóng writer lỗi: %v", err)
	}

	reader := multipart.NewReader(&buf, writer.Boundary())
	form, err := reader.ReadForm(int64(len(body)) + 4096)
	if err != nil {
		t.Fatalf("đọc form lỗi: %v", err)
	}
	return form.File["file"][0]
}

func TestSaveTraUrlDungDangCuaLaravel(t *testing.T) {
	store := Local{Root: t.TempDir()}
	file := upload(t, "anh.PNG", []byte("noi dung anh"))

	key, url, err := store.Save(context.Background(), file, "vendors", 1<<20, false)
	if err != nil {
		t.Fatalf("Save lỗi: %v", err)
	}

	if !strings.HasPrefix(key, "vendors/") {
		t.Errorf("key = %q, muốn bắt đầu bằng vendors/", key)
	}
	if url != "/storage/"+key {
		t.Errorf("url = %q, muốn \"/storage/\"+key", url)
	}
	// Phần mở rộng hạ chữ thường, tên file gốc KHÔNG được giữ lại.
	if !strings.HasSuffix(key, ".png") {
		t.Errorf("key = %q, muốn đuôi .png viết thường", key)
	}
	if strings.Contains(key, "anh") {
		t.Errorf("key = %q, không được mang tên file gốc", key)
	}

	saved, err := os.ReadFile(filepath.Join(store.Root, filepath.FromSlash(key)))
	if err != nil {
		t.Fatalf("đọc file đã lưu lỗi: %v", err)
	}
	if string(saved) != "noi dung anh" {
		t.Errorf("nội dung đã lưu = %q", saved)
	}
}

// Hai lần lưu cùng một file phải ra hai key khác nhau, không đè nhau.
func TestSaveSinhTenNgauNhienKhongDeNhau(t *testing.T) {
	store := Local{Root: t.TempDir()}

	first, _, err := store.Save(context.Background(), upload(t, "a.jpg", []byte("x")), "products", 1<<20, false)
	if err != nil {
		t.Fatalf("Save lần 1 lỗi: %v", err)
	}
	second, _, err := store.Save(context.Background(), upload(t, "a.jpg", []byte("y")), "products", 1<<20, false)
	if err != nil {
		t.Fatalf("Save lần 2 lỗi: %v", err)
	}

	if first == second {
		t.Errorf("hai lần lưu ra cùng key %q — file sau đè file trước", first)
	}
}

func TestSaveChanDinhDangVaKichThuoc(t *testing.T) {
	store := Local{Root: t.TempDir()}
	ctx := context.Background()

	if _, _, err := store.Save(ctx, upload(t, "script.php", []byte("x")), "vendors", 1<<20, false); err == nil {
		t.Error("phải từ chối đuôi .php")
	}
	if _, _, err := store.Save(ctx, upload(t, "clip.mp4", []byte("x")), "vendors", 1<<20, false); err == nil {
		t.Error("video bị từ chối khi cờ videos = false")
	}
	if _, _, err := store.Save(ctx, upload(t, "clip.mp4", []byte("x")), "vendors", 1<<20, true); err != nil {
		t.Errorf("video phải được nhận khi cờ videos = true: %v", err)
	}
	if _, _, err := store.Save(ctx, upload(t, "to.jpg", []byte("nhieu byte")), "vendors", 3, false); err == nil {
		t.Error("phải từ chối file vượt maxBytes")
	}
	if _, _, err := store.Save(ctx, nil, "vendors", 1<<20, false); err == nil {
		t.Error("phải từ chối file nil")
	}

	// Không được để lại file rác khi từ chối.
	entries, _ := os.ReadDir(filepath.Join(store.Root, "vendors"))
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".php") {
			t.Errorf("còn sót file bị từ chối: %s", entry.Name())
		}
	}
}

func TestSavePathLuuFileCoSanTrenDia(t *testing.T) {
	store := Local{Root: t.TempDir()}

	source := filepath.Join(t.TempDir(), "trich-xuat.jpg")
	if err := os.WriteFile(source, []byte("anh tu excel"), 0o644); err != nil {
		t.Fatalf("ghi file nguồn lỗi: %v", err)
	}

	key, url, err := store.SavePath(context.Background(), source, "vendors", 1<<20, false)
	if err != nil {
		t.Fatalf("SavePath lỗi: %v", err)
	}
	if url != "/storage/"+key {
		t.Errorf("url = %q", url)
	}

	// File nguồn KHÔNG bị xoá: nơi gọi tự quyết định dọn bản tạm.
	if _, err := os.Stat(source); err != nil {
		t.Errorf("file nguồn bị xoá: %v", err)
	}

	if _, _, err := store.SavePath(context.Background(), filepath.Join(t.TempDir(), "khong-co.jpg"), "vendors", 1<<20, false); err == nil {
		t.Error("phải báo lỗi khi file nguồn không tồn tại")
	}
}

// Key() phải tách được key từ mọi dạng URL đang có trong DB: đường dẫn tương
// đối cũ, URL tuyệt đối của object storage, và URL có tham số truy vấn.
func TestKeyTachDuocTuMoiDangUrlDangCoTrongDb(t *testing.T) {
	cases := map[string]string{
		"/storage/vendors/abc.jpg":                                     "vendors/abc.jpg",
		"storage/vendors/abc.jpg":                                      "vendors/abc.jpg",
		"vendors/abc.jpg":                                              "vendors/abc.jpg",
		"/storage/products/xyz.png":                                    "products/xyz.png",
		"/storage/vendor-library/anh.webp":                             "vendor-library/anh.webp",
		"https://cdn.example.com/vendors/abc.jpg":                      "vendors/abc.jpg",
		"https://cdn.example.com/vendors/a.jpg?x=1":                    "vendors/a.jpg",
		"https://x.supabase.co/storage/v1/object/public/vendors/a.jpg": "vendors/a.jpg",
		// Không thuộc thư mục do ứng dụng quản lý thì trả rỗng, không đoán.
		"https://drive.google.com/file/d/abc/view": "",
		"":                         "",
		"/storage/linh-tinh/a.jpg": "",
	}

	for raw, want := range cases {
		if got := Key(raw); got != want {
			t.Errorf("Key(%q) = %q, muốn %q", raw, got, want)
		}
	}
}

func TestDeleteUrlXoaDungFileVaBoQuaFileDaMat(t *testing.T) {
	store := Local{Root: t.TempDir()}
	ctx := context.Background()

	key, url, err := store.Save(ctx, upload(t, "a.jpg", []byte("x")), "vendors", 1<<20, false)
	if err != nil {
		t.Fatalf("Save lỗi: %v", err)
	}

	if err := store.DeleteURL(ctx, url); err != nil {
		t.Fatalf("DeleteURL lỗi: %v", err)
	}
	if _, err := os.Stat(filepath.Join(store.Root, filepath.FromSlash(key))); !os.IsNotExist(err) {
		t.Error("file vẫn còn sau khi xoá")
	}

	// Xoá lần hai không được báo lỗi: file đã mất thì coi như xong việc.
	if err := store.DeleteURL(ctx, url); err != nil {
		t.Errorf("xoá file đã mất phải im lặng, nhận: %v", err)
	}
	// URL không thuộc thư mục quản lý thì bỏ qua, không đụng vào đĩa.
	if err := store.DeleteURL(ctx, "https://drive.google.com/file/d/abc/view"); err != nil {
		t.Errorf("URL ngoài phạm vi phải bỏ qua, nhận: %v", err)
	}
}

// Chặn path traversal: tên file phải là tên trần, không chứa thư mục.
func TestReadChanPathTraversal(t *testing.T) {
	root := t.TempDir()
	store := Local{Root: root}

	secret := filepath.Join(filepath.Dir(root), "bi-mat.txt")
	if err := os.WriteFile(secret, []byte("khong duoc doc"), 0o644); err != nil {
		t.Fatalf("ghi file lỗi: %v", err)
	}

	for _, name := range []string{"../bi-mat.txt", "..\\bi-mat.txt", "vendors/a.jpg", "", ".", "/etc/passwd"} {
		if _, err := store.Read(context.Background(), "vendors", name); err == nil {
			t.Errorf("Read(%q) phải bị từ chối", name)
		}
	}
}

func TestReadTraNoiDungVaContentType(t *testing.T) {
	store := Local{Root: t.TempDir()}
	ctx := context.Background()

	key, _, err := store.Save(ctx, upload(t, "a.png", []byte("noi dung")), "vendors", 1<<20, false)
	if err != nil {
		t.Fatalf("Save lỗi: %v", err)
	}
	name := strings.TrimPrefix(key, "vendors/")

	object, err := store.Read(ctx, "vendors", name)
	if err != nil {
		t.Fatalf("Read lỗi: %v", err)
	}
	defer object.Body.Close()

	body, _ := io.ReadAll(object.Body)
	if string(body) != "noi dung" {
		t.Errorf("nội dung = %q", body)
	}
	if object.Size != int64(len("noi dung")) {
		t.Errorf("size = %d", object.Size)
	}
	if !strings.Contains(object.ContentType, "png") {
		t.Errorf("content type = %q, muốn chứa png", object.ContentType)
	}
}

// DeleteURL không được xoá ra ngoài thư mục gốc kể cả khi key có dấu chấm kép.
func TestDeleteUrlKhongVuotRaNgoaiThuMucGoc(t *testing.T) {
	root := t.TempDir()
	store := Local{Root: root}

	outside := filepath.Join(filepath.Dir(root), "ngoai-pham-vi.txt")
	if err := os.WriteFile(outside, []byte("giu nguyen"), 0o644); err != nil {
		t.Fatalf("ghi file lỗi: %v", err)
	}

	_ = store.DeleteURL(context.Background(), "/storage/vendors/../../ngoai-pham-vi.txt")

	if _, err := os.Stat(outside); err != nil {
		t.Errorf("file ngoài thư mục gốc đã bị xoá: %v", err)
	}
}
