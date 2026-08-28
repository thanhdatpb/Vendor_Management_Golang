import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseHappyCreativeLibrary } from '../vendorExcel';

function workbookFile(name, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CANVAS');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function currentTemplateRows(notesHeader = 'Notes', notes = 'Dòng một\nGhi chú tiếng Việt') {
  return [
    ['', '', '', 'CANVAS'], [], [], [],
    ['Thông tin chung về phôi'],
    [
      'Vendor Name', 'Product Type', 'Hình ảnh đại diện - Video', '', '', '',
      'Chất liệu', 'Chi tiết Size', 'AVG thời gian sx+ ship theo vendor', '',
      'AVG thời gian sx+ ship thực tế', notesHeader, '', '', '', 'Link Folder',
    ],
    [
      'US4', 'Black Framed Canvas', '', '', '', '', 'Canvas', '8x12',
      '1-5 BDS', '', '1-3 BDS', notes, '', '', '', 'https://drive.example/folder',
    ],
    ['Về giá'],
  ];
}

describe('parseHappyCreativeLibrary — cột Notes', () => {
  it('đọc Notes ở cột L của template Vendor hiện hành', async () => {
    const result = await parseHappyCreativeLibrary(workbookFile('canvas.xlsx', currentTemplateRows()));

    expect(result.generalInfo).toHaveLength(1);
    expect(result.generalInfo[0].notes).toBe('Dòng một\nGhi chú tiếng Việt');
    expect(result.generalInfo[0].avgTimeActual).toBe('1-3 BDS');
  });

  it.each(['Ghi chú', '  NOTES\n', 'Note:'])('nhận diện biến thể header "%s"', async (header) => {
    const result = await parseHappyCreativeLibrary(
      workbookFile('canvas.xlsx', currentTemplateRows(header, 'Nội dung cần import')),
    );

    expect(result.generalInfo[0].notes).toBe('Nội dung cần import');
  });

  it('fallback về cột L khi template mới bị thiếu nhãn Notes', async () => {
    const result = await parseHappyCreativeLibrary(
      workbookFile('canvas.xlsx', currentTemplateRows('', 'Notes không có header')),
    );

    expect(result.generalInfo[0].notes).toBe('Notes không có header');
    expect(result.generalInfo[0].avgTimeActual).toBe('1-3 BDS');
  });

  it('giữ tương thích layout cũ có Notes ở cột K', async () => {
    const rows = [
      ['', '', '', 'CANVAS'], [], [], [],
      [
        'Product Type', 'Hình ảnh', '', '', '', 'Chất liệu', 'Chi tiết Size',
        'AVG theo vendor', '', 'AVG thực tế', 'Notes', 'Link Folder',
      ],
      [
        'US4', '', '', '', '', 'Canvas', '8x12', '1-5 BDS', '', '1-3 BDS',
        'Ghi chú layout cũ', 'https://drive.example/folder',
      ],
      ['Về giá'],
    ];

    const result = await parseHappyCreativeLibrary(workbookFile('legacy-canvas.xlsx', rows));

    expect(result.generalInfo[0].notes).toBe('Ghi chú layout cũ');
    expect(result.generalInfo[0].linkFolder).toBe('https://drive.example/folder');
  });
});
