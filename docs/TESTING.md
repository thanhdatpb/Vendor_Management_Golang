# Bộ test trước khi lên production — HappyC Vendor Hub

Tài liệu này ánh xạ **từng gạch đầu dòng trong nhánh "Mục tiêu đạt được"** của mindmap feedback
(`HappyC_VendorHub_Feedback_Roadmap_v2.md`) sang **một file test cụ thể**, đúng nguyên tắc ở
mục "Chiến lược test" của `HappyC_VendorHub_Fix_Plan_v1.md`.

## 1. Hai bộ test, hai vai trò khác nhau

| Bộ | Lệnh | Ý nghĩa khi ĐỎ |
|---|---|---|
| **Chặn merge** | `npm test` (frontend) · `php artisan test --exclude-group=pending` (backend) | Có thứ đang chạy tốt vừa bị làm hỏng → **không được merge** |
| **Mục tiêu chưa đạt** | `npm run test:pending` · `php artisan test --group=pending` | **Đỏ là đúng.** Đây là danh sách việc còn lại của kế hoạch fix, viết sẵn thành assertion |

Quy ước đặt tên:

- Frontend: file `*.pending.test.js(x)` → thuộc bộ "chưa đạt". Bỏ hậu tố `.pending` = thăng lên bộ chặn merge.
- Backend: class có `#[Group('pending')]` → thuộc bộ "chưa đạt". Bỏ attribute = thăng lên bộ chặn merge.

**Khi một PR hoàn thành mục tiêu của nó, việc cuối cùng của PR là thăng test tương ứng.** Test đã
thăng mà đỏ trở lại nghĩa là tính năng bị hồi quy.

## 2. Chạy

```bash
# Frontend (Node 20+)
cd frontend
npm ci
npm test                 # bộ chặn merge
npm run test:pending     # mục tiêu chưa đạt — đỏ là đúng
npm run test:watch       # vừa sửa vừa chạy

# Bundle đã build (bắt lỗi chỉ xuất hiện sau minify)
npx vite build
npm run check:realtime   # bundle phải có key/cluster Pusher (PR-R3a)
npm run test:smoke       # #root có render, không exception, không conflict marker

# Backend (PHP 8.2+)
cd backend
composer install
php artisan test --exclude-group=pending
php artisan test --group=pending
```

CI chạy đúng các lệnh này trong `.github/workflows/tests.yml`. Job `*-pending` để
`continue-on-error: true` nên đỏ ở đó không chặn merge — nó là bảng tiến độ.

## 3. Bộ chặn merge (đang xanh)

| File | Bảo vệ điều gì |
|---|---|
| `frontend/src/utils/__tests__/pricingEngine.golden.test.js` | **⛔ Không sửa snapshot.** Chạy toàn bộ dòng size của một bảng giá kiểu cũ qua `thư viện → resolveSheet → computeSizeRow`. Đỏ = refactor đã làm đổi số tiền của bảng đang chạy thật |
| `frontend/src/utils/__tests__/pricingEngine.test.js` | Công thức bản chỉnh Luận Nguyễn 2026-07-16: qty, Coupon% chỉ trên phần hàng, AMZ trên (Total − Coupon), Variable ≠ 0 khi coupon = 0, Total Cost theo ship của thư viện |
| `frontend/src/utils/__tests__/vendorLibraryIndex.test.js` | Lọc file theo project, bỏ size `N/A`, Item Cost = cột P1, ship theo từng phương thức |
| `frontend/src/utils/__tests__/resolveSheet.test.js` | Bind thư viện không mất giá đã nhập; id dòng size ổn định qua mỗi lần resolve (chống remount input); **không mutate thư viện gốc** |
| `frontend/src/utils/__tests__/sheetSerialization.test.js` | save → reload → export cho ra đúng một kết quả; mapping cột customize bám `ci.id` |
| `frontend/src/components/seller/pricesheet/__tests__/pastePrices.test.js` | Dán nhiều giá từ Google Sheet (TSV, khớp theo tên size, phần dư rải tuần tự) |
| `frontend/src/components/seller/pricesheet/__tests__/fillDown.test.js` | Fill Down / Fill Right / xoá vùng / undo — logic thuần, kể cả cột customize |
| `frontend/src/components/seller/pricesheet/__tests__/priceTableDrag.test.jsx` (thăng cấp trước 2026-08-28) | Kéo dọc CHỈ chọn vùng, `mouseup` không ghi gì (regression 2026-08); Fill Down / Ctrl+Z / Ctrl+D / Delete |
| `frontend/src/utils/__tests__/sizeStructure.test.js` (thăng cấp 2026-08-28) | Size Seller tự thêm sống sót qua resolveSheet; override cục bộ; `restoreFromLibrary`; dòng `excluded` không kéo tụt avgMargin |
| `frontend/src/utils/__tests__/sheetOrdering.test.js` (thăng cấp 2026-08-28) | `sizeOrder` giữ sau save/reload/export; đổi thứ tự cột Customize không đổi giá (mapping theo `ci.id`); `defaultPrice` cho size mới |
| `frontend/src/utils/__tests__/vendorRecords.test.js` (thăng cấp 2026-08-28) | 2 vendor cùng tên phôi ⇒ 2 record độc lập, không đè giá |
| `frontend/src/utils/__tests__/libraryReadonly.test.js` (mới 2026-08-28) | Chuỗi thêm/sửa/xoá/khôi phục size trong bảng tính giá KHÔNG gọi `vendorLibraryApi.save`, `libIndex` không đổi bit nào |
| `frontend/src/components/seller/pricesheet/__tests__/sizeRowOps.test.jsx` (mới 2026-08-28) | Thêm/xoá size ở cả 2 loại Product Type; ConfirmDialog khi xoá dòng đã có giá; nút Khôi phục theo thư viện |
| `frontend/src/components/seller/pricesheet/__tests__/sizeOrder.interaction.test.jsx` (mới 2026-08-28) | Nút ▲▼/◀▶ và Alt+mũi tên đổi thứ tự size/cột customize, không đổi giá; kéo bắt đầu từ ô Giá Size vẫn chỉ chọn vùng |
| `frontend/src/services/__tests__/realtime.test.js` | Đăng ký kênh realtime theo project, payload chỉ mang tín hiệu, huỷ listener khi unmount |
| `backend/tests/Feature/PriceSheetProjectScopeTest.php` | Seller chỉ thấy project mình; lưu bị ép về project của mình; xoá chéo project → 403 |
| `backend/tests/Feature/PriceSheetListPayloadTest.php` | Danh sách không kèm `history`/`productTypes`; payload không phình theo số lần Lưu; `/{id}` và `/{id}/versions` nạp riêng |
| `backend/tests/Feature/PriceSheetConcurrencyTest.php` · `PriceSheetVersionBackfillTest.php` | Xung đột phiên bản trả 409 thay vì âm thầm ghi đè; backfill lịch sử không mất dữ liệu |
| `backend/tests/Feature/VendorLibraryIndexTest.php` · `VendorLibraryBroadcastTest.php` | Index thư viện gọn + ETag; mỗi endpoint ghi thư viện phát đúng 1 sự kiện |
| `backend/tests/Unit/PriceSheetSummaryTest.php` · `VendorFieldVisibilityTest.php` | Số liệu tổng hợp của bảng giá; danh sách cột được hiện theo role |

## 4. Mục tiêu chưa đạt (đỏ có chủ đích)

### Frontend

| File | Mục trong mindmap | PR mở khoá |
|---|---|---|
| `priceTableDrag.pending.test.jsx` | **01** — kéo chuột KHÔNG được xoá giá; Fill Down; Ctrl+Z; Ctrl+D; Delete | PR-A1 + Milestone P — **đã thăng cấp** (nay chạy ở `npm test`, xem mục 3) |
| `cloneSheet.pending.test.js` | **08** — clone độc lập hoàn toàn, remap `customize[ciId]` theo id mới | PR-A2 |
| `pricePrivacy.pending.test.js` | **PR-S3 (tầng client)** — không khoá giá nào lọt vào props của CSF/PD/Marvel | Milestone S |
| `roleRoute.pending.test.js` | **PR-S5** — một nơi duy nhất quyết định role → route; role lạ không rơi im lặng về `/seller` | Milestone S |

> `sizeStructure.pending.test.js`, `sheetOrdering.pending.test.js` và `vendorRecords.pending.test.js`
> đã thăng cấp bỏ hậu tố `.pending` ngày 2026-08-28 (mục 02, 05, 06, 03/04) — xem mục 3.

### Backend

| File | Mục | Nội dung |
|---|---|---|
| `PriceSheetPermissionTest.php` | PR-S1 | Marvel/CSF/PD đọc–ghi–xoá bảng giá đều phải 403; **Marvel phải cho kết quả y hệt CSF** |
| `VendorLibraryPermissionTest.php` | PR-S2 | Chỉ `vendor`/`staff_b` ghi được thư viện; role khác 403 **và blob không đổi**; mọi role vẫn ĐỌC được |
| `VendorLibraryPriceLeakTest.php` | PR-S3 | Assert trên **raw body**: CSF/PD/Marvel không nhận bất kỳ khoá giá nào, nhưng vẫn đủ chất liệu/size/link |

## 5. Refactor T0 đã làm để test được (không đổi hành vi)

| Tách ra | Từ | Vì sao |
|---|---|---|
| `utils/sheetExport.js` — `buildSheetAoa`, `exportFileName` | `exportSheetToExcel` trong `PriceSheetWorkspace.jsx` | Assert nội dung file Excel mà không cần ghi file thật |
| `utils/resolveSheet.js` — `resolveSheet`, `libSizesOf`, `libSizeId`, `baseSizesOf` | `draftSheet` useMemo trong `PriceSheetWorkspace.jsx` | Test toàn bộ mục 02/03/04/05 mà không render React |
| `components/seller/pricesheet/fillDown.js` | logic mới của PR-A1 | Test kéo/fill/undo thuần, không mô phỏng chuột |

`PriceSheetWorkspace.jsx` vẫn re-export `exportSheetToExcel` nên `SetupPriceSection.jsx` giữ nguyên
đường import cũ. Đã build lại `frontend/dist` và chạy `npm run test:smoke` để chắc chắn bundle không
trắng trang sau refactor.

## 6. Fixture

`frontend/src/test/fixtures/` — xem `README.md` trong thư mục đó.

Hai điểm bắt buộc:

1. `vendorLibrary.sample.json` phải luôn có **≥ 1 tên phôi được 2 vendor cung cấp** (đang là
   `Football Jersey` của `VN3` và `VN7`) — đó chính là ca lỗi của mục 03.
2. `legacySheet.json` hiện là **dữ liệu dựng tay theo đúng schema thật**. Kế hoạch (T1) yêu cầu thay
   bằng một bảng giá **thật lấy từ production** rồi ẩn danh, giữ nguyên mọi con số. Chỉ khi đó golden
   test mới thực sự là lưới an toàn cho "không gián đoạn production".

## 7. Việc còn thiếu, cần quyết định

- **Golden test đang chạy trên fixture dựng tay**, chưa phải dữ liệu production (mục 6.2).
- **Smoke test chưa lặp lại thao tác kéo chuột của mục 01 trên bundle thật** — cần backend chạy kèm
  và một tài khoản seed để đăng nhập. Ghi trong `scripts/smoke-pricesheet.mjs`.
- **Chưa chạy được test backend trên máy dev này** (không có PHP/composer trong PATH). Các file
  `backend/tests/Feature/*` mới viết theo đúng khuôn của test sẵn có nhưng **chưa được thực thi lần
  nào** — lần chạy đầu tiên sẽ ở CI hoặc trên máy có PHP.
- **Job backend trong CI dùng APP_KEY cố định** vì repo chưa có `.env.example` (đúng như PR-D3 đã
  chỉ ra). Khi bổ sung `.env.example`, nên chuyển sang `cp .env.example .env && php artisan key:generate`.
- **Thu hồi quyền ngay khi khoá tài khoản (PR-R4)** chưa có test: cần `AuthRevocationTest.php`
  khẳng định `is_active = false` ⇒ request kế tiếp bằng token cũ trả 401.
- **Kiểm bằng 2 trình duyệt** (mục 7 phần "Verification thủ công" của kế hoạch fix) không thay được
  bằng test tự động: A lưu → B thấy danh sách đổi mà không F5; B lưu bản cũ → nhận 409.

## 8. Số liệu lần chạy gần nhất (2026-08-28, máy dev Windows — nhánh `fix/seller-price-sheet-size-customize`)

| Bộ | Kết quả |
|---|---|
| `npm test` | **332/332 xanh** (33 file) — tăng từ 279 sau khi thăng cấp `sizeStructure`/`sheetOrdering`/`vendorRecords` và thêm `libraryReadonly`/`sizeRowOps`/`sizeOrder.interaction` |
| `npm run test:pending` | **7 đỏ / 10 xanh** (3 file: `cloneSheet` mục 08, `pricePrivacy` + `roleRoute` Milestone S — ngoài phạm vi PR này) |
| `npm run check:realtime` | xanh |
| `npm run test:smoke` | xanh — `#root` render, không exception, không conflict marker (chạy lại 3 lần liên tiếp để loại trừ flaky do port `vite preview` còn giữ từ lần trước) |
| `php artisan test` | chưa chạy — không đụng backend trong PR này |
