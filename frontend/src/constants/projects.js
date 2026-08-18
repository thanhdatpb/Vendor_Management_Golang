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
  { id: 'happy',    label: 'Happy Project' },
  { id: 'creative', label: 'Creative Project' },
  { id: 'global',   label: 'Global Project' },
  { id: 'hapify84', label: 'Hapify84 Project' },
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
