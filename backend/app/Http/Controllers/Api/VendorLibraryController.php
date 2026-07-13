<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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

    /**
     * Cập nhật riêng trạng thái đặt Sample của MỘT dòng generalInfo theo id.
     * Chỉ đọc–sửa–ghi đúng 1 field trên server, không nhận cả blob từ client
     * → payload nhỏ, tránh việc client gửi bản cũ ghi đè thay đổi đồng thời.
     */
    public function updateSampleStatus(Request $request)
    {
        $validated = $request->validate([
            'rowId'        => ['required'],
            'sampleStatus' => ['required', 'in:has_sample,no_sample'],
        ]);

        $rowId  = (string) $validated['rowId'];
        $status = $validated['sampleStatus'];

        $row = $this->getRow();
        if (!$row) {
            return response()->json(['message' => 'Thư viện trống, không thể cập nhật.'], 404);
        }

        $data = json_decode($row->data, true);
        if (!is_array($data)) {
            return response()->json(['message' => 'Dữ liệu thư viện không hợp lệ.'], 422);
        }

        $found = false;
        foreach ($data as &$file) {
            if (empty($file['generalInfo']) || !is_array($file['generalInfo'])) {
                continue;
            }
            foreach ($file['generalInfo'] as &$gr) {
                if (isset($gr['id']) && (string) $gr['id'] === $rowId) {
                    $gr['sampleStatus'] = $status;
                    $found = true;
                }
            }
            unset($gr);
        }
        unset($file);

        if (!$found) {
            return response()->json(['message' => 'Không tìm thấy dòng cần cập nhật.'], 404);
        }

        DB::table('vendor_library')->where('id', $row->id)->update([
            'data'       => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message'      => 'Đã cập nhật trạng thái sample.',
            'rowId'        => $rowId,
            'sampleStatus' => $status,
        ]);
    }

    /**
     * Nhận hàng loạt ảnh trích xuất từ file Excel (ảnh nhúng trực tiếp vào ô,
     * không phải URL/formula =IMAGE()) và lưu vào disk public, trả về URL thật
     * cho từng ảnh — client dùng key gửi lên để map ngược ảnh vào đúng dòng.
     */
    public function uploadImages(Request $request)
    {
        $request->validate([
            'images'   => 'required|array|min:1|max:200',
            'images.*' => 'required|file|max:10240|mimetypes:image/jpeg,image/png,image/webp,image/gif',
        ]);

        $urls = [];
        foreach ($request->file('images') as $key => $file) {
            $path = $file->store('vendor-library', 'public');
            $urls[$key] = Storage::url($path);
        }

        return response()->json(['urls' => $urls]);
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
