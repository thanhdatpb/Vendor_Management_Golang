<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Support\Facades\Storage;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class ProductController extends Controller
{
    private function productCacheVersion(): string
    {
        return 'v' . Cache::get('products_cache_version', 0);
    }

    private function clearProductsCache(): void
    {
        Cache::increment('products_cache_version');
        Cache::forget('products_pending');
        Cache::forget('products_approved');
    }

    // Helper: thêm media_url và media_urls vào product
    private function addMediaUrlsToProduct($product)
    {
        if ($product->media_path) {
            $relUrl = '/storage/' . $product->media_path;
            $product->media_url = $relUrl;

            if (empty($product->media_urls)) {
                $product->media_urls = [$relUrl];
            } else {
                $product->media_urls = array_map(function($url) {
                    // Normalize absolute domain URLs → relative /storage/... paths
                    if (str_starts_with($url, 'http') && str_contains($url, '/storage/')) {
                        return substr($url, strpos($url, '/storage/'));
                    }
                    if (str_starts_with($url, '/storage/')) {
                        return $url;
                    }
                    // Bare relative path like products/uuid.jpg
                    return '/storage/' . $url;
                }, $product->media_urls);
            }
        } else {
            $product->media_url = null;
            $product->media_urls = [];
        }
        return $product;
    }

    // 1️⃣ Lấy danh sách sản phẩm
    public function index(Request $request)
    {
        $user  = $request->user();
        $cacheKey = 'products_index_' . $this->productCacheVersion() . '_' . ($user?->id ?? 'guest') . '_' . md5(json_encode($request->all()));

        $products = Cache::remember($cacheKey, 3600, function () use ($request, $user) {
            $query = Product::with('creator:id,name,email,project,seller_name')->latest();

            if ($user && method_exists($user, 'isStaff') && $user->isStaff()) {
                if (!empty($user->project)) {
                    $query->whereHas('creator', function($q) use ($user) {
                        $q->where('project', $user->project);
                    });
                } else {
                    $query->where('created_by', $user->id);
                }
            }

            if ($request->filled('search')) {
                $q = $request->input('search');
                $query->where('product_type', 'like', "%{$q}%");
            }

            $paginated = $query->paginate((int)($request->input('per_page', 20)));
            $paginated->getCollection()->transform(function ($product) {
                if ($product->creator) {
                    $product->project = $product->creator->project;
                    $product->seller_name = $product->creator->seller_name ?? $product->creator->name;
                }
                return $product;
            });
            return $paginated;
        });

        // Normalize media URLs outside cache so stale cached data is always corrected
        $products->getCollection()->transform(function ($product) {
            return $this->addMediaUrlsToProduct($product);
        });

        return response()->json([
            'data' => $products,
        ]);
    }

    // 2️⃣ Thêm sản phẩm (hỗ trợ nhiều file) - ĐÃ SỬA HOÀN CHỈNH
public function store(Request $request)
{
    $user = $request->user();

    $validated = $request->validate([
        'vendor_id'         => 'nullable|exists:vendors,id',
        'deadline_date'     => 'nullable|date',
        'product_type'      => 'nullable|string|max:255',
        'product_type_link' => 'nullable|string|max:500',
        'product_type_links' => 'nullable|string',
        'product_video_links' => 'nullable|string',
        'other_specs'       => 'nullable|string',
        'good_review'       => 'nullable|string',
        'bad_review'        => 'nullable|string',
        'media.*'           => 'nullable|file|max:20480|mimetypes:image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm',
        'production_time'   => 'nullable|string|max:255',
        'shipping_time'     => 'nullable|string|max:255',
        'total_cost'        => 'nullable|numeric|min:0',
        'material'          => 'nullable|string',
        'print_area'        => 'nullable|string',
        'packaging_links'   => 'nullable|string',
        'other_packaging'   => 'nullable|string',
        'seller_name'       => 'nullable|string|max:255',
    ]);

    $isAdmin = $user && method_exists($user, 'isAdmin') && $user->isAdmin();
    $mediaUrls = [];
    $mediaPath = null;
    $mediaKind = null;

    // Xử lý product_type_links trực tiếp trong mảng data
    $productTypeLinks = null;
    if ($request->filled('product_type_links')) {
        $decoded = json_decode($request->product_type_links, true);
        $productTypeLinks = is_array($decoded) ? $decoded : [$request->product_type_links];
    }

    $productVideoLinks = null;
    if ($request->filled('product_video_links')) {
        $decoded = json_decode($request->product_video_links, true);
        $productVideoLinks = is_array($decoded) ? $decoded : [$request->product_video_links];
    }

    if ($request->hasFile('media')) {
        $files = $request->file('media');
        if (!is_array($files)) {
            $files = [$files];
        }
        foreach ($files as $file) {
            $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension());
            $kind = in_array($ext, ['mp4', 'webm'], true) ? 'video' : 'image';
            $path = $file->store('products', 'public');
            $mediaUrls[] = '/storage/' . $path;
            if (!$mediaPath) {
                $mediaPath = $path;
                $mediaKind = $kind;
            }
        }
    }
    
    $data = [
        ...$validated,
        'created_by'    => $user?->id,
        'status'        => $isAdmin ? 'approved' : 'draft',
        'submitted_by'  => $isAdmin ? $user?->id : null,
        'submitted_at'  => $isAdmin ? now() : null,
        'reviewed_by'   => $isAdmin ? $user?->id : null,
        'reviewed_at'   => $isAdmin ? now() : null,
        'media_path'    => $mediaPath,
        'media_kind'    => $mediaKind,
        'media_urls'    => $mediaUrls,
    ];
    
    if ($productTypeLinks !== null) {
        $data['product_type_links'] = $productTypeLinks;
    }
    if ($productVideoLinks !== null && Schema::hasColumn('products', 'product_video_links')) {
        $data['product_video_links'] = $productVideoLinks;
    }

    $product = Product::create($data);
    $product = $this->addMediaUrlsToProduct($product);

    $this->clearProductsCache();

    return response()->json($product, 201);
}
public function update(Request $request, $id)
{
    $user    = $request->user();
    $product = Product::findOrFail($id);

    $isAdmin = $user && method_exists($user, 'isAdmin') && $user->isAdmin();
    $isStaff = $user && method_exists($user, 'isStaff') && $user->isStaff();

    if ($isStaff) {
        $creator = \App\Models\User::find($product->created_by);
        $isSameProject = !empty($user->project) && !empty($creator->project) && $user->project === $creator->project;
        
        if (!$isSameProject && (int)$product->created_by !== (int)$user->id) {
            return response()->json(['message' => 'Forbidden - Không cùng project'], 403);
        }
        if (!in_array($product->status, ['draft', 'rejected'], true)) {
            return response()->json(['message' => 'Sản phẩm đang chờ duyệt hoặc đã duyệt'], 422);
        }
    }

    $validated = $request->validate([
        'deadline_date'     => 'sometimes|nullable|date',
        'product_type'      => 'sometimes|nullable|string|max:255',
        'product_type_link' => 'sometimes|nullable|string|max:500',
        'product_type_links' => 'sometimes|nullable|string',
        'product_video_links' => 'sometimes|nullable|string',
        'other_specs'       => 'sometimes|nullable|string',
        'good_review'       => 'sometimes|nullable|string',
        'bad_review'        => 'sometimes|nullable|string',
        'production_time'   => 'sometimes|nullable|string|max:255',
        'shipping_time'     => 'sometimes|nullable|string|max:255',
        'total_cost'        => 'sometimes|nullable|numeric|min:0',
        'material'          => 'sometimes|nullable|string',
        'print_area'        => 'sometimes|nullable|string',
        'packaging_links'   => 'sometimes|nullable|string',
        'other_packaging'   => 'sometimes|nullable|string',
        'media.*'           => 'sometimes|nullable|file|max:20480|mimetypes:image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm',
        'delete_media_indices' => 'sometimes|string',
        'seller_name'       => 'sometimes|nullable|string|max:255', // ← THÊM DÒNG NÀY
    ]);

    // Xử lý product_type_links từ JSON string
    if ($request->filled('product_type_links')) {
        $productTypeLinks = json_decode($request->product_type_links, true);
        $validated['product_type_links'] = is_array($productTypeLinks) ? $productTypeLinks : [$request->product_type_links];
    }

    if ($request->filled('product_video_links')) {
        $productVideoLinks = json_decode($request->product_video_links, true);
        $validated['product_video_links'] = is_array($productVideoLinks) ? $productVideoLinks : [$request->product_video_links];
    }

    $product->fill(collect($validated)->except(['media', 'delete_media_indices', 'product_type_links', 'product_video_links'])->all());

    if (isset($validated['product_type_links'])) {
        $product->product_type_links = $validated['product_type_links'];
    }
    if (isset($validated['product_video_links']) && Schema::hasColumn('products', 'product_video_links')) {
        $product->product_video_links = $validated['product_video_links'];
    }

    // Xóa media theo chỉ số
    if ($request->filled('delete_media_indices')) {
        $indices = explode(',', $request->delete_media_indices);
        $currentUrls = $product->media_urls ?? [];
        $keepUrls = [];
        foreach ($currentUrls as $idx => $url) {
            if (!in_array($idx, $indices)) {
                $keepUrls[] = $url;
            } else {
                $relativePath = str_replace('/storage/', '', $url);
                Storage::disk('public')->delete($relativePath);
            }
        }
        $product->media_urls = $keepUrls;
        if (!empty($keepUrls)) {
            $firstUrl = $keepUrls[0];
            $product->media_path = str_replace('/storage/', '', $firstUrl);
            $ext = pathinfo($firstUrl, PATHINFO_EXTENSION);
            $product->media_kind = in_array(strtolower($ext), ['mp4', 'webm']) ? 'video' : 'image';
        } else {
            $product->media_path = null;
            $product->media_kind = null;
        }
    }

    // Thêm media mới (giữ nguyên media cũ)
    if ($request->hasFile('media')) {
        $files = $request->file('media');
        if (!is_array($files)) {
            $files = [$files];
        }
        $newUrls = $product->media_urls ?? [];
        foreach ($files as $file) {
            $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension());
            $path = $file->store('products', 'public');
            $newUrls[] = '/storage/' . $path;
            if (empty($product->media_path)) {
                $product->media_path = $path;
                $product->media_kind = in_array($ext, ['mp4', 'webm']) ? 'video' : 'image';
            }
        }
        $product->media_urls = $newUrls;
    }

    if ($isStaff) {
        $product->status           = 'draft';
        $product->reviewed_by      = null;
        $product->reviewed_at      = null;
        $product->rejection_reason = null;
    }

    $product->save();
    $product = $this->addMediaUrlsToProduct($product);

    $this->clearProductsCache();

    return response()->json($product);
}

    // 5️⃣ Xóa sản phẩm
    public function destroy(Request $request, $id)
    {
        $user    = $request->user();
        $product = Product::find($id);

        if (!$product) {
            return response()->json(['message' => 'Product không tồn tại hoặc đã bị xóa'], 404);
        }

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $isAdmin = method_exists($user, 'isAdmin') && $user->isAdmin();
        $isStaff = method_exists($user, 'isStaff') && $user->isStaff();

        $role = strtolower($user->role ?? '');
        if (!$isAdmin && !$isStaff) {
            $isAdmin = in_array($role, ['admin', 'super_admin']);
            $isStaff = in_array($role, ['staff', 'staff_a', 'staff_b', 'staff-a', 'staff-b', 'staffa', 'staffb', 'seller']);
        }

        $isVendor = in_array($role, ['vendor', 'staffb', 'staff_b', 'staff-b']);

        if (!$isAdmin && !$isStaff && !$isVendor) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Vendor có quyền xóa bất kỳ form nào (dùng cho demo/thử nghiệm)
        if (!$isAdmin && !$isVendor && $isStaff) {
            $creator = \App\Models\User::find($product->created_by);
            $isSameProject = !empty($user->project) && !empty($creator->project) && $user->project === $creator->project;

            if (!$isSameProject && (int)$product->created_by !== (int)$user->id) {
                return response()->json(['message' => 'Bạn không có quyền xóa sản phẩm của project khác'], 403);
            }
            if (!in_array($product->status, ['draft', 'rejected'], true)) {
                return response()->json(['message' => 'Không thể xóa sản phẩm đã gửi duyệt'], 422);
            }
        }

        // Xóa tất cả file media
        $mediaUrls = $product->media_urls ?? [];
        foreach ($mediaUrls as $url) {
            $relativePath = str_replace('/storage/', '', $url);
            Storage::disk('public')->delete($relativePath);
        }
        if ($product->media_path) {
            Storage::disk('public')->delete($product->media_path);
        }

        $product->delete();

        $this->clearProductsCache();

        return response()->json(['message' => 'Product deleted successfully']);
    }

    // Staff gửi duyệt
    public function submit($id)
    {
        $product = Product::find($id);
        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $product->status       = 'pending';
        $product->submitted_by = auth()->id();
        $product->submitted_at = now();
        $product->save();

        $this->clearProductsCache();

        NotificationService::sendToRole(
            'admin',
            'pending',
            '📋 Sản phẩm mới chờ duyệt',
            "Sản phẩm \"{$product->product_type}\" đang chờ Admin phê duyệt."
        );

        return response()->json(['message' => 'Gửi Form cho Admin thành công']);
    }

public function pendingApprovals()
{
    $products = Cache::remember('products_pending', 3600, function () {
        $prods = Product::where('status', 'pending')
            ->with('creator:id,name,email,project,seller_name')  // ← THÊM with()
            ->get();
        
        $prods->transform(function ($product) {
            $product = $this->addMediaUrlsToProduct($product);
            if ($product->creator) {
                $product->project = $product->creator->project;
                $product->seller_name = $product->creator->seller_name ?? $product->creator->name;
            }
            return $product;
        });
        return $prods;
    });
    
    return response()->json($products);
}

    // Admin duyệt/từ chối
    public function approve(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $isApproved = $request->input('approved', true);
        
        $product->status = $isApproved ? 'approved' : 'rejected';
        $product->reviewed_by = auth()->id();
        $product->reviewed_at = now();
        $product->rejection_reason = $isApproved ? null : $request->reason;
        $product->save();

        $pt = $product->product_type;
        $notifData = ['product_id' => (int)$product->id, 'product_type' => $pt];

        if ($product->created_by) {
            $message = $isApproved
                ? "Sản phẩm \"{$pt}\" đã được Admin phê duyệt."
                : "Sản phẩm \"{$pt}\" bị Admin từ chối." . ($request->reason ? " Lý do: {$request->reason}" : '');
            NotificationService::send(
                $product->created_by,
                $isApproved ? 'approved' : 'rejected',
                $isApproved ? '✅ Sản phẩm đã được duyệt' : '❌ Sản phẩm bị từ chối',
                $message,
                $notifData
            );
        }

        if ($isApproved) {
            NotificationService::sendToRole(
                'staff_b',
                'needs_vendor',
                '🔧 Sản phẩm cần gán vendor',
                "Sản phẩm \"{$pt}\" đã được Admin duyệt, cần gán vendor.",
                $notifData
            );
        }

        $this->clearProductsCache();

        return response()->json(['message' => $isApproved ? 'Product approved' : 'Product rejected']);
    }

    // Reject riêng
    public function reject(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $product->status = 'rejected';
        $product->reviewed_by = auth()->id();
        $product->reviewed_at = now();
        $product->rejection_reason = $request->reason;
        $product->save();

        if ($product->created_by) {
            NotificationService::send(
                $product->created_by,
                'rejected',
                '❌ Sản phẩm bị từ chối',
                "Sản phẩm \"{$product->product_type}\" bị Admin từ chối." . ($request->reason ? " Lý do: {$request->reason}" : ''),
                ['product_id' => (int)$product->id, 'product_type' => $product->product_type]
            );
        }

        $this->clearProductsCache();

        return response()->json(['message' => 'Product rejected']);
    }

    // Staff B gửi phản hồi
    public function sendFeedback(Request $request, $id)
    {
        $validated = $request->validate([
            'feedback' => 'required|string|max:1000',
        ]);

        $product = Product::findOrFail($id);

        if ($product->created_by) {
            NotificationService::send(
                $product->created_by,
                'feedback',
                '💬 Có phản hồi mới từ Staff B',
                "Sản phẩm \"{$product->product_type}\": {$validated['feedback']}",
                ['product_id' => (int)$product->id, 'product_type' => $product->product_type]
            );
        }

        return response()->json(['success' => true, 'message' => 'Đã gửi phản hồi thành công!']);
    }

    // Vendor comparison
    public function vendorComparison($id)
    {
        $product = Product::findOrFail($id);
        $vendors = Vendor::where('category', $product->product_type)->get();
        return response()->json([
            'product_type' => $product->product_type,
            'vendors'      => $vendors,
        ]);
    }
public function show($id)
{
    $product = Product::with('creator:id,name,email,project,seller_name')->findOrFail($id);
    
    $product = $this->addMediaUrlsToProduct($product);
    
    if ($product->creator) {
        $product->seller_name = $product->creator->seller_name ?? $product->creator->name;
        $product->seller_email = $product->creator->email;
        $product->project = $product->creator->project;
    }
    
    if ($product->product_type_links && is_string($product->product_type_links)) {
        $product->product_type_links = json_decode($product->product_type_links, true);
    }
    
    return response()->json([
        'success' => true,
        'data' => $product
    ]);
}
public function approvedProducts()
{
    $products = Cache::remember('products_approved', 3600, function () {
        $prods = Product::where('status', 'approved')
            ->with('creator:id,name,email,project,seller_name')
            ->latest()
            ->get();

        $prods->transform(function ($product) {
            if ($product->creator) {
                $product->seller_name = $product->creator->seller_name ?? $product->creator->name;
                $product->seller_email = $product->creator->email;
                $product->project = $product->creator->project;
            }
            if ($product->product_type_links && is_string($product->product_type_links)) {
                $product->product_type_links = json_decode($product->product_type_links, true);
            }
            return $product;
        });
        return $prods;
    });

    // Normalize media URLs outside cache so stale cached data is always corrected
    $products->transform(function ($product) {
        return $this->addMediaUrlsToProduct($product);
    });

    return response()->json([
        'data' => $products
    ]);
}
     public function updateDeadline(Request $request, $id)
    {
        $user = $request->user();
        $product = Product::findOrFail($id);

        // Kiểm tra quyền: Staff B hoặc Staff A có thể cập nhật deadline
        $isStaff = $user && method_exists($user, 'isStaff') && $user->isStaff();
        $isAdmin = $user && method_exists($user, 'isAdmin') && $user->isAdmin();

        if (!$isStaff && !$isAdmin) {
            $role = strtolower($user->role ?? '');
            $isStaff = in_array($role, ['staff', 'staff_a', 'staff_b', 'staff-a', 'staff-b', 'staffa', 'staffb']);
        }

        if (!$isStaff && !$isAdmin) {
            return response()->json(['message' => 'Forbidden - Bạn không có quyền cập nhật deadline'], 403);
        }

        $validated = $request->validate([
            'deadline_date' => 'required|date|after_or_equal:today',
        ]);

        $product->deadline_date = $validated['deadline_date'];
        $product->save();

        // Gửi thông báo cho người tạo sản phẩm (Staff A)
        if ($product->created_by && $product->created_by != $user->id) {
            NotificationService::send(
                $product->created_by,
                'deadline_updated',
                '📅 Deadline đã được cập nhật',
                "Sản phẩm \"{$product->product_type}\" có deadline mới: " . date('d/m/Y', strtotime($validated['deadline_date'])),
                ['product_id' => (int)$product->id, 'product_type' => $product->product_type]
            );
        }

        $product = $this->addMediaUrlsToProduct($product);

        $this->clearProductsCache();

        return response()->json([
            'message' => 'Đã cập nhật deadline thành công',
            'product' => $product
        ]);
    }

    // Staff B gán danh sách vendor cho sản phẩm
    public function assignVendors(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        if ($product->status !== 'approved') {
            return response()->json([
                'message' => 'Chỉ được gán vendor cho sản phẩm đã được Admin duyệt',
            ], 422);
        }

        $vendors = $request->input('vendors', []);
        $product->assigned_vendors = is_array($vendors) ? $vendors : [];
        $product->save();

        $this->clearProductsCache();

        // Gửi thông báo cho Seller (người tạo sản phẩm)
        if ($product->created_by) {
            $firstVendorName = '';
            if (!empty($vendors) && is_array($vendors) && isset($vendors[0])) {
                $first = $vendors[0];
                $firstVendorName = $first['vendorName'] ?? ($first['name'] ?? '');
            }
            $vendorBody = $firstVendorName
                ? "Vendor \"{$firstVendorName}\" đã được gán cho sản phẩm \"{$product->product_type}\"."
                : "Sản phẩm \"{$product->product_type}\" đã được gán " . count($vendors) . " vendor để tham khảo.";
            NotificationService::send(
                $product->created_by,
                'vendor_assigned',
                '🏪 Vendor đã được gán',
                $vendorBody,
                ['product_id' => (int)$product->id, 'product_type' => $product->product_type]
            );
        }

        return response()->json([
            'success' => true,
            'assigned_vendors' => $product->assigned_vendors,
        ]);
    }
}