<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

use App\Http\Controllers\ProductController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SocialAuthController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\VendorController;
use App\Http\Controllers\Api\VendorImportController;
use App\Http\Controllers\Api\VendorLibraryController;
use App\Http\Controllers\Api\PriceSheetController;
use App\Http\Controllers\Api\NewsController;
use App\Http\Controllers\UserController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// =========================
// MEDIA PUBLIC
// =========================
Route::get('/vendors/media', function (Request $request) {
    $filename = $request->query('f');
    if (!$filename) {
        abort(404);
    }
    $path = storage_path('app/vendors/' . $filename);
    if (!file_exists($path)) {
        abort(404);
    }
    return response()->file($path);
});

// =========================
// AUTH PUBLIC
// =========================
Route::get('/login', function() {
    return response()->json([
        'message' => 'Unauthenticated. Please provide a valid token.'
    ], 401);
})->name('login');
Route::post('/login', [AuthController::class, 'login']);
// Hoàn tất đăng nhập khi 1 email có nhiều tài khoản (role/project khác nhau)
Route::post('/select-account', [AuthController::class, 'selectAccount']);

// Google OAuth (stateless — no session needed)
Route::get('/auth/google/redirect',  [SocialAuthController::class, 'redirect']);
Route::get('/auth/google/callback',  [SocialAuthController::class, 'callback']);



// =========================
// ANALYTICS PUBLIC
// =========================

Route::get('/analytics/conversion', [AnalyticsController::class, 'conversion']);
Route::get('/analytics/profit', [AnalyticsController::class, 'profit']);

Route::get('/products-approved', [ProductController::class, 'approvedProducts']);



// =========================
// PROTECTED ROUTES
// =========================

Route::middleware(['auth:sanctum', 'seen'])->group(function () {


    // =========================
    // AUTH
    // =========================

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);



    // =========================
    // NOTIFICATIONS
    // =========================

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markOneRead']);



    // =========================
    // PRODUCTS
    // =========================

    Route::get('/products',      [ProductController::class, 'index']);
    Route::post('/products',     [ProductController::class, 'store']);
    Route::get('/products/{id}', [ProductController::class, 'show']);
    // Chấp nhận cả PUT và POST cho update (PHP không parse files từ PUT thuần)
    Route::match(['put', 'post'], '/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // Staff submit product
    Route::post('/products/{id}/submit', [ProductController::class, 'submit']);

    // Staff B gửi feedback về sản phẩm
    Route::post('/products/{id}/feedback', [ProductController::class, 'sendFeedback']);
    Route::put('/products/{id}/deadline', [ProductController::class, 'updateDeadline']);
    // Vendor (tên cũ: Staff B) gán vendor list cho sản phẩm
    Route::post('/products/{id}/assign-vendors', [ProductController::class, 'assignVendors'])
        ->middleware('role:staff_b,vendor');


    // =========================
    // ADMIN
    // =========================

    Route::middleware('admin')->group(function () {

        // Products waiting approval
        Route::get('/admin/product-approvals', [ProductController::class, 'pendingApprovals']);

        // Approve / Reject
        Route::post('/admin/products/{id}/approve', [ProductController::class, 'approve']);
        Route::post('/admin/products/{id}/reject',  [ProductController::class, 'reject']);

        // Vendor comparison & select
        Route::get('/admin/products/{id}/vendor-comparison', [ProductController::class, 'vendorComparison']);
        Route::post('/admin/products/{id}/select-vendor',    [VendorController::class,  'selectVendor']);

    });



    // =========================
    // VENDORS
    // ⚠️ /vendors/compare PHẢI đứng TRƯỚC /vendors/{id}
    //    Nếu để sau, Laravel hiểu "compare" là {id} → lỗi 500
    // =========================

    Route::get('/vendors/compare',  [VendorController::class, 'compare']);
    Route::post('/vendors/import', [VendorImportController::class, 'import']);

    // ⚠️ /vendor-library/index PHẢI đứng TRƯỚC các route ghi cùng tiền tố để
    //    thứ tự khớp không đổi khi thêm route mới.
    // Index gọn cho bảng tính giá: chỉ size + giá vốn, và là nơi strip giá theo role.
    Route::get('/vendor-library/index', [VendorLibraryController::class, 'index']);
    Route::get('/vendor-library', [VendorLibraryController::class, 'getLibrary']);
    Route::post('/vendor-library', [VendorLibraryController::class, 'saveLibrary']);
    // Cập nhật nhẹ 1 field trạng thái Sample — chỉ Vendor (tên cũ: Staff B) được phép
    Route::post('/vendor-library/sample-status', [VendorLibraryController::class, 'updateSampleStatus'])
        ->middleware('role:staff_b,vendor');
    // Cập nhật nhẹ cờ Best Seller của 1 dòng — lưu server để Seller/CSF/PD cùng thấy
    Route::post('/vendor-library/best-seller', [VendorLibraryController::class, 'updateBestSeller'])
        ->middleware('role:staff_b,vendor');
    Route::post('/vendor-library/restore-backup', [VendorLibraryController::class, 'restoreBackup']);
    // Upload hàng loạt ảnh trích xuất từ Excel (ảnh nhúng trực tiếp vào ô) khi import
    Route::post('/vendor-library/upload-images', [VendorLibraryController::class, 'uploadImages'])
        ->middleware('role:staff_b,vendor');

    // =========================
    // PRICE SHEETS (Bảng tính giá) — lưu server, chia sẻ theo project
    // =========================
    // Danh sách chỉ trả số liệu tổng hợp; nội dung đầy đủ và lịch sử nạp riêng.
    Route::get('/price-sheets',                   [PriceSheetController::class, 'index']);
    Route::get('/price-sheets/{id}',              [PriceSheetController::class, 'show']);
    Route::get('/price-sheets/{id}/versions',     [PriceSheetController::class, 'versions']);
    Route::post('/price-sheets',                  [PriceSheetController::class, 'upsert']);
    Route::delete('/price-sheets/{id}',           [PriceSheetController::class, 'destroy']);

    // =========================
    // NEWS (Quản Lý Thông Báo — Vendor tạo) — lưu server, mọi thiết bị Vendor cùng thấy
    // =========================
    Route::get('/news', [NewsController::class, 'index']);
    Route::middleware('role:staff_b,vendor')->group(function () {
        Route::post('/news',           [NewsController::class, 'store']);
        Route::put('/news/{id}',       [NewsController::class, 'update']);
        Route::delete('/news/{id}',    [NewsController::class, 'destroy']);
        // Phát thông báo tới chuông của Admin & Seller (fan-out chạy ở server —
        // trước đây client tự đẩy nên Admin/Seller máy khác không nhận được).
        Route::post('/news/{id}/send', [NewsController::class, 'send']);
    });

    Route::get('/vendors',             [VendorController::class, 'index']);
    Route::post('/vendors',            [VendorController::class, 'store']);
    Route::get('/vendors/{id}',        [VendorController::class, 'show']);
    Route::put('/vendors/{id}',        [VendorController::class, 'update']);
    Route::delete('/vendors/truncate', [VendorController::class, 'truncate']);
    Route::delete('/vendors/{id}',     [VendorController::class, 'destroy']);
    Route::post('/vendors/{id}/upload-media',  [VendorController::class, 'uploadMedia']);
    Route::delete('/vendors/{id}/delete-media', [VendorController::class, 'deleteMedia']);



    // =========================
    // Staff C
    // =========================

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/sellers', [UserController::class, 'getSellers']);
    Route::get('/users/{id}', [UserController::class, 'show']);



    // =========================
    // ADMIN — NHÂN SỰ MANAGEMENT
    // =========================

    Route::middleware('admin')->group(function () {
        Route::get('/admin/users',                   [AdminUserController::class, 'index']);
        Route::post('/admin/users',                  [AdminUserController::class, 'store']);
        Route::patch('/admin/users/{id}',            [AdminUserController::class, 'update']);
        Route::patch('/admin/users/{id}/status',     [AdminUserController::class, 'toggleStatus']);
    });


});