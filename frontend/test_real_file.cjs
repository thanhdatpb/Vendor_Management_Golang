const XLSX = require('xlsx');

const file = 'c:\\Users\\Admin\\Downloads\\TechStore\\HC_Cap_P.Happy_by Uyen Ho (1).xlsx';
const wb = XLSX.readFile(file, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('Row 0:', aoa[0]);
console.log('Row 1:', aoa[1]);
console.log('Row 2:', aoa[2]);
console.log('Row 3:', aoa[3]);
console.log('Row 4:', aoa[4]);
console.log('Row 5:', aoa[5]);

// Let's run the happy format logic
let isHappyFormat = false;
let happyPricingRowIdx = -1;
for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const col0 = String(row[0]).trim();
    const col1 = String(row[1]).trim();
    if (col0 === 'Ký hiệu' && col1.toLowerCase().startsWith('product type')) {
        isHappyFormat = true;
        happyPricingRowIdx = r;
        break;
    }
}
console.log('isHappyFormat:', isHappyFormat);
console.log('happyPricingRowIdx:', happyPricingRowIdx);

if (isHappyFormat) {
    for (let r = happyPricingRowIdx + 2; r < Math.min(happyPricingRowIdx + 6, aoa.length); r++) {
        const row = aoa[r] || [];
        console.log(`Data Row ${r}:`, row);
    }
}
