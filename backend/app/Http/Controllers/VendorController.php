<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vendor;
use App\Models\Product;
use App\Services\NotificationService;

class VendorController extends Controller
{

    // =========================
    // LIST VENDORS
    // =========================

    public function index(Request $request)
    {
        $query = Vendor::latest();

        if ($request->filled('product_type')) {
            $query->where('product_type', $request->product_type);
        }
        if ($request->filled('vendor_category')) {
            $query->where('vendor_category', $request->vendor_category);
        }

        $perPage = (int) $request->input('per_page', 20);
        if ($perPage < 1) {
            $perPage = 20;
        }
        if ($perPage > 5000) {
            $perPage = 5000;
        }

        $vendors = $query->paginate($perPage);

        return response()->json([
            "data" => $vendors
        ]);
    }



    // =========================
    // CREATE VENDOR
    // =========================

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'nullable|string|max:255',  // ← THÊM DÒNG NÀY
            'product_type'    => 'required|string|max:255',
            'vendor_type'     => 'required|in:Old,New,Best Seller',
            'size'            => 'nullable|string|max:255',
            'optional'        => 'nullable|string|max:255',
            'pricing1'        => 'nullable|numeric|min:0',
            'pricing2'        => 'nullable|numeric|min:0',
            'eco_price'       => 'nullable|numeric|min:0',
            'eco_total'       => 'nullable|numeric|min:0',
            'fast_price'      => 'nullable|numeric|min:0',
            'fast_total'      => 'nullable|numeric|min:0',
            'express_price'   => 'nullable|numeric|min:0',
            'express_total'   => 'nullable|numeric|min:0',
            'overnight_price' => 'nullable|numeric|min:0',
            'overnight_total' => 'nullable|numeric|min:0',
        ]);

        // Chỉ set name = vendor_type nếu không có name được gửi lên
        if (empty($validated['name'])) {
            $validated['name'] = $validated['vendor_type'];
        }

        $vendor = Vendor::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Tạo vendor thành công!',
            'data'    => $vendor,
        ], 201);
    }



    // =========================
    // SHOW VENDOR
    // =========================

    public function show($id)
    {
        $vendor = Vendor::findOrFail($id);
        return response()->json($vendor);
    }



    // =========================
    // UPDATE VENDOR
    // =========================

    public function update(Request $request, $id)
    {
        $vendor = Vendor::findOrFail($id);

        $validated = $request->validate([
            'name'            => 'nullable|string|max:255',  // ← THÊM DÒNG NÀY
            'product_type'    => 'sometimes|required|string|max:255',
            'vendor_type'     => 'sometimes|required|in:Old,New,Best Seller',
            'size'            => 'sometimes|nullable|string|max:255',
            'optional'        => 'sometimes|nullable|string|max:255',
            'pricing1'        => 'sometimes|nullable|numeric|min:0',
            'pricing2'        => 'sometimes|nullable|numeric|min:0',
            'eco_price'       => 'sometimes|nullable|numeric|min:0',
            'eco_total'       => 'sometimes|nullable|numeric|min:0',
            'fast_price'      => 'sometimes|nullable|numeric|min:0',
            'fast_total'      => 'sometimes|nullable|numeric|min:0',
            'express_price'   => 'sometimes|nullable|numeric|min:0',
            'express_total'   => 'sometimes|nullable|numeric|min:0',
            'overnight_price' => 'sometimes|nullable|numeric|min:0',
            'overnight_total' => 'sometimes|nullable|numeric|min:0',
        ]);

        // ❌ XÓA ĐOẠN CODE NÀY HOẶC SỬA LẠI:
        // KHÔNG tự động ghi đè name bằng vendor_type nữa
        // Chỉ set name = vendor_type nếu name không được gửi lên và vendor_type có thay đổi
        if (!isset($validated['name']) && isset($validated['vendor_type'])) {
            // Nếu không có name trong request thì mới set
            $validated['name'] = $validated['vendor_type'];
        }

        $vendor->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Cập nhật vendor thành công!',
            'data'    => $vendor->fresh(),
        ]);
    }



    // =========================
    // DELETE VENDOR
    // =========================

    public function destroy($id)
    {
        $vendor = Vendor::findOrFail($id);
        $vendor->delete();

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa vendor thành công!',
        ]);
    }



    // =========================
    // COMPARE VENDORS
    // =========================

    public function compare(Request $request)
    {
        $productId = $request->product_id;
        $strategy  = $request->strategy ?? 'score';

        $product = Product::findOrFail($productId);
        $vendors = Vendor::where('product_type', $product->product_type)->get();

        if ($vendors->isEmpty()) {
            return response()->json(["message" => "No vendors found"]);
        }

        $vendors = $vendors->map(function ($v) {
            $v->score = ($v->pricing1 ?? 0) + ($v->eco_total ?? 0);
            return $v;
        });

        if ($strategy === 'cost') {
            $vendors = $vendors->sortBy('pricing1');
        } else {
            $vendors = $vendors->sortBy('eco_total');
        }

        return response()->json([
            "product_type" => $product->product_type,
            "top2"         => $vendors->take(2)->values(),
            "vendors"      => $vendors->values(),
        ]);
    }



    // =========================
    // ADMIN SELECT VENDOR
    // → Thông báo cho Staff A khi Staff B gán vendor
    // =========================

    public function selectVendor(Request $request, $productId)
    {
        $validated = $request->validate([
            'vendor_id' => 'required|exists:vendors,id',
        ]);

        $product = Product::findOrFail($productId);
        $vendor  = Vendor::findOrFail($validated['vendor_id']);

        $product->vendor_id = $validated['vendor_id'];
        $product->save();

        // Gửi thông báo cho Staff A (người tạo sản phẩm)
        if ($product->created_by) {
            NotificationService::send(
                $product->created_by,
                'vendor_assigned',
                '🏪 Vendor đã được gán',
                "Sản phẩm \"{$product->product_type}\" đã được gán vendor: " .
                "{$vendor->vendor_type} - {$vendor->product_type}" .
                ($vendor->vendor_category ? " [{$vendor->vendor_category}]" : '') . "."
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Vendor selected successfully',
            'product' => $product,
        ]);
    }
}