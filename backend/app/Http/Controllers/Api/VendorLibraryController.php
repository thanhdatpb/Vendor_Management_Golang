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

        if (!Storage::exists($fileName)) {
            return response()->json([]);
        }

        $data = Storage::get($fileName);
        return response($data)->header('Content-Type', 'application/json');
    }

    public function saveLibrary(Request $request)
    {
        $mode = $request->query('mode', 'all');
        $fileName = $mode === 'new_products' ? 'vendor_library_new.json' : 'vendor_library.json';

        $data = $request->all();
        Storage::put($fileName, json_encode($data));

        return response()->json(['message' => 'Library saved successfully']);
    }
}
