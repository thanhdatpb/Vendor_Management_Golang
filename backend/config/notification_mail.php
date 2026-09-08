<?php

/**
 * Cấu hình mirror thông báo (bảng `notifications`) sang email.
 *
 * MỘT CHỖ DUY NHẤT quyết định: loại nào được gửi mail, role nào hợp lệ cho
 * loại đó (hàng rào cứng, độc lập với bảng `notification_email_settings` —
 * xem App\Services\NotificationEmailPolicy), nhãn hiển thị, và đường dẫn nút
 * bấm trỏ về. Thêm loại mail mới → sửa đúng một chỗ này.
 *
 * `roles` là danh sách CHO PHÉP: role không có trong danh sách không bao giờ
 * nhận mail của loại đó, bất kể ma trận cài đặt nói gì — đây là lớp phòng thủ
 * độc lập, phòng trường hợp một tài khoản lạ (vd CSF tự tạo được product do
 * thiếu role-guard ở route khác) lọt vào làm created_by của một product.
 *
 * Loại KHÔNG có trong mảng `types` dưới đây (news, feedback, pending) sẽ
 * không bao giờ gửi mail — quyết định này nằm ở đây, không nằm rải rác trong
 * NotificationEmailPolicy.
 */
return [

    'types' => [

        'new_form' => [
            'icon'   => '📋',
            'label'  => 'Request mới',
            'button' => 'Xem request',
            'roles'  => ['admin'],
            // Thứ tự hiển thị ở bảng meta của email — khoá là tên trường trong
            // cột `data` của notification, giá trị là nhãn tiếng Việt.
            'meta'   => ['product_type' => 'Loại phôi', 'seller_name' => 'Seller', 'project' => 'Project'],
        ],

        'approved' => [
            'icon'   => '✅',
            'label'  => 'Đã duyệt',
            'button' => 'Mở request',
            'roles'  => ['seller'],
            'meta'   => ['product_type' => 'Request', 'project' => 'Project'],
        ],

        'rejected' => [
            'icon'   => '❌',
            'label'  => 'Từ chối',
            'button' => 'Xem lý do',
            'roles'  => ['seller'],
            'meta'   => ['product_type' => 'Request', 'project' => 'Project'],
        ],

        'needs_vendor' => [
            'icon'   => '🔧',
            'label'  => 'Cần cung cấp vendor',
            'button' => 'Cung cấp vendor',
            'roles'  => ['vendor'],
            'meta'   => ['product_type' => 'Request', 'project' => 'Project'],
        ],

        'deadline_updated' => [
            'icon'   => '📅',
            'label'  => 'Deadline',
            'button' => 'Xem request',
            'roles'  => ['seller'],
            'meta'   => ['product_type' => 'Request', 'deadline_date' => 'Deadline'],
        ],

        'vendor_assigned' => [
            'icon'   => '🏪',
            'label'  => 'Đã cung cấp vendor',
            'button' => 'Xem vendor',
            'roles'  => ['seller'],
            'meta'   => ['product_type' => 'Request', 'project' => 'Project'],
        ],

        'library_updated' => [
            'icon'   => '📚',
            'label'  => 'Thư viện',
            'button' => 'Mở file này trong Thư viện',
            // Admin + Vendor quản trị thư viện; CSF/Marvel phục vụ mọi project nên
            // luôn hợp lệ; Seller/PD chỉ hợp lệ khi file thuộc project của họ —
            // việc lọc project nằm ở App\Support\VendorLibraryDiff, không ở đây.
            'roles'  => ['admin', 'vendor', 'seller', 'pd', 'csf', 'marvel'],
            'meta'   => [
                'filename'         => 'File',
                'actor_label'      => 'Người cập nhật',
                'changes_summary'  => 'Thay đổi',
            ],
        ],

    ],

    /**
     * Đường dẫn màn hình đích theo (type, role) — ghép với FRONTEND_URL.
     */
    'routes' => [
        'new_form'         => ['admin' => '/admin/overview'],
        'approved'         => ['seller' => '/seller/products'],
        'rejected'         => ['seller' => '/seller/products'],
        'needs_vendor'     => ['vendor' => '/vendor/products'],
        'deadline_updated' => ['seller' => '/seller/products'],
        'vendor_assigned'  => ['seller' => '/seller/products'],
        'library_updated'  => [
            'admin'  => '/admin/vendors',
            'vendor' => '/vendor/library',
            'seller' => '/seller/vendors',
            'pd'     => '/pd',
            'csf'    => '/csf',
            'marvel' => '/marvel',
        ],
    ],

    /**
     * Tên tham số query mà nút trong mail đính kèm. `library_updated` trỏ theo
     * tên file (?file=...); mọi loại còn lại trỏ theo product (?product=...).
     */
    'query_param' => [
        'library_updated' => 'file',
    ],
    'default_query_param' => 'product',

    /**
     * Trần số mail được gửi trong 1 giờ — bảo vệ quota SMTP. 0 hoặc âm = không
     * giới hạn. Đọc qua config() (không gọi env() trực tiếp trong code nghiệp
     * vụ) để còn hoạt động đúng sau khi chạy `php artisan config:cache`.
     */
    'hourly_cap' => (int) env('MAIL_HOURLY_CAP', 300),

];
