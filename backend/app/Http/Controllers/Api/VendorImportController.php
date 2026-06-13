<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Vendor;
use App\Http\Controllers\Api\BaseApiController;
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

        // Run Node.js script to extract data
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
            $vendorName    = $v['name'];
            $overview      = $v['overview'] ?? null;
            $avgVendor     = $v['avg_time_vendor'] ?? null;
            $avgActual     = $v['avg_time_actual'] ?? null;
            $notes         = $v['notes'] ?? null;
            $imageBase64   = $v['image_base64'] ?? null;

            // Save image if provided (skip for now per user request, handle later)
            $mediaUrl = null;
            if ($imageBase64 && str_starts_with($imageBase64, 'data:image')) {
                try {
                    list($type, $data) = explode(';', $imageBase64);
                    list(, $data)      = explode(',', $data);
                    $data = base64_decode($data);

                    $extension = str_contains($type, 'png') ? 'png' : 'jpg';
                    $imageName = 'vendor_' . $vendorName . '_' . time() . '.' . $extension;

                    $destinationPath = storage_path('app/vendors');
                    if (!file_exists($destinationPath)) {
                        mkdir($destinationPath, 0755, true);
                    }
                    file_put_contents($destinationPath . '/' . $imageName, $data);
                    $mediaUrl = rtrim(env('APP_URL'), '/') . '/media.php?f=' . $imageName;
                } catch (\Exception $e) {
                    // Image save failed — skip silently
                    $mediaUrl = null;
                }
            }

            // Common vendor-level fields (shared across all products of this vendor)
            $vendorCommon = [
                'overview'         => $overview,
                'avg_time_vendor'  => $avgVendor,
                'avg_time_actual'  => $avgActual,
                'notes'            => $notes,
            ];
            if ($mediaUrl) {
                $vendorCommon['media_url'] = $mediaUrl;
            }

            foreach ($v['products'] as $p) {
                $productType = $p['product_type'];
                if (!$productType) continue;

                $productData = array_merge($vendorCommon, [
                    'size'            => $p['size']            ?? null,
                    'optional'        => $p['optional']        ?? null,
                    'pricing1'        => $p['pricing1']        ?? null,
                    'pricing2'        => $p['pricing2']        ?? null,
                    'eco_price'       => $p['eco_price']       ?? null,
                    'eco_total'       => $p['eco_total']       ?? null,
                    'fast_price'      => $p['fast_price']      ?? null,
                    'fast_total'      => $p['fast_total']      ?? null,
                    'express_price'   => $p['express_price']   ?? null,
                    'express_total'   => $p['express_total']   ?? null,
                    'overnight_price' => $p['overnight_price'] ?? null,
                    'overnight_total' => $p['overnight_total'] ?? null,
                ]);

                Vendor::updateOrCreate(
                    ['name' => $vendorName, 'product_type' => $productType],
                    $productData
                );
                $importedCount++;
            }
        }

        // Cleanup temp files
        @unlink($absoluteFilePath);
        @unlink($absoluteJsonPath);

        return $this->success(
            ['imported' => $importedCount, 'vendors' => count($vendors)],
            "Đã import thành công $importedCount sản phẩm từ " . count($vendors) . " vendors."
        );
    }
}
