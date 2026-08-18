# Fixture cho bộ test bảng tính giá

## Trạng thái hiện tại

Hai fixture dưới đây được **dựng tay theo đúng schema thật** (khớp `parseHappyCreativeLibrary`
trong `utils/vendorExcel.js` và schema `sheet` trong `utils/pricingEngine.js`), chưa phải dữ liệu
lấy từ production.

| File | Vai trò | Đặc điểm bắt buộc phải giữ |
|---|---|---|
| `vendorLibrary.sample.json` | thư viện Vendor rút gọn | **≥1 tên phôi được 2 vendor cung cấp** (`Football Jersey` của `VN3` và `VN7`, `pricing1` khác nhau) — đúng ca lỗi mục 03 |
| `legacySheet.json` | một bảng tính giá "kiểu cũ" | có cả Product Type **từ thư viện** lẫn **nhập tay**; có dòng `sizeAdd = 0` để chốt ảnh hưởng lên `avgMargin` |

## Việc còn lại (T1 của kế hoạch fix)

Kế hoạch yêu cầu golden test chạy trên **bảng giá thật đang chạy production**. Khi có quyền truy
cập DB production:

```sql
-- lấy 1 bảng giá đại diện (nhiều Product Type, nhiều size, có cột customize)
SELECT data FROM price_sheets ORDER BY updated_at DESC LIMIT 1;
```

1. Ẩn danh: đổi `name`, `vendorRef`, tên Product Type và tên Vendor. **Giữ nguyên mọi con số** —
   golden test mất giá trị nếu số bị làm tròn hay thay đổi.
2. Ghi đè `legacySheet.json`; trích phần `vendor_library` tương ứng ghi đè `vendorLibrary.sample.json`
   (nhớ giữ ca 2 vendor cùng tên phôi).
3. Chạy `npm test -- -u` một lần để cập nhật inline snapshot trong `pricingEngine.golden.test.js`,
   **đối chiếu bằng mắt** với số hiển thị trên production trước khi commit.
4. Từ đó trở đi **không sửa** snapshot nữa: snapshot đỏ = refactor đã làm đổi số tiền của bảng giá
   đang chạy thật.
