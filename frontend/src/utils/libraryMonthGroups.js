import { toDate, VN_TIMEZONE } from './vnTime';

const monthFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: VN_TIMEZONE,
  month: 'numeric',
  year: 'numeric',
});

function libraryMonth(importedAt) {
  const date = toDate(importedAt);
  if (!date) return { key: 'unknown', label: 'Không rõ thời gian' };

  const parts = monthFormatter.formatToParts(date);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  if (!Number.isFinite(month) || !Number.isFinite(year)) {
    return { key: 'unknown', label: 'Không rõ thời gian' };
  }

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: `Tháng ${month}/${year}`,
  };
}

/**
 * Gom danh sách đã sắp xếp thành các tháng nhưng giữ nguyên thứ tự file.
 * Nhờ vậy quy tắc "mới nhất trước" của từng màn hình không bị thay đổi.
 */
export function groupLibraryFilesByMonth(files = []) {
  const groups = [];
  const byMonth = new Map();

  files.forEach((file) => {
    const month = libraryMonth(file.importedAt);
    let group = byMonth.get(month.key);
    if (!group) {
      group = { ...month, files: [] };
      byMonth.set(month.key, group);
      groups.push(group);
    }
    group.files.push(file);
  });

  return groups;
}
