<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Vendor;
use App\Models\Customer;
use App\Models\Order;
use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Support\Facades\Storage;

class VendorController extends BaseApiController {

    public function index(Request $request) {
        $query = Vendor::latest();
        if ($request->has('product_type')) {
            $query->where('product_type', 'like', '%' . $request->product_type . '%');
        }
        $vendors = $query->paginate($request->per_page ?? 15);
        return $this->success($vendors);
    }

    public function show($id) {
        $vendor = Vendor::findOrFail($id);
        return $this->success($vendor);
    }

    public function store(Request $request) {
        $vendor = Vendor::create($request->all());
        return $this->success($vendor, 'Thêm vendor thành công', 201);
    }

    public function update(Request $request, $id) {
        $vendor = Vendor::findOrFail($id);
        $vendor->update($request->all());
        return $this->success($vendor, 'Cập nhật vendor thành công');
    }

    public function destroy($id) {
        Vendor::findOrFail($id)->delete();
        return $this->success(null, 'Đã xóa vendor');
    }

    public function uploadMedia(Request $request, $id) {
        $vendor = Vendor::findOrFail($id);
        $urls = $vendor->media_urls ?? [];
        
        $destinationPath = storage_path('app/vendors');
        if (!file_exists($destinationPath)) {
            mkdir($destinationPath, 0755, true);
        }

        if ($request->hasFile('media')) {
            foreach ($request->file('media') as $file) {
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $file->move($destinationPath, $fileName);
                $urls[] = url('api/vendors/media?f=' . $fileName);
            }
            $vendor->media_urls = $urls;
            $vendor->media_url = $urls[0] ?? null;
            $vendor->save();
        }
        return $this->success(['media_urls' => $vendor->media_urls, 'media_url' => $vendor->media_url]);
    }

    public function deleteMedia(Request $request, $id) {
        $vendor = Vendor::findOrFail($id);
        $index = $request->input('index');
        $urls = $vendor->media_urls ?? [];
        
        if (isset($urls[$index])) {
            array_splice($urls, $index, 1);
            $vendor->media_urls = $urls;
            $vendor->media_url = $urls[0] ?? null;
            $vendor->save();
        }
        return $this->success(['media_urls' => $vendor->media_urls, 'media_url' => $vendor->media_url]);
    }
}