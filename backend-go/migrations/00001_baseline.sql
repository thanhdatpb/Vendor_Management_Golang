-- +goose Up
-- +goose StatementBegin
-- Baseline dựng lại đúng 10 bảng backend-go thực sự dùng, tái tạo từ 69
-- migration Laravel (backend/database/migrations, đọc thủ công ngày
-- 2026-09-26 — không có PHP/Docker để chạy `php artisan migrate` rồi dump
-- schema thật). Ba loại bảng KHÔNG có ở đây, cố ý:
--
--   1. Bảng chết chưa từng được backend-go hay `grep` trong app/ chạm tới:
--      customers, orders, order_items, payments, inventory_logs,
--      vendor_details, vendor_comparisons, request_vendors.
--   2. Bảng khung Laravel mà backend-go không dùng: cache, cache_locks,
--      jobs, job_batches, failed_jobs, sessions, password_reset_tokens.
--      Go dùng Redis cho cache-version-counter và outbox (cột email_status
--      của chính bảng notifications) cho hàng đợi email — không cần bảng
--      riêng nào của queue/cache Laravel.
--   3. Cột đã tồn tại trong $fillable của model PHP nhưng chưa từng có
--      migration tạo ra (vd users.avatar) — code thừa phía PHP, không phải
--      cột thật trong DB.
--
-- Xác nhận qua `grep -rhoE "FROM|INTO|UPDATE|JOIN" backend-go/internal/`:
-- đúng 10 bảng dưới đây, không hơn không kém.
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE users (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    email_verified_at   TIMESTAMP NULL,
    password            VARCHAR(255) NULL,
    remember_token      VARCHAR(100) NULL,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    google_id           VARCHAR(255) NULL,
    avatar_url          TEXT NULL,
    role                VARCHAR(255) NOT NULL DEFAULT 'staff',
    seller_name         VARCHAR(255) NULL,
    full_name           VARCHAR(255) NULL,
    project             VARCHAR(255) NULL,
    last_seen_at        TIMESTAMP NULL,
    pd_projects         JSON NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    -- KHÔNG unique trên email/google_id: một email có thể ứng với nhiều dòng
    -- user (mỗi role/project một dòng). Tính duy nhất theo (email, role,
    -- project) được đảm bảo ở tầng ứng dụng, không phải ở DB — xem
    -- 2026_07_25_000001_drop_unique_email_from_users_table.php.
    INDEX users_email_index (email),
    INDEX users_google_id_index (google_id),
    INDEX users_role_index (role),
    INDEX users_project_index (project)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE personal_access_tokens (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tokenable_type  VARCHAR(255) NOT NULL,
    tokenable_id    BIGINT UNSIGNED NOT NULL,
    name            TEXT NOT NULL,
    token           VARCHAR(64) NOT NULL,
    abilities       TEXT NULL,
    last_used_at    TIMESTAMP NULL,
    expires_at      TIMESTAMP NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    UNIQUE KEY personal_access_tokens_token_unique (token),
    INDEX personal_access_tokens_tokenable_type_tokenable_id_index (tokenable_type, tokenable_id),
    INDEX personal_access_tokens_expires_at_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE vendors (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_type        VARCHAR(255) NULL,
    vendor_type         VARCHAR(64) NULL,
    size                VARCHAR(255) NULL,
    optional            VARCHAR(255) NULL,
    overview            TEXT NULL,
    avg_time_vendor     VARCHAR(500) NULL,
    avg_time_actual     VARCHAR(500) NULL,
    notes               TEXT NULL,
    name                VARCHAR(255) NULL DEFAULT '',
    phone               VARCHAR(255) NULL,
    category            VARCHAR(255) NULL,
    email               VARCHAR(255) NULL,
    pricing1            DECIMAL(10,2) NULL,
    pricing2            FLOAT NULL,
    eco_price           DECIMAL(10,2) NULL,
    eco_total           DECIMAL(10,2) NULL,
    fast_price          DECIMAL(10,2) NULL,
    fast_total          DECIMAL(10,2) NULL,
    express_price       DECIMAL(10,2) NULL,
    express_total       DECIMAL(10,2) NULL,
    overnight_price     DECIMAL(10,2) NULL,
    overnight_total     DECIMAL(10,2) NULL,
    production_price    DECIMAL(10,2) NULL,
    shipping_price      DECIMAL(10,2) NULL,
    product_price       DECIMAL(10,2) NULL,
    total_cost          DECIMAL(10,2) NULL,
    media_url           VARCHAR(255) NULL,
    media_urls          JSON NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    deleted_at          TIMESTAMP NULL,
    INDEX vendors_product_type_index (product_type),
    INDEX vendors_category_index (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE products (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vendor_id               BIGINT UNSIGNED NULL,
    assigned_vendors        JSON NULL,
    media_path              VARCHAR(255) NULL,
    media_kind              VARCHAR(255) NULL,
    media_url               VARCHAR(500) NULL,
    media_urls              JSON NULL,
    image_url               VARCHAR(255) NULL,
    status                  VARCHAR(255) NOT NULL DEFAULT 'draft',
    created_by              BIGINT UNSIGNED NULL,
    seller_name             VARCHAR(255) NULL,
    deadline_date           DATE NULL,
    submitted_by            BIGINT UNSIGNED NULL,
    submitted_at            TIMESTAMP NULL,
    reviewed_by             BIGINT UNSIGNED NULL,
    reviewed_at             TIMESTAMP NULL,
    rejection_reason        TEXT NULL,
    product_type            VARCHAR(255) NULL COMMENT 'Loại sản phẩm',
    product_type_link       VARCHAR(500) NULL,
    product_type_links      TEXT NULL,
    product_video_links     JSON NULL,
    production_time         VARCHAR(255) NULL COMMENT 'Thời gian sản xuất mong muốn',
    shipping_time            VARCHAR(255) NULL COMMENT 'Thời gian ship mong muốn',
    -- string(255), KHÔNG phải decimal: cột chứa khoảng giá dạng "100-150", không
    -- chỉ một con số. Xem 2026_07_27_000002_change_products_total_cost_to_string.php.
    total_cost                VARCHAR(255) NULL COMMENT 'Total Cost — số hoặc khoảng giá, vd "100-150"',
    material                    TEXT NULL COMMENT 'Chất liệu',
    print_area                  TEXT NULL COMMENT 'Vùng in',
    other_specs                  TEXT NULL COMMENT 'Thiết kế khác',
    good_review                   TEXT NULL,
    bad_review                     TEXT NULL,
    packaging_links                 TEXT NULL,
    other_packaging                  TEXT NULL,
    created_at                        TIMESTAMP NULL,
    updated_at                         TIMESTAMP NULL,
    deleted_at                          TIMESTAMP NULL,
    INDEX products_deleted_at_created_at_index (deleted_at, created_at),
    INDEX products_status_submitted_at_index (status, submitted_at),
    INDEX products_created_by_status_index (created_by, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE notifications (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    type            VARCHAR(255) NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT NULL,
    data            JSON NULL,
    is_read         TINYINT(1) NOT NULL DEFAULT 0,
    -- Vết gửi mail: queued (job đã nhận) -> sent | failed | skipped. NULL nghĩa
    -- là type này không nằm trong danh sách gửi mail, chưa từng qua worker.
    email_status    VARCHAR(16) NULL,
    email_sent_at   TIMESTAMP NULL,
    email_error     TEXT NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    INDEX notifications_user_id_is_read_index (user_id, is_read),
    INDEX notifications_user_id_created_at_index (user_id, created_at),
    INDEX notifications_user_id_type_index (user_id, type),
    INDEX notifications_email_status_index (email_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE notification_email_settings (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role            VARCHAR(32) NOT NULL,
    type            VARCHAR(32) NOT NULL,
    enabled         TINYINT(1) NOT NULL DEFAULT 1,
    updated_by      BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    UNIQUE KEY notification_email_settings_role_type_unique (role, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
-- Ma trận role x loại thông báo quyết định có gửi mail hay không. Seed ngay
-- trong migration (không seeder riêng): dự án deploy thủ công, không chạy
-- `db:seed` trên production — xem 2026_09_07_000002.
INSERT INTO notification_email_settings (role, type, enabled, created_at, updated_at) VALUES
    ('admin',  'new_form',           1, NOW(), NOW()),
    ('seller', 'approved',           1, NOW(), NOW()),
    ('seller', 'rejected',           1, NOW(), NOW()),
    ('vendor', 'needs_vendor',       1, NOW(), NOW()),
    ('seller', 'deadline_updated',   1, NOW(), NOW()),
    ('seller', 'vendor_assigned',    1, NOW(), NOW()),
    ('admin',  'library_updated',    1, NOW(), NOW()),
    ('vendor', 'library_updated',    1, NOW(), NOW()),
    ('seller', 'library_updated',    1, NOW(), NOW()),
    ('pd',     'library_updated',    1, NOW(), NOW()),
    ('csf',    'library_updated',    1, NOW(), NOW()),
    ('marvel', 'library_updated',    1, NOW(), NOW());
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE news (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    -- 'admin' | 'seller' | 'both' | mảng tên project (JSON), vd ["Happy Project"]
    target      JSON NULL,
    sent_at     TIMESTAMP NULL,
    created_by  BIGINT UNSIGNED NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    CONSTRAINT news_created_by_foreign FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX news_created_at_index (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE vendor_library (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    data        LONGTEXT NOT NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE price_sheets (
    -- id do frontend sinh (vd "sheet_xxx"), không phải số tự tăng.
    id                    VARCHAR(255) PRIMARY KEY,
    project               VARCHAR(255) NULL,
    name                  VARCHAR(255) NULL,
    vendor_ref            VARCHAR(255) NULL,
    source_file           VARCHAR(255) NULL,
    -- JSON mảng tên Product Type, lưu dạng text (không cột JSON) — khớp cách
    -- PriceSheetSummary::summaryColumns() ghi bằng json_encode() rồi lưu string.
    product_type_names    TEXT NULL,
    size_count            INT UNSIGNED NOT NULL DEFAULT 0,
    min_price             DECIMAL(14,4) NULL,
    max_price             DECIMAL(14,4) NULL,
    avg_margin            DECIMAL(12,4) NULL,
    updated_by            VARCHAR(255) NULL,
    created_by            VARCHAR(255) NULL,
    version               INT UNSIGNED NOT NULL DEFAULT 1,
    -- Toàn bộ nội dung bảng tính giá (settings + productTypes + history) dạng JSON.
    data                  LONGTEXT NOT NULL,
    created_at            TIMESTAMP NULL,
    updated_at            TIMESTAMP NULL,
    INDEX price_sheets_project_index (project),
    INDEX price_sheets_updated_at_index (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE price_sheet_versions (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    -- Không FK: price_sheets.id là chuỗi do frontend sinh, có bản ghi mồ côi
    -- trên production.
    sheet_id    VARCHAR(255) NOT NULL,
    version     INT UNSIGNED NOT NULL,
    saved_at    TIMESTAMP NULL,
    saved_by    VARCHAR(255) NULL,
    -- Snapshot đầy đủ của một lần lưu (settings + productTypes + số tổng hợp).
    data        LONGTEXT NOT NULL,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    -- CHỈ unique, không thêm index (sheet_id, version) trùng lặp — bản gốc có
    -- cả hai rồi bỏ index trùng ở 2026_09_14_000002_add_performance_indexes.php.
    UNIQUE KEY price_sheet_versions_sheet_id_version_unique (sheet_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- +goose StatementEnd

-- +goose Down
-- Mỗi DROP TABLE một khối StatementBegin/StatementEnd RIÊNG — driver MySQL của
-- Go không chạy được nhiều statement cách nhau bằng ";" trong một lần gọi Exec
-- (trừ khi bật multiStatements=true trên DSN, cố tình không bật). Gộp chung một
-- khối như bản đầu tiên từng viết sẽ ném lỗi cú pháp 1064 ngay khi gọi `down`.
-- +goose StatementBegin
DROP TABLE IF EXISTS price_sheet_versions;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS price_sheets;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS vendor_library;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS news;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS notification_email_settings;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS notifications;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS products;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS vendors;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS personal_access_tokens;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
