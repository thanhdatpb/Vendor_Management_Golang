// ════════════════════════════════════════════════════════
//  KHAI BÁO THEO BỘ PHẬN — đổi gì cho một bộ phận thì sửa ĐÚNG một dòng ở đây.
//
//  Ba bộ phận CSF / PD / Marvel cùng xem Thư Viện Vendor read-only, nhưng khác
//  nhau ở chi tiết và sẽ còn khác thêm. Chỗ này là nơi ghi sự khác nhau đó.
//
//  ⚠ Cố ý KHÔNG nhân bản component bảng cho từng bộ phận: dự án từng có 2 viewer
//  trùng logic (VendorLibraryViewer + bản CSF/PD), mỗi lần đổi phân quyền phải
//  sửa 2 nơi và đó chính là cách lỗi rò rỉ giá phát sinh. Cấu trúc ở đây là:
//  MỘT view dùng chung + mỗi bộ phận một khai báo riêng.
//
//  ⚠ Đây là nguồn sự thật cho việc DỰNG GIAO DIỆN. Nguồn sự thật về BẢO MẬT là
//  backend/app/Support/VendorFieldVisibility.php — server không được gửi trường
//  mà bộ phận đó không có quyền. Test `departments.test.js` chốt hai bên khớp nhau.
// ════════════════════════════════════════════════════════

/**
 * @typedef {object} Department
 * @property {string}  key          role tương ứng trong hệ thống
 * @property {string}  label        nhãn hiển thị trên sidebar / tiêu đề
 * @property {boolean} showLeadTime hiện 2 cột "AVG TG (Vendor)" và "AVG TG (Thực tế)"
 * @property {boolean} showPrices   hiện các cột giá
 * @property {boolean} allProjects  tra cứu được thư viện của mọi project
 */

/** @type {Record<string, Department>} */
export const DEPARTMENTS = {
  csf: {
    key: 'csf',
    label: 'CSF',
    // CSF cần thời gian sản xuất/giao để trả lời khách hàng.
    showLeadTime: true,
    showPrices: false,
    allProjects: true,
  },

  pd: {
    key: 'pd',
    label: 'PD',
    // PD làm việc trên template/phôi, không dùng tới thời gian giao.
    showLeadTime: false,
    showPrices: false,
    // PD đã được tách khỏi project: cột `project` của tài khoản vẫn còn trong DB
    // nhưng không dùng để phân quyền nữa.
    allProjects: true,
  },

  marvel: {
    key: 'marvel',
    label: 'Marvel',
    // Giống CSF mọi mặt TRỪ 2 cột thời gian — đây là khác biệt duy nhất.
    showLeadTime: false,
    showPrices: false,
    allProjects: true,
  },
};

/** Khai báo của một bộ phận. Không nhận ra thì trả về bản chặt nhất. */
export function departmentFor(key) {
  return DEPARTMENTS[(key ?? '').toString().toLowerCase()] ?? {
    key: 'unknown',
    label: '',
    showLeadTime: false,
    showPrices: false,
    allProjects: false,
  };
}
