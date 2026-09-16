// ════════════════════════════════════════════════════════
//  DANH SÁCH PROJECT — một chỗ duy nhất.
//
//  Trước đây mỗi dashboard tự khai một bản: CsfDashboard hard-code 4 project,
//  PdDashboard suy ra từ `user.projects`, StaffManagementSection lại có bản
//  thứ ba dạng "Happy Project". Thêm project mới là phải nhớ sửa đủ ba nơi.
//
//  `id` khớp ký hiệu `P.xxx` trong tên file thư viện Vendor (xem
//  extractFileProject) — đó là thứ quyết định file thuộc project nào.
// ════════════════════════════════════════════════════════
export const PROJECTS = [
  { id: 'happy',    label: 'Happy Project',    shortLabel: 'Happy' },
  { id: 'creative', label: 'Creative Project', shortLabel: 'Creative' },
  { id: 'global',   label: 'Global Project',   shortLabel: 'Global' },
  { id: 'hapify84', label: 'Hapify84 Project', shortLabel: 'Hapify84' },
];

/**
 * "Happy Project" → "happy". Trả null nếu không nhận ra.
 * Dò theo id DÀI trước để một id không nuốt mất id khác khi có tên lồng nhau.
 */
export function projectNameToKey(name) {
  if (!name) return null;
  const n = name.toString().toLowerCase();
  const byLongest = [...PROJECTS].sort((a, b) => b.id.length - a.id.length);
  return byLongest.find((p) => n.includes(p.id))?.id ?? null;
}

// ════════════════════════════════════════════════════════
//  QUYỀN XEM FILE THƯ VIỆN VENDOR THEO PROJECT
//
//  Trước đây project của một file được SUY RA TỪ TÊN FILE (ký hiệu `P.xxx`).
//  Muốn đổi ai được xem là phải đổi tên file — dễ sai, và không diễn tả được
//  "file này cho 2 project cùng xem".
//
//  Nay mỗi file có field `projects` (mảng id project) do Vendor/Admin chọn
//  trong hộp thoại Chia sẻ. Quy ước:
//    • không có field (undefined/null) → file CŨ, vẫn suy theo tên file `P.xxx`
//    • mảng rỗng []                    → chia sẻ cho TẤT CẢ project
//    • mảng có phần tử                 → chỉ các project trong mảng thấy file
//
//  Giữ đường lùi theo tên file để 100+ file đã import từ trước không đổi hành vi
//  cho tới khi được chia sẻ lại một cách tường minh.
// ════════════════════════════════════════════════════════

/**
 * Suy project từ tên file (cơ chế cũ). Trả null nếu không có ký hiệu `P.xxx`
 * — nghĩa là hiện cho tất cả project.
 */
export function extractFileProject(filename) {
  if (!filename) return null;
  const fn = filename.toString().toLowerCase();
  // Dò id DÀI trước để 'hapify84' không bị 'happy' nuốt mất.
  const byLongest = [...PROJECTS].sort((a, b) => b.id.length - a.id.length);
  return byLongest.find((p) => fn.includes(`p.${p.id}`))?.id ?? null;
}

/** Danh sách project được chia sẻ tường minh, hoặc null nếu file chưa cấu hình. */
export function fileSharedProjects(file) {
  const list = file?.projects;
  if (!Array.isArray(list)) return null;
  return list.map((p) => (p ?? '').toString().trim().toLowerCase()).filter(Boolean);
}

/**
 * File có hiện cho user thuộc `userProjectKey` không.
 *
 * `userProjectKey` là chuỗi tự do lấy từ tài khoản ("happy project", "Happy"…)
 * nên so khớp hai chiều bằng `includes` — giữ nguyên cách so cũ.
 */
export function fileVisibleToProject(file, userProjectKey) {
  const key = (userProjectKey ?? '').toString().trim().toLowerCase();
  if (!key) return true;

  const matches = (projectId) => key.includes(projectId) || projectId.includes(key);

  const shared = fileSharedProjects(file);
  if (shared) return shared.length === 0 || shared.some(matches);

  const fromName = extractFileProject(file?.filename);
  return !fromName || matches(fromName);
}
