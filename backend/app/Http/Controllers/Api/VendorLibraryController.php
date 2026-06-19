<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VendorLibraryController extends Controller
{
    private function migrateNewProducts()
    {
        $pathAll = storage_path('app/vendor_library.json');
        $pathNew = storage_path('app/vendor_library_new.json');
        
        if (file_exists($pathNew)) {
            $dataAll = file_exists($pathAll) ? json_decode(file_get_contents($pathAll), true) : [];
            $dataNew = json_decode(file_get_contents($pathNew), true);
            
            if (is_array($dataNew)) {
                foreach ($dataNew as &$item) {
                    $item['sourceTab'] = 'new_products';
                }
                
                $unique = [];
                if (is_array($dataAll)) {
                    foreach ($dataAll as $item) {
                        $unique[$item['id']] = $item;
                    }
                }
                foreach ($dataNew as $item) {
                    $unique[$item['id']] = $item;
                }
                
                file_put_contents($pathAll, json_encode(array_values($unique)));
            }
            unlink($pathNew);
        }
    }

    public function getLibrary(Request $request)
    {
        $this->migrateNewProducts();
        $path = storage_path('app/vendor_library.json');

        if (!file_exists($path)) {
            return response()->json([]);
        }

        $data = file_get_contents($path);
        return response($data)->header('Content-Type', 'application/json');
    }

    public function saveLibrary(Request $request)
    {
        $path = storage_path('app/vendor_library.json');
        $backupPath = storage_path('app/vendor_library_backup.json');

        // Backup current data before overwriting (only if existing file has content)
        if (file_exists($path) && filesize($path) > 4) {
            copy($path, $backupPath);
        }

        $data = $request->getContent();
        file_put_contents($path, $data);

        return response()->json(['message' => 'Library saved successfully']);
    }

    public function restoreBackup()
    {
        $path = storage_path('app/vendor_library.json');
        $backupPath = storage_path('app/vendor_library_backup.json');

        if (!file_exists($backupPath)) {
            return response()->json(['error' => 'Không có bản backup nào.'], 404);
        }

        copy($backupPath, $path);
        $data = file_get_contents($path);
        return response($data)->header('Content-Type', 'application/json');
    }
}
