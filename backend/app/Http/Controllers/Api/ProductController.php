<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class ProductController extends BaseApiController {

    public function index(Request $request) {
        $query = Product::with('vendor')->latest();

        if ($request->search)   $query->where('name','like',"%{$request->search}%");
        if ($request->category) $query->where('category', $request->category);
        if ($request->low_stock) $query->whereColumn('stock','<=','stock_alert');

        return $this->success($query->paginate($request->per_page ?? 20));
    }

    public function show($id) {
        return $this->success(Product::with(['vendor','inventoryLogs'])->findOrFail($id));
    }

    public function store(Request $request) {
        $request->validate([
            'name'       => 'required|string|max:255',
            'category'   => 'required|string',
            'price'      => 'required|numeric|min:0',
            'cost_price' => 'required|numeric|min:0',
            'stock'      => 'required|integer|min:0',
        ]);

        $product = Product::create([
            ...$request->only(['name','description','category','price','cost_price','stock','stock_alert','vendor_id','image']),
            'sku' => 'SKU-' . strtoupper(uniqid()),
        ]);

        return $this->success($product, 'Thêm sản phẩm thành công', 201);
    }

    public function update(Request $request, $id) {
        $product = Product::findOrFail($id);
        $product->update($request->only(['name','description','category','price','cost_price','stock_alert','vendor_id','status']));
        return $this->success($product, 'Cập nhật sản phẩm thành công');
    }

    public function destroy($id) {
        Product::findOrFail($id)->delete();
        return $this->success(null, 'Đã xóa sản phẩm');
    }
}