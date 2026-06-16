<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

use App\Http\Controllers\ProductController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\VendorController;
use App\Http\Controllers\Api\VendorImportController;
use App\Http\Controllers\Api\VendorLibraryController;
use App\Http\Controllers\UserController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// =========================
// DEMO DATA CLEAR ROUTE
// =========================
Route::get('/clear-demo-data', function () {
    \App\Models\Product::truncate();
    \App\Models\Notification::truncate();
    
    // Xóa file ảnh upload cũ
    $files = \Illuminate\Support\Facades\Storage::disk('public')->files('products');
    \Illuminate\Support\Facades\Storage::disk('public')->delete($files);
    
    // Xóa dữ liệu thư viện vendor 
    \Illuminate\Support\Facades\Storage::delete([
        'vendor_library.json', 
        'vendor_library_new.json', 
        'vendor_library_best.json'
    ]);
    
    return response()->json([
        'success' => true,
        'message' => 'Đã reset toàn bộ dữ liệu (Sản phẩm, Thông báo, Thư viện Vendor) thành công! Để xóa Thiết lập giá của Seller, vui lòng nhấn F12 -> tab Application -> Local Storage -> Clear và tải lại trang.'
    ]);
});

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



// =========================
// ANALYTICS PUBLIC
// =========================

Route::get('/analytics/conversion', [AnalyticsController::class, 'conversion']);
Route::get('/analytics/profit', [AnalyticsController::class, 'profit']);

Route::get('/products-approved', [ProductController::class, 'approvedProducts']);



// =========================
// PROTECTED ROUTES
// =========================

Route::middleware('auth:sanctum')->group(function () {


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
    // DASHBOARD
    // =========================

    Route::get('/dashboard/overview', function () {
        return response()->json([
            "total_products"  => 120,
            "total_orders"    => 45,
            "total_customers" => 30,
            "revenue_today"   => 1500000,
        ]);
    });

    Route::get('/dashboard/stats', function () {
        return response()->json([
            "visitors_today" => 250,
            "orders_today"   => 12,
            "revenue_today"  => 3200000,
        ]);
    });



    // =========================
    // ANALYTICS
    // =========================

    Route::get('/analytics/revenue', function () {
        return response()->json([
            "labels" => ["Jan", "Feb", "Mar", "Apr", "May"],
            "data"   => [1200, 1800, 1500, 2000, 2500],
        ]);
    });



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

    Route::get('/vendor-library', [VendorLibraryController::class, 'getLibrary']);
    Route::post('/vendor-library', [VendorLibraryController::class, 'saveLibrary']);

    Route::get('/vendors',             [VendorController::class, 'index']);
    Route::post('/vendors',            [VendorController::class, 'store']);
    Route::get('/vendors/{id}',        [VendorController::class, 'show']);
    Route::put('/vendors/{id}',        [VendorController::class, 'update']);
    Route::delete('/vendors/truncate', [VendorController::class, 'truncate']);
    Route::delete('/vendors/{id}',     [VendorController::class, 'destroy']);
    Route::post('/vendors/{id}/upload-media',  [VendorController::class, 'uploadMedia']);
    Route::delete('/vendors/{id}/delete-media', [VendorController::class, 'deleteMedia']);



    // =========================
    // CUSTOMERS
    // =========================

    Route::get('/customers', function () {
        return response()->json([
            ["id" => 1, "name" => "Nguyen Van A", "email" => "a@gmail.com"],
            ["id" => 2, "name" => "Tran Thi B",   "email" => "b@gmail.com"],
        ]);
    });



    // =========================
    // ORDERS
    // =========================

    Route::get('/orders', function () {
        return response()->json([
            ["id" => 1, "customer" => "Nguyen Van A", "total" => 200000],
            ["id" => 2, "customer" => "Tran Thi B",   "total" => 350000],
        ]);
    });



    // =========================
    // INVENTORY
    // =========================

    Route::get('/inventory', function () {
        return response()->json([
            ["product" => "Laptop Dell", "stock" => 20],
            ["product" => "iPhone 15",   "stock" => 10],
        ]);
    });

    Route::get('/inventory/low-stock', function () {
        return response()->json([
            ["product" => "iPhone 15", "stock" => 2],
        ]);
    });

    Route::post('/inventory/import', function () {
        return response()->json([
            "message" => "Stock imported successfully",
        ]);
    });



    // =========================
    // PAYMENTS
    // =========================

    Route::get('/payments', function () {
        return response()->json([
            ["id" => 1, "method" => "Credit Card", "amount" => 200000],
            ["id" => 2, "method" => "Momo",        "amount" => 500000],
        ]);
    });



    // =========================
    // Staff C
    // =========================

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/sellers', [UserController::class, 'getSellers']);
    Route::get('/users/{id}', [UserController::class, 'show']);

    
});