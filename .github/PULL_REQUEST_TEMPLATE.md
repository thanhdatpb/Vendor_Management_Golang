## Mô tả thay đổi

<!-- Tóm tắt: làm gì, vì sao. Đính kèm screenshot nếu đổi UI. -->

## ✅ Checklist bắt buộc

- [ ] **Nếu sửa `frontend/src/**`**: đã chạy `npx vite build` và **commit lại `frontend/dist/`** (production serve trực tiếp bundle đã commit — KHÔNG tự rebuild khi push).
- [ ] **KHÔNG resolve conflict thủ công trong `frontend/dist/`** — nếu dist bị conflict, resolve ở `src/` rồi build lại để tái tạo dist (sót marker = trắng trang production).
- [ ] Không commit secret/key (`.env`, token, password).
- [ ] Đã test luồng bị ảnh hưởng trên local.

## 👥 Vai trò bị ảnh hưởng

- [ ] Admin
- [ ] Seller / Staff A
- [ ] Vendor / Staff B
- [ ] CSF (read-only, ẩn giá)
- [ ] PD (read-only, ẩn giá)

<!-- Nếu đụng tới Vendor Library / bảng giá: xác nhận CSF & PD KHÔNG thấy bất kỳ trường giá nào. -->
