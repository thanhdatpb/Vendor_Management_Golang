# Backend Schema — Các endpoint cần implement để loại bỏ localStorage

## 1. Notifications (QUAN TRỌNG NHẤT — cross-device broken hiện tại)

### Bảng `notifications`

```sql
CREATE TABLE notifications (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    for_role    VARCHAR(20) NOT NULL,   -- 'staff_a' | 'staff_b' | 'seller' | 'admin'
    from_role   VARCHAR(20) NULL,       -- role người gửi (optional)
    type        VARCHAR(50) NOT NULL,   -- 'product_approved' | 'feedback_from_b' | 'sample_approved' | 'news' | ...
    product_id  BIGINT UNSIGNED NULL,
    data        JSON NULL,              -- { title, message, icon, vendorType, ... }
    is_read     TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
```

### Routes cần thêm

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    // Filter theo role của user đang đăng nhập: WHERE for_role = auth()->user()->role
    // Trả về: { data: [...], meta: { unread_count: N } }

    Route::post('/notifications', [NotificationController::class, 'store']);
    // Body: { for_role, type, product_id?, data: {...} }
    // from_role tự lấy từ auth()->user()->role

    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
});
```

### Logic index (filter theo role)

```php
// NotificationController::index
public function index(Request $request)
{
    $roleMap = [
        'admin'  => 'admin',
        'staffa' => 'staff_a',
        'staff'  => 'staff_a',
        'seller' => 'staff_a',   // Staff A / Seller đọc cùng channel
        'staffb' => 'staff_b',
        'vendor' => 'staff_b',
    ];
    $forRole = $roleMap[auth()->user()->role] ?? auth()->user()->role;

    $notifications = Notification::where('for_role', $forRole)
        ->orderBy('created_at', 'desc')
        ->limit(100)
        ->get();

    return response()->json(['data' => $notifications]);
}
```

---

## 2. Assigned Vendors per Product

### Endpoint cần thêm

```php
Route::get('/products/{id}/assigned-vendors', [ProductController::class, 'assignedVendors']);
// Trả về: { data: [...vendors] }
// Hiện đã có: POST /products/{id}/assign-vendors — lưu vào bảng product_vendor_assignments
```

### Bảng `product_vendor_assignments` (nếu chưa có)

```sql
CREATE TABLE product_vendor_assignments (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id  BIGINT UNSIGNED NOT NULL,
    vendor_data JSON NOT NULL,   -- lưu toàn bộ object vendor
    assigned_by BIGINT UNSIGNED NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## 3. Vendor Feedback

### Endpoint cần thêm

```php
Route::get('/products/{id}/vendor-feedback', [VendorFeedbackController::class, 'index']);
Route::post('/products/{id}/vendor-feedback', [VendorFeedbackController::class, 'store']);
Route::put('/products/{id}/vendor-feedback/{vendorKey}', [VendorFeedbackController::class, 'respond']);
```

### Bảng `vendor_feedbacks`

```sql
CREATE TABLE vendor_feedbacks (
    id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id            BIGINT UNSIGNED NOT NULL,
    vendor_key            VARCHAR(100) NOT NULL,   -- unique key của vendor trong product
    feedback_text         TEXT NULL,
    staff_b_approved      TINYINT(1) DEFAULT 0,
    staff_a_status        ENUM('pending','approved','rejected') DEFAULT 'pending',
    staff_a_note          TEXT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_vendor (product_id, vendor_key),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## 4. Sample Decisions

### Endpoint cần thêm

```php
Route::get('/products/{id}/sample-decisions', [SampleDecisionController::class, 'index']);
Route::post('/products/{id}/sample-decisions', [SampleDecisionController::class, 'store']);
```

### Bảng `sample_decisions`

```sql
CREATE TABLE sample_decisions (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id     BIGINT UNSIGNED NOT NULL,
    vendor_id      BIGINT UNSIGNED NULL,
    vendor_type    VARCHAR(100) NULL,
    decision       ENUM('dat','khong') NOT NULL,
    sample_details TEXT NULL,
    decided_by     BIGINT UNSIGNED NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## 5. Vendor Selections (Staff A / Staff B đánh dấu vendor)

### Endpoint cần thêm

```php
Route::get('/products/{id}/vendor-selections', [VendorSelectionController::class, 'index']);
// Params: ?role=staff_a | staff_b

Route::post('/products/{id}/vendor-selections', [VendorSelectionController::class, 'save']);
// Body: { role: 'staff_a', selections: { [vendorKey]: { checked: true, ... } } }
```

### Bảng `vendor_selections`

```sql
CREATE TABLE vendor_selections (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id   BIGINT UNSIGNED NOT NULL,
    role         VARCHAR(20) NOT NULL,
    vendor_key   VARCHAR(100) NOT NULL,
    is_selected  TINYINT(1) DEFAULT 0,
    extra_data   JSON NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_vendor (product_id, role, vendor_key),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

---

## 6. Vendor Price Setups

### Endpoint cần thêm

```php
Route::get('/vendor-price-setups', [PriceSetupController::class, 'index']);
Route::post('/vendor-price-setups', [PriceSetupController::class, 'save']);
```

### Bảng `vendor_price_setups`

```sql
CREATE TABLE vendor_price_setups (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id       BIGINT UNSIGNED NULL,
    product_type    VARCHAR(100) NULL,
    eco_price       DECIMAL(10,2) NULL,
    fast_price      DECIMAL(10,2) NULL,
    express_price   DECIMAL(10,2) NULL,
    overnight_price DECIMAL(10,2) NULL,
    extra_data      JSON NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## Thứ tự triển khai backend (theo priority)

1. **POST /notifications** + update GET /notifications filter by role — unblocks toàn bộ cross-device notification
2. **GET /products/{id}/assigned-vendors** — unblocks Seller xem vendor được gán
3. **GET+POST /products/{id}/vendor-feedback** — unblocks feedback workflow
4. **GET+POST /products/{id}/sample-decisions** — unblocks sample decision workflow
5. **GET+POST /products/{id}/vendor-selections** — vendor selection sync
6. **GET+POST /vendor-price-setups** — price setup persistence
