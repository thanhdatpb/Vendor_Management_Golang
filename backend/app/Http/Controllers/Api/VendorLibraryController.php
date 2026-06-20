<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VendorLibraryController extends Controller
{
    private function getRow()
    {
        return DB::table('vendor_library')->orderBy('id')->first();
    }

    public function getLibrary(Request $request)
    {
        $row = $this->getRow();

        if (!$row) {
            return response()->json([]);
        }

        return response($row->data)->header('Content-Type', 'application/json');
    }

    public function saveLibrary(Request $request)
    {
        $data = $request->getContent();

        // Validate JSON
        if (json_decode($data) === null) {
            return response()->json(['error' => 'Invalid JSON'], 422);
        }

        $row = $this->getRow();

        if ($row) {
            DB::table('vendor_library')->where('id', $row->id)->update([
                'data'       => $data,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('vendor_library')->insert([
                'data'       => $data,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Library saved successfully']);
    }

    public function restoreBackup()
    {
        // Backup không còn dùng file — trả về dữ liệu hiện tại từ DB
        $row = $this->getRow();

        if (!$row) {
            return response()->json(['error' => 'Không có dữ liệu nào trong thư viện.'], 404);
        }

        return response($row->data)->header('Content-Type', 'application/json');
    }
}
