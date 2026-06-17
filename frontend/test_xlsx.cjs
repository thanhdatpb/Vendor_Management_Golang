const XLSX = require('xlsx');

// Create a workbook with data matching the screenshot
const ws_data = [
  ['Về giá', null, null, null, null, null, null, null, null, null],
  ['Ký hiệu', 'Product Type (CAP)', 'Detail', null, 'Pricing 1', 'Pricing 2', 'Shipping cost: Economy', null, 'Shipping cost: Ground', null],
  [null, null, 'Size', 'Optional', null, null, 'Price Ship', 'Total Price (fulfill)', 'Price Ship', 'Total Price (fulfill)'],
  ['A', 'AOP CAP', 'One size', 'N/A', '13,2', 'N/A', 0, '13,2', 'N/A', 'N/A']
];

const ws = XLSX.utils.aoa_to_sheet(ws_data);
ws['!merges'] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // Về giá
  { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // Detail
  { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } }, // Economy
  { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } }, // Ground
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log("aoa[3]:", aoa[3]);

const row = aoa[3];
for (let i = 0; i < 10; i++) {
  console.log(`row[${i}]:`, row[i]);
}
