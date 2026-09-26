package libraryapi

import "testing"

// projectKey quyết định phạm vi project của mỗi role — đúng quy tắc CLAUDE.md
// mục 3: CSF/Marvel/Admin/staffb/vendor xem NHIỀU project cùng lúc (theo query
// param ?project=), còn Seller/PD chỉ xem ĐÚNG project gắn trên tài khoản, bất
// kể query param gửi gì.
func TestProjectKeyRoleRongXemDungTheoQueryParamKhiDuocPhep(t *testing.T) {
	cases := []struct {
		role     string
		project  *string
		query    string
		allowReq bool
		want     string
	}{
		{"csf", nil, "happy", true, "happy"},
		{"marvel", nil, "Global", true, "global"}, // hạ chữ thường
		{"admin", nil, "  happy  ", true, "happy"},
		{"vendor", nil, "happy", true, "happy"},
		{"staff_b", nil, "happy", true, "happy"}, // bí danh cũ của vendor
		// allowRequest=false (vd ListFiles): role rộng vẫn về rỗng = xem mọi project.
		{"csf", nil, "happy", false, ""},
		{"admin", nil, "happy", false, ""},
	}
	for _, c := range cases {
		if got := projectKey(c.role, c.project, c.query, c.allowReq); got != c.want {
			t.Errorf("role=%q query=%q allowReq=%v: = %q, muốn %q", c.role, c.query, c.allowReq, got, c.want)
		}
	}
}

// Seller KHÔNG được xem theo query param dù có gửi lên — phạm vi luôn bám
// theo users.project của chính họ, bất kể client cố tình gửi project khác.
//
// PD KHÔNG nằm trong nhóm hẹp này dù CLAUDE.md mục 3 mô tả PD là "single
// current-project" — đối chiếu PHP gốc (VendorLibraryController::indexProjectKey,
// comment tại chỗ) thì PD đã được xếp cùng nhóm CSF/Marvel/Admin: "PD được xem
// thư viện của MỌI project, không bị ghim theo cột project của tài khoản".
// Cột `pd_projects` (allowlist nhiều project PHÍA UI) KHÔNG được PHP gốc enforce
// ở tầng server cho endpoint này — Go port giữ nguyên y hệt, không tự "sửa cho
// đúng hơn" so với tài liệu, vì mục tiêu port là đúng PHP thật đang chạy.
func TestProjectKeySellerBoQuaQueryParamLuonDungProjectTaiKhoan(t *testing.T) {
	own := "Happy Project"
	cases := []struct {
		role  string
		query string
		want  string
	}{
		{"seller", "global", "happy project"},  // vẫn về project của chính họ
		{"staff_a", "global", "happy project"}, // bí danh cũ của seller
	}
	for _, c := range cases {
		if got := projectKey(c.role, &own, c.query, true); got != c.want {
			t.Errorf("role=%q: = %q, muốn %q (bỏ qua query param)", c.role, got, c.want)
		}
	}
}

// User project = nil (chưa gán project) -> phạm vi rỗng, không panic.
func TestProjectKeyProjectNilKhongPanic(t *testing.T) {
	if got := projectKey("seller", nil, "bat-ky", true); got != "" {
		t.Errorf("= %q, muốn rỗng", got)
	}
}

func TestNormalizeFilenameBoDuoiFileExcel(t *testing.T) {
	cases := map[string]string{
		"Thu Vien P.Happy.XLSX": "thu vien p.happy",
		"a.xls":                 "a",
		"  A.xlsx  ":            "a",
		"khong-co-duoi":         "khong-co-duoi",
		"a.xlsx.xls":            "a.xlsx", // chỉ bỏ MỘT đuôi ở cuối cùng
	}
	for in, want := range cases {
		if got := normalizeFilename(in); got != want {
			t.Errorf("normalizeFilename(%q) = %q, muốn %q", in, got, want)
		}
	}
}

func TestAnyStringEpKieuTuJson(t *testing.T) {
	cases := []struct {
		in   any
		want string
	}{
		{nil, ""},
		{"HW1", "HW1"},
		{true, "1"},
		{false, ""},
		{float64(16), "16"},
	}
	for _, c := range cases {
		if got := anyString(c.in); got != c.want {
			t.Errorf("anyString(%#v) = %q, muốn %q", c.in, got, c.want)
		}
	}
}

// marshalNoEscape không được escape "<", ">", "&" — link Drive/Google chứa
// các ký tự này trong query string, escape sẽ làm link lưu vào DB bị hỏng.
func TestMarshalNoEscapeKhongEscapeKyTuDacBiet(t *testing.T) {
	encoded, err := marshalNoEscape(map[string]string{"url": "https://a.com?x=1&y=2<3"})
	if err != nil {
		t.Fatalf("lỗi: %v", err)
	}
	got := string(encoded)
	if got != `{"url":"https://a.com?x=1&y=2<3"}` {
		t.Errorf("= %s", got)
	}
}
