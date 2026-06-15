<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VendorLibraryController extends Controller
{
    private $filePath = 'vendor_library.json';

    public function getLibrary(Request $request)
    {
        $mode = $request->query('mode', 'all');
        $fileName = $mode === 'new_products' ? 'vendor_library_new.json' : 'vendor_library.json';
        $path = storage_path('app/' . $fileName);

        if (!file_exists($path)) {
            return response()->json([]);
        }

        $data = file_get_contents($path);
        return response($data)->header('Content-Type', 'application/json');
    }

    public function saveLibrary(Request $request)
    {
        $mode = $request->query('mode', 'all');
        $fileName = $mode === 'new_products' ? 'vendor_library_new.json' : 'vendor_library.json';
        $path = storage_path('app/' . $fileName);

        $data = $request->getContent();
        file_put_contents($path, $data);

        return response()->json(['message' => 'Library saved successfully']);
    }
}
