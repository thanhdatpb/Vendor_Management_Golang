# Sơ đồ Quan hệ Database — TechStore Hub

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email
        string password
        string role "admin | staff_a | staff_b"
        string seller_name
        boolean is_active
        string project
        timestamp created_at
    }

    PRODUCTS {
        int id PK
        int vendor_id FK
        int created_by FK
        string product_type
        string status "draft | pending | approved | rejected"
        string seller_name
        string material
        string print_area
        string other_specs
        string good_review
        string bad_review
        string packaging_links
        string other_packaging
        string product_type_links "JSON array"
        string media_url
        string media_urls "JSON array"
        date deadline_date
        string rejection_reason
        timestamp submitted_at
        timestamp reviewed_at
        timestamp created_at
    }

    VENDORS {
        int id PK
        string name
        string email
        string phone
        string category
        string vendor_type "Old | New | Best Seller"
        decimal pricing1
        decimal pricing2
        decimal eco_price
        decimal eco_total
        decimal fast_price
        decimal fast_total
        decimal express_price
        decimal express_total
        decimal overnight_price
        decimal overnight_total
        string size
        string optional
        string media_url
        timestamp created_at
    }

    VENDOR_DETAILS {
        int id PK
        int vendor_id FK
        string product_type
        decimal base_price
        decimal printing_price
        decimal shipping_fee
        int min_order_qty
        int lead_time
        decimal rating
        timestamp created_at
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK
        string type
        string title
        text body
        boolean is_read
        int product_id FK
        timestamp created_at
    }

    CUSTOMERS {
        int id PK
        string name
        string email
        string phone
        timestamp created_at
    }

    ORDERS {
        int id PK
        string order_number
        int customer_id FK
        decimal total
        string status "pending | completed | cancelled"
        timestamp created_at
    }

    ORDER_ITEMS {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal price
    }

    PAYMENTS {
        int id PK
        int order_id FK
        decimal amount
        string method
        string status
        timestamp paid_at
    }

    INVENTORY_LOGS {
        int id PK
        int product_id FK
        int quantity_change
        string reason
        timestamp created_at
    }

    %% ── Relationships ────────────────────────────────────
    USERS ||--o{ PRODUCTS : "tạo (staff_a creates)"
    VENDORS ||--o{ PRODUCTS : "được gán vào (assigned to)"
    VENDORS ||--o{ VENDOR_DETAILS : "có chi tiết giá"
    USERS ||--o{ NOTIFICATIONS : "nhận thông báo"
    PRODUCTS ||--o{ NOTIFICATIONS : "kích hoạt thông báo"
    CUSTOMERS ||--o{ ORDERS : "đặt hàng"
    ORDERS ||--o{ ORDER_ITEMS : "chứa sản phẩm"
    PRODUCTS ||--o{ ORDER_ITEMS : "thuộc đơn hàng"
    ORDERS ||--o{ PAYMENTS : "có thanh toán"
    PRODUCTS ||--o{ INVENTORY_LOGS : "theo dõi tồn kho"
```

---

## Tóm tắt quan hệ chính

| Quan hệ | Mô tả |
|---|---|
| `Users` → `Products` | **1-N** — Mỗi Staff A (Kinh doanh) tạo nhiều Phôi yêu cầu |
| `Vendors` → `Products` | **1-N** — Một Vendor được gán cho nhiều Phôi (bởi Staff B) |
| `Vendors` → `Vendor_Details` | **1-N** — Mỗi Vendor có nhiều bảng giá theo từng loại sản phẩm |
| `Users` → `Notifications` | **1-N** — Mỗi User nhận nhiều thông báo |
| `Products` → `Notifications` | **1-N** — Một Phôi khi thay đổi trạng thái sẽ tạo ra thông báo |
| `Customers` → `Orders` | **1-N** — Mỗi khách hàng có nhiều đơn hàng |
| `Orders` → `Order_Items` | **1-N** — Mỗi đơn hàng có nhiều dòng sản phẩm |
| `Orders` → `Payments` | **1-1** — Mỗi đơn hàng có một lần thanh toán |

---

## Luồng dữ liệu theo vai trò (Data Flow by Role)

```
Staff A (Kinh doanh)
    └─ Tạo PRODUCT (status: draft)
    └─ Gửi duyệt → PRODUCT (status: pending)

Admin (Quản trị)
    └─ Xem PRODUCT pending
    └─ Duyệt → PRODUCT (status: approved)  → tạo NOTIFICATION cho Staff A
    └─ Từ chối → PRODUCT (status: rejected) → tạo NOTIFICATION cho Staff A

Staff B (Vận hành)
    └─ Xem PRODUCT approved
    └─ Tìm VENDOR phù hợp → gán VENDOR_ID vào PRODUCT
    └─ So sánh giá qua VENDOR_DETAILS (Price Matrix)
    └─ Gửi NOTIFICATION cho Staff A về kết quả

Staff A (Kinh doanh)
    └─ Nhận NOTIFICATION từ Staff B
    └─ Xác nhận / Từ chối Vendor
```
