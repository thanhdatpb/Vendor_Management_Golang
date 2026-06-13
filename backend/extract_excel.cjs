const fs = require('fs');
const JSZip = require('jszip');
const xlsx = require('xlsx');
const path = require('path');

async function extractExcel(filePath, outputFile) {
    console.log(`Processing: ${filePath}`);
    const data = fs.readFileSync(filePath);

    // Parse all cell data
    const workbook = xlsx.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

    // ─── PARSE IMAGES ────────────────────────────────────────────────────
    const zip = await JSZip.loadAsync(data);
    const mediaFiles = {};
    for (const [key, entry] of Object.entries(zip.files)) {
        if (key.startsWith('xl/media/')) {
            const ext = path.extname(key).toLowerCase();
            if (['.png', '.jpeg', '.jpg', '.gif', '.webp'].includes(ext)) {
                mediaFiles[key] = await entry.async('nodebuffer');
            }
        }
    }

    // Image → cell position mapping (from drawing XML)
    const imagesByCell = {};
    const relsFile = zip.file('xl/drawings/_rels/drawing1.xml.rels');
    const relMap = {};
    if (relsFile) {
        const relsStr = await relsFile.async('string');
        const re = /Id="([^"]+)"\s+[^>]*Target="([^"]+)"/g;
        let m;
        while ((m = re.exec(relsStr)) !== null) {
            relMap[m[1]] = m[2].replace('../media/', 'xl/media/');
        }
    }
    const drawingFile = zip.file('xl/drawings/drawing1.xml');
    if (drawingFile) {
        const drawStr = await drawingFile.async('string');
        const anchors = drawStr.split(/<xdr:(?:one|two)CellAnchor/);
        for (const anchor of anchors) {
            const colM = anchor.match(/<xdr:col>(\d+)<\/xdr:col>/);
            const rowM = anchor.match(/<xdr:row>(\d+)<\/xdr:row>/);
            const blipM = anchor.match(/<a:blip[^>]+r:embed="([^"]+)"/);
            if (colM && rowM && blipM) {
                const mediaPath = relMap[blipM[1]];
                if (mediaPath && mediaFiles[mediaPath]) {
                    imagesByCell[`${rowM[1]},${colM[1]}`] = mediaFiles[mediaPath];
                }
            }
        }
    }

    // Helper: check if a value is a single vendor letter (A–Z)
    const isVendorKey = v => {
        const s = String(v || '').trim();
        return s.length === 1 && /^[A-Z]$/i.test(s);
    };
    const num = v => {
        const n = parseFloat(String(v || '').replace(/,/g, ''));
        return isNaN(n) ? null : n;
    };
    const str = v => {
        const s = String(v || '').trim();
        return (s === '' || s.toUpperCase() === 'N/A') ? null : s;
    };

    // ─── FIND SECTION BOUNDARIES ────────────────────────────────────────
    let sec1StartRow = -1;   // "Thông tin chung" header
    let sec2StartRow = -1;   // "Về giá" / "Ký hiệu" pricing table header
    let sec2DataRow  = -1;   // first data row of pricing section

    for (let r = 0; r < jsonData.length; r++) {
        const row = jsonData[r];
        const rowStr = row.map(c => String(c || '')).join('|').toLowerCase();

        if (sec1StartRow === -1 && rowStr.includes('chất liệu')) {
            sec1StartRow = r;
        }
        if (sec2StartRow === -1 && (rowStr.includes('ký hiệu') || rowStr.includes('pricing 1') || rowStr.includes('pricing1'))) {
            sec2StartRow = r;
            // find actual column indices from this header row
        }
        // Second header row of pricing section (Price Ship / Total)
        if (sec2StartRow !== -1 && sec2DataRow === -1 && r > sec2StartRow) {
            const rowStr2 = row.map(c => String(c || '')).join('|').toLowerCase();
            // Data row = has a vendor key in first or second cell
            if (isVendorKey(row[0]) || isVendorKey(row[1])) {
                sec2DataRow = r;
            }
        }
    }

    console.log(`Section 1 header: row ${sec1StartRow}, Section 2 header: row ${sec2StartRow}, Section 2 data: row ${sec2DataRow}`);

    // ─── DETERMINE COLUMN LAYOUT FOR SECTION 2 ──────────────────────────
    // We read the header rows to locate columns dynamically
    let colKyHieu = 0, colProductType = 1, colSize = 2, colOptional = 3;
    let colPricing1 = 4, colPricing2 = 5;
    let colEcoPrice = 6, colEcoTotal = 7;
    let colFastPrice = 8, colFastTotal = 9;
    let colExpressPrice = 10, colExpressTotal = 11;
    let colOvernightPrice = -1, colOvernightTotal = -1;

    if (sec2StartRow !== -1) {
        // Flatten all header rows into one string per col to find overnight
        const h1 = jsonData[sec2StartRow] || [];
        const h2 = sec2StartRow + 1 < jsonData.length ? jsonData[sec2StartRow + 1] || [] : [];

        // Detect "overnight" position
        for (let c = 0; c < h1.length; c++) {
            const cellVal = String(h1[c] || '').toLowerCase();
            if (cellVal.includes('overnight')) {
                colOvernightPrice = c;
                colOvernightTotal = c + 1;
                break;
            }
        }
        if (colOvernightPrice === -1) colOvernightPrice = 14;
        if (colOvernightTotal === -1)  colOvernightTotal = 15;

        console.log(`Overnight columns: Price=${colOvernightPrice}, Total=${colOvernightTotal}`);
    }

    // ─── SECTION 1: Thông tin chung (overview, avg times, notes) ─────────
    const sec1ColMap = {};  // detect col indices from header row
    if (sec1StartRow !== -1) {
        const hRow = jsonData[sec1StartRow] || [];
        hRow.forEach((cell, c) => {
            const v = String(cell || '').toLowerCase();
            if (v.includes('chất liệu')) sec1ColMap.chatLieu = c;
            if (v.includes('avg') && v.includes('vendor')) sec1ColMap.avgVendor = c;
            if (v.includes('avg') && v.includes('thực tế')) sec1ColMap.avgActual = c;
            if (v.includes('notes') || v.includes('ghi chú')) sec1ColMap.notes = c;
            if (v.includes('chi tiết size') || v.includes('chi tiet size')) sec1ColMap.sizeDetail = c;
        });
    }
    // Fallback defaults based on what we observed
    if (!sec1ColMap.chatLieu)   sec1ColMap.chatLieu  = 5;
    if (!sec1ColMap.avgVendor)  sec1ColMap.avgVendor  = 7;
    if (!sec1ColMap.avgActual)  sec1ColMap.avgActual  = 9;
    if (!sec1ColMap.notes)      sec1ColMap.notes      = 10;
    console.log('Section 1 col map:', sec1ColMap);

    const vendorsMap = {};  // vendor letter → vendor object

    const s1End = sec2StartRow !== -1 ? sec2StartRow : jsonData.length;
    for (let r = (sec1StartRow !== -1 ? sec1StartRow + 1 : 0); r < s1End; r++) {
        const row = jsonData[r];
        if (!row || row.every(c => !c)) continue;

        if (isVendorKey(row[0])) {
            const vendorKey = String(row[0]).trim().toUpperCase();

            // Image: look in columns 1 and 2 of that row
            let imageBase64 = null;
            for (let c = 1; c <= 3; c++) {
                if (imagesByCell[`${r},${c}`]) {
                    imageBase64 = 'data:image/jpeg;base64,' + imagesByCell[`${r},${c}`].toString('base64');
                    break;
                }
            }

            vendorsMap[vendorKey] = {
                name: vendorKey,
                image_base64: imageBase64,
                overview: str(row[sec1ColMap.chatLieu]),
                avg_time_vendor: str(row[sec1ColMap.avgVendor]),
                avg_time_actual: str(row[sec1ColMap.avgActual]),
                notes: str(row[sec1ColMap.notes]),
                products: []
            };
            console.log(`Vendor ${vendorKey}: overview="${vendorsMap[vendorKey].overview}", avg_vendor="${vendorsMap[vendorKey].avg_time_vendor}"`);
        }
    }

    // ─── SECTION 2: Về giá (pricing table) ──────────────────────────────
    if (sec2DataRow !== -1) {
        let currentKey = null;

        for (let r = sec2DataRow; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (!row || row.every(c => !c)) continue;

            // Check for vendor key
            if (isVendorKey(row[colKyHieu])) {
                currentKey = String(row[colKyHieu]).trim().toUpperCase();
                if (!vendorsMap[currentKey]) {
                    vendorsMap[currentKey] = { name: currentKey, image_base64: null, overview: null, avg_time_vendor: null, avg_time_actual: null, notes: null, products: [] };
                }
            }

            // Product row: productType must be non-empty and not look like a header
            const productType = str(row[colProductType]);
            if (!currentKey || !productType) continue;

            // Skip header-looking rows
            const pt = productType.toLowerCase();
            if (pt.includes('product type') || pt.includes('ký hiệu') || pt.includes('price ship') || pt.includes('pricing')) continue;
            // Skip "Setup giá bán" rows
            if (pt.includes('setup') || pt.includes('giá bán')) continue;

            vendorsMap[currentKey].products.push({
                product_type: productType,
                size:            str(row[colSize]) || 'One size',
                optional:        str(row[colOptional]),
                pricing1:        num(row[colPricing1]),
                pricing2:        num(row[colPricing2]),
                eco_price:       num(row[colEcoPrice]),
                eco_total:       num(row[colEcoTotal]),
                fast_price:      num(row[colFastPrice]),
                fast_total:      num(row[colFastTotal]),
                express_price:   num(row[colExpressPrice]),
                express_total:   num(row[colExpressTotal]),
                overnight_price: num(row[colOvernightPrice]),
                overnight_total: num(row[colOvernightTotal]),
            });

            console.log(`  → ${currentKey} | ${productType} | p1=${num(row[colPricing1])} eco=${num(row[colEcoPrice])}`);
        }
    }

    const result = Object.values(vendorsMap).filter(v => v.name);
    console.log(`Total vendors extracted: ${result.length}`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node extract_excel.cjs <input.xlsx> <output.json>');
    process.exit(1);
}
extractExcel(args[0], args[1]).catch(console.error);
