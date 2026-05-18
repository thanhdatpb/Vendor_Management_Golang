<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;

class VendorController extends BaseApiController {

    public function index(Request $request) {
        $vendors = Vendor::withCount('products')
            ->latest()
            ->paginate($request->per_page ?? 15);
        return $this->success($vendors);
    }

    public function show($id) {
        $vendor = Vendor::with(['products','inventoryLogs.product'])->findOrFail($id);
        return $this->success($vendor);
    }

    public function store(Request $request) {
        $request->validate([
            'name'     => 'required|string',
            'phone'    => 'required|string',
            'category' => 'required|string',
        ]);
        $vendor = Vendor::create($request->only(['name','contact_name','phone','email','address','category','note']));
        return $this->success($vendor, 'Thêm vendor thành công', 201);
    }

    public function update(Request $request, $id) {
        $vendor = Vendor::findOrFail($id);
        $vendor->update($request->only(['name','contact_name','phone','email','address','category','status','note']));
        return $this->success($vendor, 'Cập nhật vendor thành công');
    }

    public function destroy($id) {
        Vendor::findOrFail($id)->delete();
        return $this->success(null, 'Đã xóa vendor');
    }
}