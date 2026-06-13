const fs = require('fs');
const JSZip = require('jszip');
const xlsx = require('xlsx');
const path = require('path');

async function extractExcel(filePath, outputFile) {
    console.log(`Processing file: ${filePath}`);
    const data = fs.readFileSync(filePath);
    
    // Parse normal data with SheetJS
    const workbook = xlsx.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    
    // Parse Images with JSZip
    const zip = await JSZip.loadAsync(data);
    const mediaFiles = {};
    for (const [key, zipEntry] of Object.entries(zip.files)) {
        if (key.startsWith('xl/media/')) {
            const ext = path.extname(key);
            if (['.png', '.jpeg', '.jpg'].includes(ext.toLowerCase())) {
                const buffer = await zipEntry.async("nodebuffer");
                mediaFiles[key] = buffer;
                console.log(`Found image: ${key} (${buffer.length} bytes)`);
            }
        }
    }
    
    // Parse drawing relationships
    const relsXMLPath = 'xl/drawings/_rels/drawing1.xml.rels';
    const relsFile = zip.file(relsXMLPath);
    const relMap = {}; // rId -> target
    if (relsFile) {
        const relsStr = await relsFile.async("string");
        const relRegex = /Id="([^"]+)" Target="([^"]+)"/g;
        let match;
        while ((match = relRegex.exec(relsStr)) !== null) {
            // Target is usually like "../media/image1.png"
            let targetPath = match[2].replace('../media/', 'xl/media/');
            relMap[match[1]] = targetPath;
        }
    }
    
    // Parse drawing XML
    const drawingXMLPath = 'xl/drawings/drawing1.xml';
    const drawingFile = zip.file(drawingXMLPath);
    const imagesByCell = {}; // "row,col" -> buffer
    if (drawingFile) {
        const drawingStr = await drawingFile.async("string");
        // Look for oneCellAnchor or twoCellAnchor
        const anchors = drawingStr.split(/<xdr:(?:one|two)CellAnchor/);
        for (const anchor of anchors) {
            const colMatch = anchor.match(/<xdr:col>(\d+)<\/xdr:col>/);
            const rowMatch = anchor.match(/<xdr:row>(\d+)<\/xdr:row>/);
            const blipMatch = anchor.match(/<a:blip[^>]+r:embed="([^"]+)"/);
            if (colMatch && rowMatch && blipMatch) {
                const col = parseInt(colMatch[1]);
                const row = parseInt(rowMatch[1]);
                const rId = blipMatch[1];
                const mediaPath = relMap[rId];
                if (mediaPath && mediaFiles[mediaPath]) {
                    imagesByCell[`${row},${col}`] = mediaFiles[mediaPath];
                }
            }
        }
    }
    
    // Now logic for Happy Creative format
    let vendorsMap = {}; // name -> vendor object
    
    // Section 1: Thông tin chung về phôi (Overview & Images)
    for (let r = 0; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row) continue;
        const col0 = String(row[0] || '').trim();
        const col5 = String(row[5] || '').trim(); // Chất liệu
        const col7 = String(row[7] || '').trim(); // AVG sx+ ship vendor
        const col9 = String(row[9] || '').trim(); // AVG sx+ ship thực tế
        
        if (col0.length === 1 && /^[A-Z]$/i.test(col0)) { // Vendor Name: A, B, C
            const vendorName = col0;
            let imageBase64 = null;
            if (imagesByCell[`${r},1`]) { // Image is usually in column B (index 1)
                imageBase64 = imagesByCell[`${r},1`].toString('base64');
            }
            
            let overviewParts = [];
            if (col5 && col5 !== 'N/A') overviewParts.push(`Chất liệu: ${col5}`);
            if (col7 && col7 !== 'N/A') overviewParts.push(`AVG thời gian sx+ ship theo vendor: ${col7}`);
            if (col9 && col9 !== 'N/A') overviewParts.push(`AVG thời gian sx+ ship thực tế: ${col9}`);
            
            vendorsMap[vendorName] = {
                name: vendorName,
                image_base64: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
                overview: overviewParts.join(' | '),
                products: []
            };
        }
    }
    
    // Section 2: Về giá (Pricing)
    let inPricingSection = false;
    let currentVendorForPricing = null;
    
    for (let r = 0; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row) continue;
        
        const col1 = String(row[1] || '').trim(); // Ký hiệu (Vendor Name) is actually in column B (1) in "Về giá" sometimes?
        // Wait, looking at the Excel, "Ký hiệu" might be col0 or col1.
        // Let's check col1 and col2
        if (String(row[1]).includes('Product Type')) {
            inPricingSection = true;
            continue;
        }
        
        if (inPricingSection) {
            // "Ký hiệu" could be in col0 or col1. If it's a single letter, it's the vendor.
            let vendorKey = String(row[0] || '').trim();
            if (!vendorKey || vendorKey.length > 2) {
                vendorKey = String(row[1] || '').trim();
            }
            
            if (vendorKey.length === 1 && /^[A-Z]$/i.test(vendorKey)) {
                currentVendorForPricing = vendorKey;
            }
            
            if (currentVendorForPricing && vendorsMap[currentVendorForPricing]) {
                const productType = String(row[1] || row[2] || '').trim(); // Adjust based on actual offset
                if (productType && productType !== 'N/A' && !productType.includes('Price Ship')) {
                    // Extract prices
                    // Columns: 4: Pricing1, 6: Eco Price, 7: Eco Total, 8: Ground Price, 9: Ground Total, 10: Express Price, 14: Overnight Price
                    vendorsMap[currentVendorForPricing].products.push({
                        product_type: productType,
                        pricing1: parseFloat(row[4]) || 0,
                        eco_price: parseFloat(row[6]) || 0,
                        fast_price: parseFloat(row[8]) || 0,
                        express_price: parseFloat(row[10]) || 0,
                        overnight_price: parseFloat(row[14]) || 0
                    });
                }
            }
        }
    }
    
    const vendorsList = Object.values(vendorsMap);
    // Write out the result
    fs.writeFileSync(outputFile, JSON.stringify(vendorsList, null, 2));
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node extract_excel.cjs <input.xlsx> <output.json>");
    process.exit(1);
}

extractExcel(args[0], args[1]).catch(console.error);
