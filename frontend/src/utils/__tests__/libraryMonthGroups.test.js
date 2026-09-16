import { describe, expect, it } from 'vitest';
import { groupLibraryFilesByMonth } from '../libraryMonthGroups';

describe('groupLibraryFilesByMonth', () => {
  it('gom file theo tháng và giữ nguyên thứ tự mới nhất trước', () => {
    const groups = groupLibraryFilesByMonth([
      { id: 'sep-new', importedAt: '2026-09-15T08:00:00.000Z' },
      { id: 'sep-old', importedAt: '2026-09-01T08:00:00.000Z' },
      { id: 'aug', importedAt: '2026-08-28T08:00:00.000Z' },
    ]);

    expect(groups.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: '2026-09', label: 'Tháng 9/2026' },
      { key: '2026-08', label: 'Tháng 8/2026' },
    ]);
    expect(groups[0].files.map((file) => file.id)).toEqual(['sep-new', 'sep-old']);
  });

  it('tính tháng theo giờ Việt Nam và giữ file thiếu ngày trong nhóm riêng', () => {
    const groups = groupLibraryFilesByMonth([
      { id: 'vn-october', importedAt: '2026-09-30T18:00:00.000Z' },
      { id: 'unknown', importedAt: '' },
    ]);

    expect(groups[0]).toMatchObject({ key: '2026-10', label: 'Tháng 10/2026' });
    expect(groups[1]).toMatchObject({ key: 'unknown', label: 'Không rõ thời gian' });
  });
});
