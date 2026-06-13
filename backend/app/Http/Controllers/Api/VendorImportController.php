<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Vendor;
use App\Http\Controllers\Api\BaseApiController;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class VendorImportController extends BaseApiController {

    public function import(Request $request) {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls'
        ]);

        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('temp', $fileName);
        $absoluteFilePath = storage_path('app/' . $filePath);
        $absoluteJsonPath = storage_path('app/temp/' . time() . '_output.json');

        // Run Node script
        $nodeScript = base_path('extract_excel.cjs');
        $process = new Process(['node', $nodeScript, $absoluteFilePath, $absoluteJsonPath]);
        $process->setTimeout(120);
        
        try {
            $process->mustRun();
        } catch (ProcessFailedException $exception) {
            return $this->error('Lỗi khi đọc file Excel: ' . $exception->getMessage(), 500);
        }

        if (!file_exists($absoluteJsonPath)) {
            return $this->error('Lỗi không tạo được dữ liệu trích xuất.', 500);
        }

        $jsonContent = file_get_contents($absoluteJsonPath);
        $vendors = json_decode($jsonContent, true);

        if (!$vendors) {
            return $this->error('File Excel không có dữ liệu hợp lệ.', 400);
        }

        $importedCount = 0;

        foreach ($vendors as $v) {
            $vendorName = $v['name'];
            $overview = $v['overview'];
            $imageBase64 = $v['image_base64'];

            $mediaUrl = null;
            if ($imageBase64 && str_starts_with($imageBase64, 'data:image')) {
                // Decode base64 and save
                list($type, $data) = explode(';', $imageBase64);
                list(, $data)      = explode(',', $data);
                $data = base64_decode($data);
                
                $extension = str_contains($type, 'png') ? 'png' : 'jpg';
                $imageName = 'vendor_' . $vendorName . '_' . time() . '.' . $extension;
                Storage::disk('public')->put('vendors/' . $imageName, $data);
                $mediaUrl = '/storage/vendors/' . $imageName;
            }

            foreach ($v['products'] as $p) {
                $productType = $p['product_type'];
                
                Vendor::updateOrCreate(
                    [
                        'name' => $vendorName,
                        'product_type' => $productType
                    ],
                    [
                        'overview' => $overview,
                        'pricing1' => $p['pricing1'],
                        'eco_price' => $p['eco_price'],
                        'fast_price' => $p['fast_price'],
                        'express_price' => $p['express_price'],
                        'overnight_price' => $p['overnight_price'],
                        'media_url' => $mediaUrl ? $mediaUrl : \DB::raw('media_url') // keep old if not uploaded
                    ]
                );
                $importedCount++;
            }
        }

        // Cleanup temp files
        @unlink($absoluteFilePath);
        @unlink($absoluteJsonPath);

        return $this->success(null, "Đã import thành công $importedCount dòng giá (từ " . count($vendors) . " vendors).");
    }
}
