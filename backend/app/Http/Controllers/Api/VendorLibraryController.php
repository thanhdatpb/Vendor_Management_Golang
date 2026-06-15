<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VendorLibraryController extends Controller
{
    private $filePath = 'vendor_library.json';

    public function getLibrary()
    {
        if (!Storage::exists($this->filePath)) {
            return response()->json([]);
        }

        $data = Storage::get($this->filePath);
        return response($data)->header('Content-Type', 'application/json');
    }

    public function saveLibrary(Request $request)
    {
        $data = $request->all();
        // Since $data could be an array of files
        Storage::put($this->filePath, json_encode($data));

        return response()->json(['message' => 'Library saved successfully']);
    }
}
