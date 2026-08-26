# Bảng tính giá của Seller — phương án bổ sung (v2)

Nguồn: mindmap "Chức năng thiết lập giá / Seller" (5 nhánh). Tài liệu này **không lặp lại**
`HappyC_VendorHub_Fix_Plan_v1.md`; nó đối chiếu 5 nhánh đó với **code thực tế hôm nay**, chỉ ra phần
nào đã có nền, phần nào mindmap yêu cầu **chặt hơn** bản plan cũ, rồi chốt cách làm + cách kiểm.

## 0. Đối chiếu nhanh: mindmap ↔ hiện trạng code

| Nhánh mindmap | Hiện trạng trong code | Còn phải làm |
|---|---|---|
| 1. Kéo & sao chép giá an toàn | `PriceTable.jsx` vẫn ghi `{ sizeAdd: '' }` cho mọi ô đã kéo qua khi `mouseup`. Logic thuần đã tách sẵn ở `pricesheet/fillDown.js` (fill down/right, clear, undo, `UNDO_LIMIT = 20`) nhưng **chưa nối vào UI** | Nối UI: kéo = chọn vùng, thanh hành động nổi, Ctrl+Z / Ctrl+D / Delete |
| 2. Thêm/sửa/xoá Size + Customize | Nút `＋ Thêm Size` và cột Xoá bị gate `!libEntry` (`ProductTypeCard.jsx`); ô tên size `readOnly={sz.isLib}`; `resolveSheet` dựng lại size **chỉ theo thư viện** nên dòng Seller tự thêm biến mất; `summarizeSheet` tính avgMargin trên **mọi** dòng | Mở khoá cả 2 chế độ, `overrides`, `excluded`, `sizeOrder`, kéo đổi thứ tự cột Customize |
| 3. Thêm trùng Product Type | `AddProductTypeModal` lọc bỏ PT đã có bằng `existingKeys` | Bỏ chặn, phân biệt block bằng `recordKey` + `displayLabel` |
| 4. Hiện thông tin phôi ngay trong bảng | Index thư viện **chưa mang** `chatLieu`, ảnh, chi tiết size, AVG TG | Bổ sung `vendorInfo` vào payload index (backend) + panel gọn trên card |
| 5. Chọn phôi theo vendor | **Backend đã có nền**: `VendorLibraryIndexBuilder` trả từng record `{recordKey, productType, vendorCode, filename, project, sizes[]}`. Nhưng client `indexFromRecords()` lại **gom về `normalizeKey(productType)`** → 2 vendor cùng tên phôi vẫn đè nhau, vendor gặp trước thắng | Giữ nguyên danh sách record ở client + bộ chọn vendor + cột Vendor |

**Điểm mấu chốt:** nhánh 5 là nút thắt của cả 5 nhánh. Chừng nào index client còn khoá theo *tên*
product type thì mục 2 (size của vendor nào?), mục 3 (2 block trùng tên) và mục 4 (thông tin phôi của
vendor nào?) đều không làm đúng được. Vì vậy **thứ tự bắt buộc: 5 → 1 → 2 → 4**.

## 1. Mô hình dữ liệu (tương thích ngược, không migration)

`price_sheets.data` là JSON blob. Mọi trường mới đều **thêm**, đọc-ngược được bảng cũ:

```jsonc
{
  "productTypes": [{
    "id": "pt_x",
    "name": "Football Jersey",          // tên gốc từ thư viện, không đổi
    "displayLabel": "Jersey — VN7",     // MỚI: nhãn riêng khi 2 block trùng tên (nhánh 3)
    "vendorRefs": [                     // MỚI: nhiều vendor trong MỘT card (nhánh 5)
      { "recordKey": "a1b2…", "vendorCode": "VN3", "filename": "…p.happy…" },
      { "recordKey": "c3d4…", "vendorCode": "VN7", "filename": "…p.happy…" }
    ],
    "costSnapshot": { "a1b2…": { "S": { "itemCost": 8.2, "shipCostItem": 1.1, "totalShipCost": 4.1 } } },
    "sizeOrder": ["szlib_pt_x_a1b2_s", "szlib_pt_x_c3d4_s"],   // MỚI (nhánh 2)
    "customizeInfos": [{ "id": "ci_1", "name": "Add Custom Face", "defaultPrice": 3 }],
    "sizes": [{
      "id": "szlib_pt_x_a1b2_s",        // id GẮN recordKey — xem §2
      "label": "S",
      "recordKey": "a1b2…",             // MỚI: dòng này của vendor nào
      "vendorCode": "VN3",              // MỚI: render cột Vendor không phải tra ngược
      "origin": "lib",                  // MỚI: "lib" | "manual"
      "overrides": { "label": "S (rộng)", "itemCost": 9.9 },   // MỚI (nhánh 2)
      "excluded": false                 // MỚI: loại khỏi tổng hợp, KHÔNG xoá (nhánh 2)
    }]
  }]
}
```

Quy tắc đọc ngược: thiếu `vendorRefs` → tra theo tên như hiện nay; thiếu `recordKey` ở size → suy từ
`vendorRefs[0]`; thiếu `sizeOrder` → giữ thứ tự thư viện. **Không viết migration ghi đè blob**; bảng
cũ tự gắn trường mới ở lần Lưu kế tiếp.

## 2. `libSizeId` phải gắn recordKey — nếu không sẽ mất giá

Hiện `libSizeId(ptId, label)` = `szlib_<ptId>_<label>`. Khi một card gộp size của 2 vendor, cả hai
đều có size `S` → **trùng id** → React key trùng, `updateSize` patch nhầm dòng, giá vừa gõ nhảy sang
dòng của vendor khác.

Đổi thành `szlib_<ptId>_<recordKey>_<label>` (`utils/resolveSheet.js`). Thay đổi nhỏ nhưng là điều
kiện cần của nhánh 5 — làm trước mọi thứ khác, kèm test chống trùng id.

## 3. Backend — 3 việc

### 3.1 Index thư viện mang thêm thông tin phôi (nhánh 4)

`VendorLibraryIndexBuilder::build()` hiện chỉ đọc nhánh `pricing`. Thông tin phôi nằm ở
`generalInfo`. Bổ sung cho mỗi record một khối `vendorInfo`, ghép theo `kyHieu` + `productType`:

```php
'vendorInfo' => [
    'vendorName'    => …,   // tên vendor đầy đủ
    'kyHieu'        => …,   // đã có ở vendorCode, giữ để hiển thị nguyên văn
    'chatLieu'      => …,
    'sizeDetail'    => …,   // "Chi tiết size" (link hoặc khối text)
    'images'        => [],  // URL ảnh phôi
    'avgTimeVendor' => …,   // chỉ trả khi VendorFieldVisibility::seesLeadTime($role)
    'avgTimeActual' => …,
],
```

Ràng buộc: **giữ nguyên tầng lọc theo role đã có** — giá qua `seesPrices`, hai cột thời gian qua
`seesLeadTime` (`LEAD_TIME_ROLES` đã gồm seller). Không mở nhánh phân quyền thứ hai.

ETag hiện băm theo `vendor_library.updated_at` + project + role. Payload dày lên thì **phải đưa phiên
bản schema vào ETag** (ví dụ hằng `INDEX_SCHEMA = 2`), nếu không client đang giữ cache bản cũ sẽ nhận
`304` và **không bao giờ thấy `vendorInfo`**.

### 3.2 Giữ payload không phình vô ích

`vendorInfo` lặp lại cho mọi record của cùng một vendor. Trả `vendors: { "VN3": {…} }` ở cấp gốc, còn
record chỉ giữ `vendorCode` — payload nhỏ hơn nhiều và client tra bằng một phép truy cập map.

### 3.3 Không mở thêm đường ghi

Toàn bộ 5 nhánh chỉ ghi vào `price_sheets`. Thư viện Vendor **chỉ đọc** từ bảng tính giá — giữ
nguyên, và có test khẳng định: sau chuỗi thêm/sửa/xoá size, `vendorLibraryApi.save` được gọi **0 lần**.

## 4. Frontend — theo thứ tự làm

### PR-1 · Danh sách record + cột Vendor (nhánh 5 và 3, nút thắt)

- `utils/vendorLibraryIndex.js`: giữ **danh sách record** thay vì map theo tên. Thêm
  `listLibraryRecords(index, { vendor, q })` và `findLibraryRecord(index, recordKey)`;
  `findLibraryEntry(index, name)` **giữ nguyên** làm đường lùi cho bảng cũ.
- `AddProductTypeModal`: mỗi dòng là **một record** — `Product Type · VendorCode · file nguồn · n size`;
  thêm bộ lọc theo vendor; **bỏ `existingKeys`** (nhánh 3).
- `ProductTypeCard`: thêm khối **tích chọn vendor** (checkbox theo record). Tích 1 vendor → bảng như
  hiện nay. Tích ≥2 → `PriceTable` **hiện thêm cột Vendor** ngay cạnh cột Size.
- `resolveSheet`: dựng size theo **tập record đã tích**, mỗi dòng mang `recordKey`/`vendorCode`;
  record biến mất khỏi thư viện → dùng `costSnapshot` + badge `⚠ Record nguồn không còn`, **không im
  lặng đổi số**.

### PR-2 · Kéo chuột an toàn (nhánh 1)

- Bỏ hoàn toàn nhánh "kéo = xoá" trong `PriceTable.jsx`.
- Kéo chỉ tô vùng chọn; `mouseup` **không ghi gì**.
- Thanh hành động nổi: `Fill Down (n ô)` · `Xoá (n ô)` · `Bỏ chọn` — n lấy từ `computeFillDown` /
  `computeClear` (đã có), nên **số hiển thị luôn khớp số ô thực sự đổi**.
- Phím: `Ctrl+D` fill down, `Ctrl+R` fill right, `Delete` xoá vùng, `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo.
- Undo stack đặt ở `PriceSheetWorkspace` (dùng chung với PR-3), tối đa 20 bước.
- **Không đụng** `parsePastedPrices` / `distributeSizeAddValues` — đã có test riêng bảo vệ.

### PR-3 · Size & Customize (nhánh 2)

- Bỏ gate `!libEntry` cho `＋ Thêm Size` và cột Xoá; size Seller thêm mang `origin: 'manual'`.
- Size thư viện: sửa được **override cục bộ** (`overrides.label`, `overrides.itemCost`); nút
  `↺ Khôi phục theo thư viện` xoá mọi override + size tự thêm của card.
- `excluded`: dòng vẫn hiện, có ô tick "Loại khỏi tổng hợp"; `summarizeSheet` bỏ qua dòng này; file
  export vẫn có dòng đó kèm cột đánh dấu.
- Cảnh báo trực quan cho dòng `sizeAdd = 0` mà `profit < 0` (nghi chưa nhập giá, không phải lỗ thật).
- Thứ tự size: `pt.sizeOrder`; kéo bằng **tay cầm riêng ở cột đầu** (`⠿`) — không bắt sự kiện trên ô
  nhập; kèm nút `↑ ↓` và `Alt+↑/↓`, giữ focus trên dòng vừa di chuyển.
- Thứ tự cột Customize: kéo trên `<th>` + nút `← →`; **chỉ hoán vị mảng**, `ci.id` không đổi.
- `ci.defaultPrice`: ô nhập trong hộp thoại thêm cột, hai chế độ (mọi size / chỉ ô trống), xem trước
  "sẽ cập nhật n ô", áp hàng loạt đi qua undo stack.
- `ConfirmDialog` trước khi xoá dòng hoặc cột **đã có dữ liệu**.

### PR-4 · Thông tin phôi tại chỗ (nhánh 4)

- Nút `ⓘ Thông tin phôi` trên `ProductTypeCard` → panel mở **trong card** (collapse), không unmount
  workspace, **không đụng state đang gõ**.
- Nội dung đúng danh sách mindmap: Vendor Name · Product Type · Ký hiệu · Hình ảnh (lightbox dùng lại
  `admin/modals/Lightbox.jsx`) · Chất liệu · Chi tiết size · AVG TG (Vendor) · AVG TG (Thực tế).
- Tích ≥2 vendor → panel **tách theo từng vendor**, không trộn.
- Trường rỗng hiện badge `Thiếu dữ liệu` — không để ô trống im lặng.

## 5. UX — mấy quyết định dễ làm sai

| Tình huống | Cách xử lý |
|---|---|
| Bỏ tích một vendor trong khi các dòng của vendor đó **đã nhập giá** | Hỏi xác nhận, nêu rõ số dòng bị ảnh hưởng; mặc định là **ẩn** (giữ dữ liệu), chỉ xoá hẳn khi người dùng chọn |
| Kéo chuột giữa lúc đang gõ dở một ô | `mousedown` làm `blur` ô đang gõ để giá trị được commit trước khi vùng chọn thành hình |
| Fill Down xuống dòng `excluded` | Vẫn điền (dòng chỉ bị loại khỏi *tổng hợp*), nhưng đếm riêng trong nhãn nút |
| Undo sau khi đã bấm Lưu | Undo chỉ tác động state đang mở; nhãn nút Lưu đổi thành "Có thay đổi chưa lưu" để không ai tưởng đã ghi |
| Hai block cùng tên phôi | Chip chọn hiển thị `Tên · VendorCode`; cho sửa `displayLabel`, **không** đổi `name` |
| Cột Vendor khi chỉ có 1 vendor | Không hiện — thêm cột thừa cho 90% trường hợp là làm bảng chật vô ích |

**Đo hiệu suất (điều kiện nghiệm thu):** kịch bản *"nhập 30 giá size cho 3 Product Type"* — đếm số
thao tác chuột + phím trên Google Sheet và trên Hub, ghi số vào PR. Mục tiêu: **không nhiều hơn**
bảng tính.

## 6. Test — 4 tầng

Bộ test hiện có: `npm test` 196 case (17 file) và `npm run test:pending` 29 case đỏ-có-chủ-đích. Các
file pending dưới đây **đã viết sẵn assertion cho chính 5 nhánh mindmap** — làm xong PR nào thì bỏ
hậu tố `.pending` của file đó, nó thành cổng chặn merge.

### 6.1 Logic thuần (nhanh, chạy mọi lần lưu file)

| File | Phủ nhánh | Điểm chốt |
|---|---|---|
| `utils/__tests__/vendorRecords.pending.test.js` | 5, 3 | 2 vendor cùng tên phôi ⇒ 2 record, `recordKey` khác nhau; `findLibraryRecord` lấy đúng cost của vendor đã chọn (7.4 chứ không phải 8.2); record bị xoá ⇒ `warning: 'record-missing'` + dùng `costSnapshot`; **id dòng size duy nhất khi 2 block trùng tên** |
| `components/seller/pricesheet/__tests__/fillDown.test.js` (đang xanh) | 1 | Fill down/right, clear, undo nghịch đảo, `UNDO_LIMIT`, không mutate mảng gốc |
| `utils/__tests__/sizeStructure.pending.test.js` | 2 | Size Seller thêm không bị `resolveSheet` nuốt; override thắng giá thư viện; `restoreFromLibrary`; `excluded` không kéo tụt `avgMargin`; export vẫn có dòng excluded kèm cột đánh dấu |
| `utils/__tests__/sheetOrdering.pending.test.js` | 2 | `sizeOrder` giữ sau save → reload → export; đổi thứ tự **không** đổi giá và mapping customize; đổi tên/thứ tự cột không mất giá (mapping theo `ci.id`); `defaultPrice` áp đúng phạm vi |
| `utils/__tests__/pricingEngine.golden.test.js` (⛔ không sửa snapshot) | tất cả | Chạy toàn bộ dòng của một bảng "kiểu cũ" qua `thư viện → resolveSheet → computeSizeRow`. Snapshot đỏ = refactor đã làm **đổi số tiền** của bảng đang chạy thật |

Bổ sung mới cần viết:

- `utils/__tests__/vendorMix.test.js` — một card gộp 2 vendor: mỗi dòng có `recordKey` đúng,
  `computeSizeRow` lấy `itemCost` theo đúng dòng, sửa dòng vendor A **không** đụng dòng vendor B, và
  `roundTrip` giữ nguyên ánh xạ dòng → vendor.
- `utils/__tests__/libraryReadonly.test.js` — spy `vendorLibraryApi.save`: **0 lần gọi** sau chuỗi
  thêm/sửa/xoá size và override; `libIndex` deep-equal trước và sau.

### 6.2 UI + tương tác (component test, jsdom)

| File | Phủ | Assertion không được thiếu |
|---|---|---|
| `priceTableDrag.pending.test.jsx` | 1 | `mouseDown → mouseEnter → mouseUp`: `onUpdateSize` **không được gọi lần nào**, 5 ô giữ nguyên giá trị (test mang tên *regression 2026-08*); thanh hành động hiện đúng số ô; Fill Down / Ctrl+Z / Ctrl+D / Delete cho đúng patch |
| `vendorPicker.test.jsx` (mới) | 5 | Tích 1 vendor: **không** có cột Vendor. Tích vendor thứ hai: cột Vendor xuất hiện, mỗi dòng hiện đúng `vendorCode`, số dòng = tổng size của 2 record. Bỏ tích khi đã nhập giá ⇒ hiện xác nhận, dữ liệu **còn nguyên** khi bấm Huỷ |
| `sizeRowOps.test.jsx` (mới) | 2 | `＋ Thêm Size` và nút Xoá hiện ở **cả hai** chế độ (`describe.each` cho PT thư viện và PT nhập tay); xoá dòng đã có giá ⇒ hỏi xác nhận; tick "Loại khỏi tổng hợp" ⇒ Avg Margin ở footer đổi đúng |
| `sizeOrder.interaction.test.jsx` (mới) | 2 | `Alt+↑` đổi đúng 1 bậc; **focus vẫn nằm trên dòng vừa di chuyển**; nút ↑↓ cho kết quả giống kéo; bắt đầu kéo từ ô nhập **không** kích hoạt sắp xếp |
| `customizeOrder.interaction.test.jsx` (mới) | 2 | Kéo `<th>` đổi thứ tự cột nhưng **giá từng ô không đổi** (so `Map(label → customize)` trước/sau) |
| `phoiInfoPanel.test.jsx` (mới) | 4 | Gõ giá vào 1 ô → mở panel → đóng: giá **còn nguyên** và input **không remount** (so node identity qua `data-testid`); 2 vendor ⇒ 2 khối thông tin riêng; trường rỗng ⇒ badge `Thiếu dữ liệu` |

### 6.3 Backend (PHPUnit)

| File | Assertion |
|---|---|
| `VendorLibraryIndexTest.php` (mở rộng) | Record trả đúng `vendorInfo`; 2 vendor cùng product type ⇒ **2 record** với `recordKey` khác nhau; đổi schema ⇒ ETag đổi (client không kẹt `304` với payload cũ) |
| `VendorLibraryLeadTimeTest.php` (đã có) | Seller/CSF thấy `avgTimeVendor` / `avgTimeActual`; PD/Marvel **không** — assert trên **raw body** |
| `VendorLibraryPriceLeakTest.php` (đang `pending`) | `vendorInfo` không kéo theo bất kỳ khoá giá nào cho role không có quyền |
| `PriceSheetConcurrencyTest.php` (đã có) | Bảng nhiều vendor lưu rồi lưu lại: `version` tăng đúng, xung đột trả 409 kèm bản server |
| `PriceSheetListPayloadTest.php` (đã có) | Thêm vendor/size **không** làm danh sách trả kèm `productTypes` / `history` |

### 6.4 Trên bundle thật (tầng duy nhất bắt lỗi sau minify)

`npm run test:smoke` — `#root` render, không exception, không conflict marker trong `dist`.
**Bổ sung cho PR-2**: kịch bản CDP lặp lại đúng thao tác kéo chuột đã gây mất giá, kiểm giá còn
nguyên trên bundle đã build. Cần backend chạy kèm + tài khoản seed, nên làm cùng PR-2.

### 6.5 Verify tay trước deploy (test tự động không thay được)

1. Mở một bảng giá **cũ**: Total / Profit / Margin **y hệt** trước deploy.
2. Kéo chuột qua cột Giá Size → không mất giá; Fill Down → đúng; `Ctrl+Z` → hoàn tác.
3. Tích 2 vendor cùng phôi → cột Vendor hiện; Item Cost hai dòng khác nhau; save → F5 → export Excel:
   cả ba nơi khớp.
4. Thêm size mới ở PT lấy từ thư viện → save → F5 → vẫn còn.
5. Đổi thứ tự size và thứ tự cột customize → save → F5 → export: thứ tự và giá đều đúng.
6. Mở panel thông tin phôi giữa lúc đang gõ → đóng → giá đang gõ còn nguyên.

## 7. Rủi ro & cách chặn

| Rủi ro | Chặn bằng |
|---|---|
| Đổi `libSizeId` làm bảng cũ mất ánh xạ dòng | Fallback: không có `recordKey` thì dùng id cũ; golden test + `roundTrip` trên fixture bảng cũ |
| Refactor index làm đổi số tiền | `pricingEngine.golden.test.js` — **không được sửa snapshot** |
| Client giữ ETag cũ, không bao giờ thấy `vendorInfo` | Đưa phiên bản schema vào ETag (§3.1) + test backend cho ETag |
| Payload index phình vì `vendorInfo` lặp | Tách `vendors` map ở cấp gốc (§3.2) |
| Conflict `frontend/dist` giữa các PR | Làm **tuần tự**; mỗi PR merge xong rebase PR sau và chạy lại `npx vite build`; tuyệt đối không resolve tay bundle minified |
| Hai Seller cùng sửa một bảng | Đã có `version` + 409; `PriceSheetConcurrencyTest` phải xanh trước khi bật các nút mới |

## 8. Thứ tự PR đề nghị

1. **PR-1** record + cột Vendor (nhánh 5 và 3) — nút thắt, làm trước.
2. **PR-2** kéo an toàn + phím tắt (nhánh 1) — đang **mất dữ liệu thật**, ưu tiên cao nhất về nghiệp
   vụ nhưng phụ thuộc id dòng ở PR-1 nên xếp thứ hai.
3. **PR-3** size & customize (nhánh 2).
4. **PR-4** thông tin phôi (nhánh 4) — cần backend `vendorInfo`; chạy song song được từ đầu vì không
   đụng `PriceTable`.

Mỗi PR chỉ được merge khi: bộ test tương ứng đã **bỏ `.pending`** và xanh, `npm test` xanh,
`php artisan test` xanh trên CI, `dist` đã rebuild, và mục 6.5 đã chạy tay.
