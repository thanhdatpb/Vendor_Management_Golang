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
            // max is in kilobytes — caps memory used while parsing embedded vendor images
            'file' => 'required|file|mimes:xlsx,xls|max:15360'
        ]);

        $file = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $filePath = $file->storeAs('temp', $fileName);
        $absoluteFilePath = storage_path('app/' . $filePath);
        $absoluteJsonPath = storage_path('app/temp/' . time() . '_output.json');
        $imageDir = storage_path('app/vendors');

        // Run Node.js script to extract data. Vendor images are written straight
        // to $imageDir by the script so this JSON only ever holds filenames,
        // never base64 image data.
        $nodeScript = base_path('extract_excel.cjs');
        $process = new Process(['node', $nodeScript, $absoluteFilePath, $absoluteJsonPath, $imageDir]);
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
            $imageFilename = $v['image_filename'] ?? null;

            // Image was already written to $imageDir by extract_excel.cjs —
            // just build the URL, no base64 decode needed here.
            $mediaUrl = $imageFilename
                ? rtrim(env('APP_URL'), '/') . '/media.php?f=' . $imageFilename
                : null;

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
